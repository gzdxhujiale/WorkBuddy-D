package mcp

import (
	"context"
	"fmt"
	"log/slog"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mark3labs/mcp-go/server"

	"workbuddy-server/internal/database/sqlc"
	"workbuddy-server/internal/middleware"
	"workbuddy-server/internal/ws"
)

// MCPHandler bridges MCP SSE transport with Gin HTTP engine.
type MCPHandler struct {
	MCPServer *server.MCPServer
	SSEServer *server.SSEServer
}

// NewMCPHandler creates and configures the MCP Handler with SSE support.
func NewMCPHandler(queries sqlc.Querier, hub *ws.Hub) *MCPHandler {
	getUserID := func(ctx context.Context) (uuid.UUID, error) {
		val := ctx.Value("userID")
		if val == nil {
			return uuid.Nil, fmt.Errorf("missing user context in MCP request")
		}
		if uid, ok := val.(uuid.UUID); ok && uid != uuid.Nil {
			return uid, nil
		}
		return uuid.Nil, fmt.Errorf("invalid user context")
	}

	mcpSrv := NewMCPServer(queries, hub, getUserID)
	sseSrv := server.NewSSEServer(
		mcpSrv,
		server.WithSSEEndpoint("/api/v1/mcp/sse"),
		server.WithMessageEndpoint("/api/v1/mcp/messages"),
	)

	return &MCPHandler{
		MCPServer: mcpSrv,
		SSEServer: sseSrv,
	}
}

// HandleSSE serves the Server-Sent Events stream to MCP clients.
func (h *MCPHandler) HandleSSE(c *gin.Context) {
	userID, err := middleware.GetUserID(c)
	if err == nil {
		ctx := context.WithValue(c.Request.Context(), "userID", userID)
		c.Request = c.Request.WithContext(ctx)
	}
	h.SSEServer.SSEHandler().ServeHTTP(c.Writer, c.Request)
}

// HandleMessages receives JSON-RPC message calls from SSE clients.
func (h *MCPHandler) HandleMessages(c *gin.Context) {
	userID, err := middleware.GetUserID(c)
	if err == nil {
		ctx := context.WithValue(c.Request.Context(), "userID", userID)
		c.Request = c.Request.WithContext(ctx)
	}
	h.SSEServer.MessageHandler().ServeHTTP(c.Writer, c.Request)
}

// RunStdioServer executes the MCP server over standard input/output streams for Cursor and Claude Desktop.
func RunStdioServer(queries sqlc.Querier, hub *ws.Hub) error {
	getUserID := func(ctx context.Context) (uuid.UUID, error) {
		if envUID := os.Getenv("WORKBUDDY_USER_ID"); envUID != "" {
			if parsed, err := uuid.Parse(envUID); err == nil {
				return parsed, nil
			}
		}
		if envEmail := os.Getenv("WORKBUDDY_USER_EMAIL"); envEmail != "" {
			u, err := queries.GetUserByEmail(ctx, envEmail)
			if err == nil && u.ID.Valid {
				return u.ID.Bytes, nil
			}
		}
		return uuid.Nil, fmt.Errorf("WORKBUDDY_USER_ID or WORKBUDDY_USER_EMAIL must be set for MCP stdio transport")
	}

	mcpSrv := NewMCPServer(queries, hub, getUserID)
	stdioSrv := server.NewStdioServer(mcpSrv)

	slog.Info("starting WorkBuddy MCP server via stdio transport")
	return stdioSrv.Listen(context.Background(), os.Stdin, os.Stdout)
}
