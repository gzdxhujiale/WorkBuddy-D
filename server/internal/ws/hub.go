package ws

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"workbuddy-server/internal/middleware"
)

type Hub struct {
	mu      sync.RWMutex
	clients map[uuid.UUID]map[*Client]bool
}

func NewHub() *Hub {
	return &Hub{
		clients: make(map[uuid.UUID]map[*Client]bool),
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
	log.Printf("[WS] Client connected for user %s (total: %d)", client.UserID, len(userClients))
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
			log.Printf("[WS] Client disconnected for user %s", client.UserID)
		}
	}
}

func (h *Hub) BroadcastToUser(userID uuid.UUID, sender *Client, msg DeltaMessage) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	userClients, ok := h.clients[userID]
	if !ok || len(userClients) == 0 {
		return
	}

	payload, err := json.Marshal(msg)
	if err != nil {
		log.Printf("[WS] Error marshaling delta message: %v", err)
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
			log.Printf("[WS] Client buffer full for user %s", userID)
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
		log.Printf("[WS] Failed to upgrade websocket: %v", err)
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
