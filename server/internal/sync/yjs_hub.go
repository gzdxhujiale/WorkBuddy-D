package sync

import (
	"errors"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"workbuddy-server/internal/database/sqlc"
	"workbuddy-server/internal/middleware"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 10 * 1024 * 1024 // 10MB max binary message for Yjs states
)

// Yjs protocol message types according to y-websocket specifications
const (
	MsgSync           uint64 = 0
	MsgAwareness      uint64 = 1
	MsgAuth           uint64 = 2
	MsgQueryAwareness uint64 = 3

	SyncStep1  uint64 = 0
	SyncStep2  uint64 = 1
	SyncUpdate uint64 = 2
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  8192,
	WriteBufferSize: 8192,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow cross-origin desktop webviews
	},
}

// ReadVarUint decodes a variable-length unsigned integer from binary data (lib0 format)
func ReadVarUint(data []byte) (uint64, int, error) {
	var num uint64
	var shift uint
	for i, b := range data {
		num |= uint64(b&127) << shift
		if (b & 128) == 0 {
			return num, i + 1, nil
		}
		shift += 7
		if shift >= 64 {
			return 0, 0, errors.New("varint overflow")
		}
	}
	return 0, 0, errors.New("incomplete varint")
}

// WriteVarUint encodes an unsigned integer into variable-length binary format
func WriteVarUint(num uint64) []byte {
	var res []byte
	for num > 127 {
		res = append(res, byte(128|(num&127)))
		num >>= 7
	}
	res = append(res, byte(num&127))
	return res
}

// ReadVarUint8Array decodes a byte array prefixed with its variable-length length
func ReadVarUint8Array(data []byte) ([]byte, int, error) {
	length, offset, err := ReadVarUint(data)
	if err != nil {
		return nil, 0, err
	}
	intLen := int(length)
	if len(data) < offset+intLen {
		return nil, 0, errors.New("data too short for varUint8Array")
	}
	return data[offset : offset+intLen], offset + intLen, nil
}

// WriteVarUint8Array encodes a byte slice prefixed with its length
func WriteVarUint8Array(data []byte) []byte {
	lenBytes := WriteVarUint(uint64(len(data)))
	res := make([]byte, 0, len(lenBytes)+len(data))
	res = append(res, lenBytes...)
	res = append(res, data...)
	return res
}

// BuildSyncStep2Message builds a complete Yjs SyncStep2 message containing an update
func BuildSyncStep2Message(update []byte) []byte {
	msg := WriteVarUint(MsgSync)
	msg = append(msg, WriteVarUint(SyncStep2)...)
	msg = append(msg, WriteVarUint8Array(update)...)
	return msg
}

// BuildSyncStep1Message builds a SyncStep1 message with the given state vector (or empty)
func BuildSyncStep1Message(stateVector []byte) []byte {
	msg := WriteVarUint(MsgSync)
	msg = append(msg, WriteVarUint(SyncStep1)...)
	msg = append(msg, WriteVarUint8Array(stateVector)...)
	return msg
}

// YjsClient represents a single connected Webview/window in a note collaboration session
type YjsClient struct {
	Hub    *YjsHub
	Room   *YjsRoom
	Conn   *websocket.Conn
	UserID uuid.UUID
	Send   chan []byte
	closed bool
	mu     sync.Mutex
}

func (c *YjsClient) Close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if !c.closed {
		c.closed = true
		close(c.Send)
	}
}

// YjsRoom manages active clients and cumulative document updates for a specific note
type YjsRoom struct {
	NoteID     string
	mu         sync.RWMutex
	Clients    map[*YjsClient]bool
	DocUpdates [][]byte
}

func NewYjsRoom(noteID string) *YjsRoom {
	return &YjsRoom{
		NoteID:     noteID,
		Clients:    make(map[*YjsClient]bool),
		DocUpdates: make([][]byte, 0),
	}
}

func (r *YjsRoom) AddClient(client *YjsClient) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Clients[client] = true
	slog.Info("yjs client joined room", slog.String("note_id", r.NoteID), slog.Int("total_clients", len(r.Clients)))
}

func (r *YjsRoom) RemoveClient(client *YjsClient) int {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.Clients, client)
	client.Close()
	slog.Info("yjs client left room", slog.String("note_id", r.NoteID), slog.Int("remaining_clients", len(r.Clients)))
	return len(r.Clients)
}

func (r *YjsRoom) Broadcast(sender *YjsClient, message []byte) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for client := range r.Clients {
		if client != sender {
			select {
			case client.Send <- message:
			default:
				slog.Warn("yjs client send channel full, skipping message", slog.String("note_id", r.NoteID))
			}
		}
	}
}

// YjsHub manages note rooms and dispatches WebSocket connections
type YjsHub struct {
	mu      sync.RWMutex
	Rooms   map[string]*YjsRoom
	Queries sqlc.Querier
}

func NewYjsHub(queries sqlc.Querier) *YjsHub {
	return &YjsHub{
		Rooms:   make(map[string]*YjsRoom),
		Queries: queries,
	}
}

func (h *YjsHub) GetOrCreateRoom(noteID string) *YjsRoom {
	h.mu.Lock()
	defer h.mu.Unlock()

	room, exists := h.Rooms[noteID]
	if !exists {
		room = NewYjsRoom(noteID)
		h.Rooms[noteID] = room
	}
	return room
}

func (h *YjsHub) RemoveClient(client *YjsClient) {
	if client.Room == nil {
		return
	}
	remaining := client.Room.RemoveClient(client)
	if remaining == 0 {
		h.mu.Lock()
		delete(h.Rooms, client.Room.NoteID)
		h.mu.Unlock()
		slog.Info("yjs room empty and closed", slog.String("note_id", client.Room.NoteID))
	}
}

// HandleWebSocket upgrades HTTP connection to WebSocket and registers to note room
func (h *YjsHub) HandleWebSocket(c *gin.Context) {
	noteID := c.Param("id")
	if noteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing note id"})
		return
	}

	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		slog.Error("failed to upgrade yjs websocket", slog.Any("error", err))
		return
	}

	room := h.GetOrCreateRoom(noteID)
	client := &YjsClient{
		Hub:    h,
		Room:   room,
		Conn:   conn,
		UserID: userID,
		Send:   make(chan []byte, 256),
	}

	room.AddClient(client)

	// Send initial SyncStep1 from server to client to trigger document sync
	client.Send <- BuildSyncStep1Message(nil)

	// If server already has accumulated updates in this room, send SyncStep2
	room.mu.RLock()
	for _, update := range room.DocUpdates {
		client.Send <- BuildSyncStep2Message(update)
	}
	room.mu.RUnlock()

	go client.WritePump()
	go client.ReadPump()
}

func (c *YjsClient) ReadPump() {
	defer func() {
		c.Hub.RemoveClient(c)
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		msgType, data, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				slog.Warn("yjs ws read error", slog.Any("error", err), slog.String("note_id", c.Room.NoteID))
			}
			break
		}

		if msgType != websocket.BinaryMessage || len(data) == 0 {
			continue
		}

		protocolMsgType, offset, err := ReadVarUint(data)
		if err != nil {
			continue
		}

		switch protocolMsgType {
		case MsgSync:
			if len(data) > offset {
				syncType, syncOffset, err := ReadVarUint(data[offset:])
				if err == nil {
					totalOffset := offset + syncOffset
					switch syncType {
					case SyncStep1:
						// Client requested sync. Reply with server accumulated updates if any
						c.Room.mu.RLock()
						for _, upd := range c.Room.DocUpdates {
							c.Send <- BuildSyncStep2Message(upd)
						}
						c.Room.mu.RUnlock()
						// Also relay SyncStep1 to other active peers in room
						c.Room.Broadcast(c, data)
					case SyncStep2, SyncUpdate:
						// Save update bytes into room cache
						updateBytes, _, err := ReadVarUint8Array(data[totalOffset:])
						if err == nil && len(updateBytes) > 0 {
							c.Room.mu.Lock()
							c.Room.DocUpdates = append(c.Room.DocUpdates, updateBytes)
							c.Room.mu.Unlock()
						}
						// Broadcast update to other peers
						c.Room.Broadcast(c, data)
					}
				}
			}
		case MsgAwareness, MsgQueryAwareness, MsgAuth:
			// Relay awareness/cursor/auth messages to other peers in the room
			c.Room.Broadcast(c, data)
		}
	}
}

func (c *YjsClient) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.BinaryMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Drain queued messages
			n := len(c.Send)
			for i := 0; i < n; i++ {
				w.Write(<-c.Send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
