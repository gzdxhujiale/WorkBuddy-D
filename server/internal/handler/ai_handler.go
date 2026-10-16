package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/cloudwego/eino/schema"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"workbuddy-server/internal/ai/gateway"
	"workbuddy-server/internal/ai/monitor"
	"workbuddy-server/internal/ai/skill"
	"workbuddy-server/internal/ai/tools"
	"workbuddy-server/internal/database/sqlc"
	"workbuddy-server/internal/middleware"
)

type AIHandler struct {
	queries       sqlc.Querier
	factory       *gateway.Factory
	router        *gateway.Router
	recorder      *monitor.Recorder
	toolsRegistry *tools.Registry
}

func NewAIHandler(queries sqlc.Querier, factory *gateway.Factory, router *gateway.Router, recorder *monitor.Recorder, toolsRegistry *tools.Registry) *AIHandler {
	return &AIHandler{
		queries:       queries,
		factory:       factory,
		router:        router,
		recorder:      recorder,
		toolsRegistry: toolsRegistry,
	}
}

type ChannelRequest struct {
	Name     string   `json:"name" binding:"required"`
	Provider string   `json:"provider" binding:"required"`
	BaseURL  string   `json:"base_url"`
	APIKey   string   `json:"api_key"`
	Models   []string `json:"models"`
	IsActive bool     `json:"is_active"`
	Priority int32    `json:"priority"`
}

func toChannelDTO(c sqlc.AiChannel) gateway.ChannelDTO {
	return gateway.ChannelDTO{
		ID:        c.ID.String(),
		Name:      c.Name,
		Provider:  c.Provider,
		BaseURL:   c.BaseUrl,
		APIKey:    c.ApiKey,
		Models:    gateway.ParseModels(c.Models),
		IsActive:  c.IsActive,
		Priority:  c.Priority,
		CreatedAt: c.CreatedAt.Time,
		UpdatedAt: c.UpdatedAt.Time,
	}
}

func toPgUUID(u uuid.UUID) pgtype.UUID {
	return pgtype.UUID{Bytes: u, Valid: true}
}

// ListChannels returns all configured AI channels for the authenticated user.
func (h *AIHandler) ListChannels(c *gin.Context) {
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	channels, err := h.queries.ListAIChannels(c.Request.Context(), toPgUUID(userID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list channels: " + err.Error()})
		return
	}

	dtos := make([]gateway.ChannelDTO, len(channels))
	for i, ch := range channels {
		dtos[i] = toChannelDTO(ch)
	}

	c.JSON(http.StatusOK, dtos)
}

// CreateChannel creates a new AI provider channel.
func (h *AIHandler) CreateChannel(c *gin.Context) {
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req ChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	modelsBytes, _ := json.Marshal(req.Models)
	created, err := h.queries.CreateAIChannel(c.Request.Context(), sqlc.CreateAIChannelParams{
		UserID:   toPgUUID(userID),
		Name:     req.Name,
		Provider: req.Provider,
		BaseUrl:  gateway.NormalizeBaseURL(req.Provider, req.BaseURL),
		ApiKey:   req.APIKey,
		Models:   modelsBytes,
		IsActive: req.IsActive,
		Priority: req.Priority,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create channel: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, toChannelDTO(created))
}

// UpdateChannel updates an existing AI channel.
func (h *AIHandler) UpdateChannel(c *gin.Context) {
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var chUUID pgtype.UUID
	if err := chUUID.Scan(c.Param("id")); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid channel id"})
		return
	}

	var req ChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	modelsBytes, _ := json.Marshal(req.Models)
	updated, err := h.queries.UpdateAIChannel(c.Request.Context(), sqlc.UpdateAIChannelParams{
		ID:       chUUID,
		UserID:   toPgUUID(userID),
		Name:     req.Name,
		Provider: req.Provider,
		BaseUrl:  gateway.NormalizeBaseURL(req.Provider, req.BaseURL),
		ApiKey:   req.APIKey,
		Models:   modelsBytes,
		IsActive: req.IsActive,
		Priority: req.Priority,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update channel: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, toChannelDTO(updated))
}

// DeleteChannel removes an AI channel.
func (h *AIHandler) DeleteChannel(c *gin.Context) {
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var chUUID pgtype.UUID
	if err := chUUID.Scan(c.Param("id")); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid channel id"})
		return
	}

	if err := h.queries.DeleteAIChannel(c.Request.Context(), sqlc.DeleteAIChannelParams{
		ID:     chUUID,
		UserID: toPgUUID(userID),
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete channel: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

// PingChannel tests connectivity and response latency for a configured channel.
func (h *AIHandler) PingChannel(c *gin.Context) {
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var chUUID pgtype.UUID
	if err := chUUID.Scan(c.Param("id")); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid channel id"})
		return
	}

	ch, err := h.queries.GetAIChannelByID(c.Request.Context(), sqlc.GetAIChannelByIDParams{
		ID:     chUUID,
		UserID: toPgUUID(userID),
	})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "channel not found"})
		return
	}

	latency, err := h.factory.PingChannel(c.Request.Context(), &ch)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"status":     "offline",
			"error":      err.Error(),
			"latency_ms": latency.Milliseconds(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":     "online",
		"latency_ms": latency.Milliseconds(),
	})
}

// GetMetrics returns aggregated metrics and recent invocation audit logs.
func (h *AIHandler) GetMetrics(c *gin.Context) {
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	daysStr := c.DefaultQuery("days", "7")
	days, _ := strconv.Atoi(daysStr)
	if days <= 0 {
		days = 7
	}
	since := time.Now().AddDate(0, 0, -days)

	var sinceTZ pgtype.Timestamptz
	_ = sinceTZ.Scan(since)

	metrics, err := h.queries.GetAIUsageMetrics(c.Request.Context(), sqlc.GetAIUsageMetricsParams{
		UserID:    toPgUUID(userID),
		CreatedAt: sinceTZ,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query metrics: " + err.Error()})
		return
	}

	logs, err := h.queries.ListAIInvocationLogs(c.Request.Context(), sqlc.ListAIInvocationLogsParams{
		UserID: toPgUUID(userID),
		Limit:  30,
		Offset: 0,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list logs: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"summary": gin.H{
			"total_calls":             metrics.TotalCalls,
			"total_prompt_tokens":     metrics.TotalPromptTokens,
			"total_completion_tokens": metrics.TotalCompletionTokens,
			"avg_latency_ms":          metrics.AvgLatencyMs,
			"avg_ttft_ms":             metrics.AvgTtftMs,
		},
		"logs": logs,
	})
}

// ListSkills returns all available AI business skills.
func (h *AIHandler) ListSkills(c *gin.Context) {
	c.JSON(http.StatusOK, skill.BuiltinSkills())
}

// SessionCreateRequest defines the input to create a session.
type SessionCreateRequest struct {
	Title     string `json:"title"`
	SkillCode string `json:"skill_code"`
	ModelName string `json:"model_name"`
	IsPinned  bool   `json:"is_pinned"`
}

// SessionUpdateRequest defines the input to update a session.
type SessionUpdateRequest struct {
	Title     string `json:"title"`
	SkillCode string `json:"skill_code"`
	ModelName string `json:"model_name"`
	IsPinned  bool   `json:"is_pinned"`
}

type SessionDTO struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Title     string    `json:"title"`
	SkillCode string    `json:"skill_code"`
	ModelName string    `json:"model_name"`
	IsPinned  bool      `json:"is_pinned"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func toSessionDTO(s sqlc.AiSession) SessionDTO {
	return SessionDTO{
		ID:        uuidToString(s.ID),
		UserID:    uuidToString(s.UserID),
		Title:     s.Title,
		SkillCode: s.SkillCode,
		ModelName: s.ModelName,
		IsPinned:  s.IsPinned,
		CreatedAt: s.CreatedAt.Time,
		UpdatedAt: s.UpdatedAt.Time,
	}
}

type MessageDTO struct {
	ID                 string          `json:"id"`
	SessionID          string          `json:"session_id"`
	Role               string          `json:"role"`
	Content            string          `json:"content"`
	ReasoningContent   string          `json:"reasoning_content"`
	ToolCalls          json.RawMessage `json:"tool_calls"`
	CreatedAt          time.Time       `json:"created_at"`
	ThinkingDurationMs *int64          `json:"thinking_duration_ms,omitempty"`
}

func toMessageDTO(m sqlc.AiMessage) MessageDTO {
	toolCallsJSON := json.RawMessage("[]")
	if len(m.ToolCalls) > 0 {
		var js json.RawMessage
		if err := json.Unmarshal(m.ToolCalls, &js); err == nil {
			toolCallsJSON = js
		}
	}
	var thinkingDurationMs *int64
	if m.ThinkingDurationMs.Valid {
		v := m.ThinkingDurationMs.Int64
		thinkingDurationMs = &v
	}
	return MessageDTO{
		ID:                 uuidToString(m.ID),
		SessionID:          uuidToString(m.SessionID),
		Role:               m.Role,
		Content:            m.Content,
		ReasoningContent:   m.ReasoningContent,
		ToolCalls:          toolCallsJSON,
		CreatedAt:          m.CreatedAt.Time,
		ThinkingDurationMs: thinkingDurationMs,
	}
}

// ListSessions returns all conversation sessions for the current user.
func (h *AIHandler) ListSessions(c *gin.Context) {
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	sessions, err := h.queries.ListAISessions(c.Request.Context(), toPgUUID(userID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list sessions: " + err.Error()})
		return
	}

	dtos := make([]SessionDTO, len(sessions))
	for i, s := range sessions {
		dtos[i] = toSessionDTO(s)
	}

	c.JSON(http.StatusOK, dtos)
}

// CreateSession creates a new AI conversation session.
func (h *AIHandler) CreateSession(c *gin.Context) {
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req SessionCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request: " + err.Error()})
		return
	}

	title := strings.TrimSpace(req.Title)
	if title == "" {
		title = "新对话"
	}
	skillCode := strings.TrimSpace(req.SkillCode)
	if skillCode == "" {
		skillCode = "general"
	}

	session, err := h.queries.CreateAISession(c.Request.Context(), sqlc.CreateAISessionParams{
		UserID:    toPgUUID(userID),
		Title:     title,
		SkillCode: skillCode,
		ModelName: req.ModelName,
		IsPinned:  req.IsPinned,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create session: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, toSessionDTO(session))
}

// GetSession retrieves a single AI conversation session.
func (h *AIHandler) GetSession(c *gin.Context) {
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var sessionUUID pgtype.UUID
	if err := sessionUUID.Scan(c.Param("id")); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid session id"})
		return
	}

	session, err := h.queries.GetAISessionByID(c.Request.Context(), sqlc.GetAISessionByIDParams{
		ID:     sessionUUID,
		UserID: toPgUUID(userID),
	})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
		return
	}

	c.JSON(http.StatusOK, toSessionDTO(session))
}

// UpdateSession updates session title, pinned status, or model metadata.
func (h *AIHandler) UpdateSession(c *gin.Context) {
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var sessionUUID pgtype.UUID
	if err := sessionUUID.Scan(c.Param("id")); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid session id"})
		return
	}

	var req SessionUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request: " + err.Error()})
		return
	}

	title := strings.TrimSpace(req.Title)
	if title == "" {
		title = "新对话"
	}

	session, err := h.queries.UpdateAISession(c.Request.Context(), sqlc.UpdateAISessionParams{
		ID:        sessionUUID,
		UserID:    toPgUUID(userID),
		Title:     title,
		SkillCode: req.SkillCode,
		ModelName: req.ModelName,
		IsPinned:  req.IsPinned,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update session: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, toSessionDTO(session))
}

// DeleteSession deletes a conversation session and all its messages.
func (h *AIHandler) DeleteSession(c *gin.Context) {
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var sessionUUID pgtype.UUID
	if err := sessionUUID.Scan(c.Param("id")); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid session id"})
		return
	}

	if err := h.queries.DeleteAISession(c.Request.Context(), sqlc.DeleteAISessionParams{
		ID:     sessionUUID,
		UserID: toPgUUID(userID),
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete session: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

// ListSessionMessages retrieves all messages for a specific session.
func (h *AIHandler) ListSessionMessages(c *gin.Context) {
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var sessionUUID pgtype.UUID
	if err := sessionUUID.Scan(c.Param("id")); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid session id"})
		return
	}

	// Verify ownership
	if _, err := h.queries.GetAISessionByID(c.Request.Context(), sqlc.GetAISessionByIDParams{
		ID:     sessionUUID,
		UserID: toPgUUID(userID),
	}); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
		return
	}

	messages, err := h.queries.ListAIMessagesBySession(c.Request.Context(), sessionUUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list messages: " + err.Error()})
		return
	}

	dtos := make([]MessageDTO, len(messages))
	for i, m := range messages {
		dtos[i] = toMessageDTO(m)
	}

	c.JSON(http.StatusOK, dtos)
}

// ChatMessageInput defines a single message in the chat conversation.
type ChatMessageInput struct {
	Role             string `json:"role"`
	Content          string `json:"content"`
	ReasoningContent string `json:"reasoning_content,omitempty"`
}

// ChatStreamRequest represents the body for /api/v1/ai/chat.
type ChatStreamRequest struct {
	SessionID   string             `json:"session_id"`
	Messages    []ChatMessageInput `json:"messages" binding:"required"`
	Model       string             `json:"model"`
	ChannelID   string             `json:"channel_id"`
	SkillCode   string             `json:"skill_code"`
	Date        string             `json:"date"`
	EnableTools bool               `json:"enable_tools"`
}

// ChatStream handles streaming AI responses over Server-Sent Events (SSE).
func (h *AIHandler) ChatStream(c *gin.Context) {
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req ChatStreamRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request: " + err.Error()})
		return
	}

	if len(req.Messages) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "messages cannot be empty"})
		return
	}

	// 1. Resolve Channel
	var targetChannel *sqlc.AiChannel
	var targetModel string

	if req.ChannelID != "" {
		chUUID, parseErr := uuid.Parse(req.ChannelID)
		if parseErr == nil {
			channels, _ := h.queries.ListAIChannels(c.Request.Context(), toPgUUID(userID))
			for _, ch := range channels {
				if ch.ID.Bytes == chUUID && ch.IsActive {
					targetChannel = &ch
					break
				}
			}
		}
	}

	if targetChannel == nil {
		candidates, routeErr := h.router.ResolveCandidates(c.Request.Context(), toPgUUID(userID), req.Model)
		if routeErr != nil || len(candidates) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "未找到可用 AI 模型渠道，请在「设置 - AI配置」中添加并启用至少一个可用渠道",
			})
			return
		}
		targetChannel = &candidates[0].Channel
		targetModel = candidates[0].ModelName
	} else {
		targetModel = req.Model
		models := gateway.ParseModels(targetChannel.Models)
		if targetModel == "" && len(models) > 0 {
			targetModel = models[0]
		}
		if targetModel == "" {
			targetModel = "default"
		}
	}

	// 2. Resolve or Auto-Create Session
	var sessionUUID pgtype.UUID
	if req.SessionID != "" {
		_ = sessionUUID.Scan(req.SessionID)
	}
	if !sessionUUID.Valid {
		firstText := "新对话"
		for i := len(req.Messages) - 1; i >= 0; i-- {
			if strings.ToLower(req.Messages[i].Role) == "user" && req.Messages[i].Content != "" {
				firstText = req.Messages[i].Content
				break
			}
		}
		runes := []rune(firstText)
		if len(runes) > 18 {
			firstText = string(runes[:18]) + "..."
		}
		newSession, err := h.queries.CreateAISession(c.Request.Context(), sqlc.CreateAISessionParams{
			UserID:    toPgUUID(userID),
			Title:     firstText,
			SkillCode: req.SkillCode,
			ModelName: targetModel,
			IsPinned:  false,
		})
		if err == nil {
			sessionUUID = newSession.ID
		}
	}

	// 3. Build Messages
	var messages []*schema.Message

	// If a skill is selected, prepend its prompt
	if req.SkillCode != "" {
		lastMsg := req.Messages[len(req.Messages)-1].Content
		skillMsgs, err := skill.BuildSkillPrompt(skill.SkillCode(req.SkillCode), lastMsg, req.Date)
		if err == nil && len(skillMsgs) > 0 {
			messages = append(messages, skillMsgs[0])
		}
	}

	// Append user and assistant messages
	for _, m := range req.Messages {
		switch strings.ToLower(m.Role) {
		case "system":
			messages = append(messages, schema.SystemMessage(m.Content))
		case "assistant":
			messages = append(messages, schema.AssistantMessage(m.Content, nil))
		default:
			messages = append(messages, schema.UserMessage(m.Content))
		}
	}

	// 4. Create Model
	chatModel, err := h.factory.CreateChatModel(c.Request.Context(), targetChannel, targetModel)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to initialize model: " + err.Error()})
		return
	}

	// 5. Inject User Context for potential tool execution
	execCtx := tools.WithUserID(c.Request.Context(), userID)

	// 6. Initialize SSE Stream
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "streaming unsupported"})
		return
	}

	// Emit session ID event
	sessionEvent, _ := json.Marshal(gin.H{
		"session_id": uuidToString(sessionUUID),
	})
	fmt.Fprintf(c.Writer, "event: session\ndata: %s\n\n", sessionEvent)
	flusher.Flush()

	streamReader, err := chatModel.Stream(execCtx, messages)
	if err != nil {
		sendSSEError(c.Writer, flusher, "upstream model stream error: "+err.Error())
		return
	}
	defer streamReader.Close()

	start := time.Now()
	var ttft time.Duration
	var fullContent strings.Builder
	var fullReasoning strings.Builder
	inThinkTag := false
	var thinkingStart time.Time
	var thinkingDuration time.Duration

	for {
		select {
		case <-c.Request.Context().Done():
			// Client disconnected or canceled
			currentThinking := thinkingDuration
			if fullReasoning.Len() > 0 && currentThinking == 0 && !thinkingStart.IsZero() {
				currentThinking = time.Since(thinkingStart)
			}
			h.saveMessagesSync(sessionUUID, userID, req.Messages, fullContent.String(), fullReasoning.String(), currentThinking.Milliseconds())
			return
		default:
		}

		chunk, err := streamReader.Recv()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			sendSSEError(c.Writer, flusher, "stream recv error: "+err.Error())
			currentThinking := thinkingDuration
			if fullReasoning.Len() > 0 && currentThinking == 0 && !thinkingStart.IsZero() {
				currentThinking = time.Since(thinkingStart)
			}
			h.saveMessagesSync(sessionUUID, userID, req.Messages, fullContent.String(), fullReasoning.String(), currentThinking.Milliseconds())
			return
		}

		if ttft == 0 {
			ttft = time.Since(start)
		}

		// 1. Check native reasoning content
		if chunk.ReasoningContent != "" {
			if thinkingStart.IsZero() {
				thinkingStart = time.Now()
			}
			fullReasoning.WriteString(chunk.ReasoningContent)
			reasonBytes, _ := json.Marshal(gin.H{
				"thinking": chunk.ReasoningContent,
				"content":  chunk.ReasoningContent,
			})
			fmt.Fprintf(c.Writer, "event: thinking\ndata: %s\n\n", reasonBytes)
			flusher.Flush()
		}

		// 2. Check tool calls
		if len(chunk.ToolCalls) > 0 {
			tcBytes, _ := json.Marshal(gin.H{
				"tool_calls": chunk.ToolCalls,
			})
			fmt.Fprintf(c.Writer, "event: tool_call\ndata: %s\n\n", tcBytes)
			flusher.Flush()
		}

		// 3. Process text content (with <think> tag handling)
		if chunk.Content != "" {
			rawText := chunk.Content
			if strings.Contains(rawText, "<think>") {
				inThinkTag = true
				if thinkingStart.IsZero() {
					thinkingStart = time.Now()
				}
				parts := strings.SplitN(rawText, "<think>", 2)
				if len(parts[0]) > 0 {
					fullContent.WriteString(parts[0])
					d, _ := json.Marshal(gin.H{"content": parts[0]})
					fmt.Fprintf(c.Writer, "event: content\ndata: %s\n\n", d)
				}
				rawText = parts[1]
			}

			if inThinkTag {
				if strings.Contains(rawText, "</think>") {
					inThinkTag = false
					if !thinkingStart.IsZero() && thinkingDuration == 0 {
						thinkingDuration = time.Since(thinkingStart)
					}
					parts := strings.SplitN(rawText, "</think>", 2)
					if len(parts[0]) > 0 {
						fullReasoning.WriteString(parts[0])
						d, _ := json.Marshal(gin.H{
							"thinking": parts[0],
							"content":  parts[0],
						})
						fmt.Fprintf(c.Writer, "event: thinking\ndata: %s\n\n", d)
					}
					if len(parts[1]) > 0 {
						fullContent.WriteString(parts[1])
						d, _ := json.Marshal(gin.H{"content": parts[1]})
						fmt.Fprintf(c.Writer, "event: content\ndata: %s\n\n", d)
					}
				} else {
					fullReasoning.WriteString(rawText)
					d, _ := json.Marshal(gin.H{
						"thinking": rawText,
						"content":  rawText,
					})
					fmt.Fprintf(c.Writer, "event: thinking\ndata: %s\n\n", d)
				}
			} else {
				if !thinkingStart.IsZero() && thinkingDuration == 0 {
					thinkingDuration = time.Since(thinkingStart)
				}
				fullContent.WriteString(rawText)
				d, _ := json.Marshal(gin.H{"content": rawText})
				fmt.Fprintf(c.Writer, "event: content\ndata: %s\n\n", d)
			}
			flusher.Flush()
		}
	}

	totalLatency := time.Since(start)
	if fullReasoning.Len() > 0 && thinkingDuration == 0 {
		if !thinkingStart.IsZero() {
			thinkingDuration = time.Since(thinkingStart)
		} else {
			thinkingDuration = totalLatency
		}
	}

	// 7. Persist messages synchronously before emitting done
	h.saveMessagesSync(sessionUUID, userID, req.Messages, fullContent.String(), fullReasoning.String(), thinkingDuration.Milliseconds())

	// Emit done event
	doneBytes, _ := json.Marshal(gin.H{
		"done":                 true,
		"session_id":           uuidToString(sessionUUID),
		"total_chars":          fullContent.Len(),
		"latency_ms":           totalLatency.Milliseconds(),
		"ttft_ms":              ttft.Milliseconds(),
		"thinking_duration_ms": thinkingDuration.Milliseconds(),
	})
	fmt.Fprintf(c.Writer, "event: done\ndata: %s\n\n", doneBytes)
	flusher.Flush()

	promptTokens := int32(len(messages) * 15)
	completionTokens := int32(fullContent.Len()/4) + 1
	go func() {
		_ = h.recorder.Record(context.Background(), monitor.InvocationMetrics{
			UserID:           toPgUUID(userID),
			SkillCode:        req.SkillCode,
			ModelName:        targetModel,
			Provider:         targetChannel.Provider,
			PromptTokens:     promptTokens,
			CompletionTokens: completionTokens,
			TotalLatencyMs:   totalLatency.Milliseconds(),
			TtftMs:           ttft.Milliseconds(),
			StatusCode:       http.StatusOK,
		})
	}()
}

func (h *AIHandler) saveMessagesSync(sessionUUID pgtype.UUID, userID uuid.UUID, messages []ChatMessageInput, finalContent, finalReasoning string, thinkingDurationMs int64) {
	if !sessionUUID.Valid {
		return
	}
	bgCtx := context.Background()
	// Save last user message
	if len(messages) > 0 {
		lastMsg := messages[len(messages)-1]
		if strings.ToLower(lastMsg.Role) == "user" {
			_, _ = h.queries.CreateAIMessage(bgCtx, sqlc.CreateAIMessageParams{
				SessionID:          sessionUUID,
				Role:               "user",
				Content:            lastMsg.Content,
				ReasoningContent:   "",
				ToolCalls:          []byte("[]"),
				ThinkingDurationMs: pgtype.Int8{Valid: false},
			})
		}
	}
	// Save assistant message
	if finalContent != "" || finalReasoning != "" {
		var dur pgtype.Int8
		if thinkingDurationMs > 0 {
			dur = pgtype.Int8{Int64: thinkingDurationMs, Valid: true}
		}
		_, _ = h.queries.CreateAIMessage(bgCtx, sqlc.CreateAIMessageParams{
			SessionID:          sessionUUID,
			Role:               "assistant",
			Content:            finalContent,
			ReasoningContent:   finalReasoning,
			ToolCalls:          []byte("[]"),
			ThinkingDurationMs: dur,
		})
	}
	_ = h.queries.TouchAISession(bgCtx, sqlc.TouchAISessionParams{
		ID:     sessionUUID,
		UserID: toPgUUID(userID),
	})
}

func uuidToString(u pgtype.UUID) string {
	if !u.Valid {
		return ""
	}
	id, err := uuid.FromBytes(u.Bytes[:])
	if err != nil {
		return ""
	}
	return id.String()
}

func sendSSEError(w http.ResponseWriter, flusher http.Flusher, msg string) {
	errPayload, _ := json.Marshal(gin.H{
		"error": msg,
		"done":  true,
	})
	fmt.Fprintf(w, "event: error\ndata: %s\n\n", errPayload)
	flusher.Flush()
}
