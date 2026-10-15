package ws

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"workbuddy-server/internal/database/sqlc"
	"workbuddy-server/internal/middleware"
)

type Hub struct {
	mu      sync.RWMutex
	clients map[uuid.UUID]map[*Client]bool
	queries sqlc.Querier
}

func NewHub(queries sqlc.Querier) *Hub {
	return &Hub{
		clients: make(map[uuid.UUID]map[*Client]bool),
		queries: queries,
	}
}

func (h *Hub) Register(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	userClients, ok := h.clients[client.UserID]
	if !ok {
		userClients = make(map[*Client]bool)
		h.clients[client.UserID] = userClients
	}
	userClients[client] = true
	slog.Info("ws client connected", slog.String("user_id", client.UserID.String()), slog.Int("total_clients", len(userClients)))
}

func (h *Hub) Unregister(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	userClients, ok := h.clients[client.UserID]
	if ok {
		if _, exists := userClients[client]; exists {
			delete(userClients, client)
			close(client.Send)
			if len(userClients) == 0 {
				delete(h.clients, client.UserID)
			}
			slog.Info("ws client disconnected", slog.String("user_id", client.UserID.String()))
		}
	}
}

func (h *Hub) BroadcastToUser(userID uuid.UUID, sender *Client, msg DeltaMessage) {
	// If queries is configured, append to entity_change_logs and get monotonic seq_id
	if h.queries != nil {
		entityUUID, _ := uuid.Parse(msg.ID)
		payloadBytes, err := json.Marshal(msg.Data)
		if err != nil || len(payloadBytes) == 0 {
			payloadBytes = []byte("{}")
		}

		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		logRow, err := h.queries.InsertChangeLog(ctx, sqlc.InsertChangeLogParams{
			UserID:     pgtype.UUID{Bytes: userID, Valid: true},
			EntityType: msg.Table,
			EntityID:   pgtype.UUID{Bytes: entityUUID, Valid: true},
			Action:     string(msg.Action),
			Payload:    payloadBytes,
		})
		cancel()
		if err != nil {
			slog.Warn("failed to log change to entity_change_logs", slog.Any("error", err))
		} else {
			msg.SeqID = logRow.SeqID
		}
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	userClients, ok := h.clients[userID]
	if !ok || len(userClients) == 0 {
		return
	}

	payload, err := json.Marshal(msg)
	if err != nil {
		slog.Error("error marshaling delta message", slog.Any("error", err))
		return
	}

	for client := range userClients {
		if sender != nil && client == sender {
			continue // Don't echo back to the same window if not desired
		}
		select {
		case client.Send <- payload:
		default:
			// Buffer full, drop or close
			slog.Warn("client buffer full, dropping message", slog.String("user_id", userID.String()))
		}
	}
}

func (h *Hub) HandleWebSocket(c *gin.Context) {
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized websocket connection"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		slog.Error("failed to upgrade websocket", slog.Any("error", err))
		return
	}

	client := &Client{
		Hub:    h,
		Conn:   conn,
		UserID: userID,
		Send:   make(chan []byte, 256),
	}

	h.Register(client)

	go client.WritePump()
	go client.ReadPump()
}
