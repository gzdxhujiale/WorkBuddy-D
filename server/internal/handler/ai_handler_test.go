package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"workbuddy-server/internal/ai/gateway"
	"workbuddy-server/internal/ai/monitor"
	"workbuddy-server/internal/database/sqlc"
	"workbuddy-server/internal/handler"
)

type mockAIQuerier struct {
	sqlc.Querier
	channels []sqlc.AiChannel
	logs     []sqlc.AiInvocationLog
	sessions []sqlc.AiSession
	messages []sqlc.AiMessage
}

func (m *mockAIQuerier) CreateAISession(ctx context.Context, arg sqlc.CreateAISessionParams) (sqlc.AiSession, error) {
	s := sqlc.AiSession{
		ID:        pgtype.UUID{Bytes: uuid.New(), Valid: true},
		UserID:    arg.UserID,
		Title:     arg.Title,
		SkillCode: arg.SkillCode,
		ModelName: arg.ModelName,
		IsPinned:  arg.IsPinned,
		CreatedAt: pgtype.Timestamptz{Time: time.Now(), Valid: true},
		UpdatedAt: pgtype.Timestamptz{Time: time.Now(), Valid: true},
	}
	m.sessions = append([]sqlc.AiSession{s}, m.sessions...)
	return s, nil
}

func (m *mockAIQuerier) GetAISessionByID(ctx context.Context, arg sqlc.GetAISessionByIDParams) (sqlc.AiSession, error) {
	for _, s := range m.sessions {
		if s.ID == arg.ID && s.UserID == arg.UserID {
			return s, nil
		}
	}
	return sqlc.AiSession{}, pgtype.ErrScanTargetTypeChanged
}

func (m *mockAIQuerier) ListAISessions(ctx context.Context, userID pgtype.UUID) ([]sqlc.AiSession, error) {
	var userSessions []sqlc.AiSession
	for _, s := range m.sessions {
		if s.UserID == userID {
			userSessions = append(userSessions, s)
		}
	}
	return userSessions, nil
}

func (m *mockAIQuerier) UpdateAISession(ctx context.Context, arg sqlc.UpdateAISessionParams) (sqlc.AiSession, error) {
	for i, s := range m.sessions {
		if s.ID == arg.ID && s.UserID == arg.UserID {
			m.sessions[i].Title = arg.Title
			m.sessions[i].SkillCode = arg.SkillCode
			m.sessions[i].ModelName = arg.ModelName
			m.sessions[i].IsPinned = arg.IsPinned
			m.sessions[i].UpdatedAt = pgtype.Timestamptz{Time: time.Now(), Valid: true}
			return m.sessions[i], nil
		}
	}
	return sqlc.AiSession{}, pgtype.ErrScanTargetTypeChanged
}

func (m *mockAIQuerier) DeleteAISession(ctx context.Context, arg sqlc.DeleteAISessionParams) error {
	var remaining []sqlc.AiSession
	for _, s := range m.sessions {
		if !(s.ID == arg.ID && s.UserID == arg.UserID) {
			remaining = append(remaining, s)
		}
	}
	m.sessions = remaining
	return nil
}

func (m *mockAIQuerier) TouchAISession(ctx context.Context, arg sqlc.TouchAISessionParams) error {
	for i, s := range m.sessions {
		if s.ID == arg.ID && s.UserID == arg.UserID {
			m.sessions[i].UpdatedAt = pgtype.Timestamptz{Time: time.Now(), Valid: true}
			return nil
		}
	}
	return nil
}

func (m *mockAIQuerier) CreateAIMessage(ctx context.Context, arg sqlc.CreateAIMessageParams) (sqlc.AiMessage, error) {
	msg := sqlc.AiMessage{
		ID:                 pgtype.UUID{Bytes: uuid.New(), Valid: true},
		SessionID:          arg.SessionID,
		Role:               arg.Role,
		Content:            arg.Content,
		ReasoningContent:   arg.ReasoningContent,
		ToolCalls:          arg.ToolCalls,
		CreatedAt:          pgtype.Timestamptz{Time: time.Now(), Valid: true},
		ThinkingDurationMs: arg.ThinkingDurationMs,
	}
	m.messages = append(m.messages, msg)
	return msg, nil
}

func (m *mockAIQuerier) ListAIMessagesBySession(ctx context.Context, sessionID pgtype.UUID) ([]sqlc.AiMessage, error) {
	var result []sqlc.AiMessage
	for _, msg := range m.messages {
		if msg.SessionID == sessionID {
			result = append(result, msg)
		}
	}
	return result, nil
}

func (m *mockAIQuerier) DeleteAIMessagesBySession(ctx context.Context, sessionID pgtype.UUID) error {
	var remaining []sqlc.AiMessage
	for _, msg := range m.messages {
		if msg.SessionID != sessionID {
			remaining = append(remaining, msg)
		}
	}
	m.messages = remaining
	return nil
}

func (m *mockAIQuerier) ListAIChannels(ctx context.Context, userID pgtype.UUID) ([]sqlc.AiChannel, error) {
	return m.channels, nil
}

func (m *mockAIQuerier) CreateAIChannel(ctx context.Context, arg sqlc.CreateAIChannelParams) (sqlc.AiChannel, error) {
	ch := sqlc.AiChannel{
		ID:        pgtype.UUID{Bytes: uuid.New(), Valid: true},
		UserID:    arg.UserID,
		Name:      arg.Name,
		Provider:  arg.Provider,
		BaseUrl:   arg.BaseUrl,
		ApiKey:    arg.ApiKey,
		Models:    arg.Models,
		IsActive:  arg.IsActive,
		Priority:  arg.Priority,
		CreatedAt: pgtype.Timestamptz{Time: time.Now(), Valid: true},
		UpdatedAt: pgtype.Timestamptz{Time: time.Now(), Valid: true},
	}
	m.channels = append(m.channels, ch)
	return ch, nil
}

func (m *mockAIQuerier) UpdateAIChannel(ctx context.Context, arg sqlc.UpdateAIChannelParams) (sqlc.AiChannel, error) {
	for i, ch := range m.channels {
		if ch.ID == arg.ID {
			m.channels[i].Name = arg.Name
			m.channels[i].Provider = arg.Provider
			m.channels[i].BaseUrl = arg.BaseUrl
			m.channels[i].ApiKey = arg.ApiKey
			m.channels[i].Models = arg.Models
			m.channels[i].IsActive = arg.IsActive
			m.channels[i].Priority = arg.Priority
			return m.channels[i], nil
		}
	}
	return sqlc.AiChannel{}, nil
}

func (m *mockAIQuerier) DeleteAIChannel(ctx context.Context, arg sqlc.DeleteAIChannelParams) error {
	var filtered []sqlc.AiChannel
	for _, ch := range m.channels {
		if ch.ID != arg.ID {
			filtered = append(filtered, ch)
		}
	}
	m.channels = filtered
	return nil
}

func (m *mockAIQuerier) GetAIUsageMetrics(ctx context.Context, arg sqlc.GetAIUsageMetricsParams) (sqlc.GetAIUsageMetricsRow, error) {
	return sqlc.GetAIUsageMetricsRow{
		TotalCalls:            5,
		TotalPromptTokens:     1000,
		TotalCompletionTokens: 2000,
		AvgLatencyMs:          350,
		AvgTtftMs:             120,
	}, nil
}

func (m *mockAIQuerier) ListAIInvocationLogs(ctx context.Context, arg sqlc.ListAIInvocationLogsParams) ([]sqlc.AiInvocationLog, error) {
	return m.logs, nil
}

func setupAITestRouter(mockQ *mockAIQuerier, testUserID uuid.UUID) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	// Inject auth middleware mock
	r.Use(func(c *gin.Context) {
		c.Set("userID", testUserID)
		c.Next()
	})

	factory := gateway.NewFactory()
	router := gateway.NewRouter(mockQ, factory)
	rec := monitor.NewRecorder(mockQ)
	h := handler.NewAIHandler(mockQ, factory, router, rec, nil)

	r.GET("/api/v1/ai/channels", h.ListChannels)
	r.POST("/api/v1/ai/channels", h.CreateChannel)
	r.PUT("/api/v1/ai/channels/:id", h.UpdateChannel)
	r.DELETE("/api/v1/ai/channels/:id", h.DeleteChannel)
	r.GET("/api/v1/ai/metrics", h.GetMetrics)
	r.GET("/api/v1/ai/skills", h.ListSkills)

	r.GET("/api/v1/ai/sessions", h.ListSessions)
	r.POST("/api/v1/ai/sessions", h.CreateSession)
	r.GET("/api/v1/ai/sessions/:id", h.GetSession)
	r.PUT("/api/v1/ai/sessions/:id", h.UpdateSession)
	r.DELETE("/api/v1/ai/sessions/:id", h.DeleteSession)
	r.GET("/api/v1/ai/sessions/:id/messages", h.ListSessionMessages)

	return r
}

func TestAIHandler_ChannelsCRUD(t *testing.T) {
	testUserID := uuid.New()
	mockQ := &mockAIQuerier{}
	r := setupAITestRouter(mockQ, testUserID)

	// 1. List channels (initially empty)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/ai/channels", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	// 2. Create channel
	createBody := map[string]interface{}{
		"name":      "SiliconFlow DeepSeek",
		"provider":  "deepseek",
		"base_url":  "https://api.siliconflow.cn/v1",
		"api_key":   "sk-test-key",
		"models":    []string{"deepseek-ai/DeepSeek-V3"},
		"is_active": true,
		"priority":  10,
	}
	bodyBytes, _ := json.Marshal(createBody)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/ai/channels", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", w.Code, w.Body.String())
	}

	var createdCh gateway.ChannelDTO
	if err := json.Unmarshal(w.Body.Bytes(), &createdCh); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if createdCh.Name != "SiliconFlow DeepSeek" || createdCh.Priority != 10 {
		t.Errorf("unexpected created channel: %+v", createdCh)
	}

	// 3. Update channel
	updateBody := map[string]interface{}{
		"name":      "SiliconFlow DeepSeek Updated",
		"provider":  "deepseek",
		"base_url":  "https://api.siliconflow.cn/v1",
		"api_key":   "sk-test-key-updated",
		"models":    []string{"deepseek-ai/DeepSeek-V3", "deepseek-ai/DeepSeek-R1"},
		"is_active": true,
		"priority":  20,
	}
	updateBytes, _ := json.Marshal(updateBody)
	req = httptest.NewRequest(http.MethodPut, "/api/v1/ai/channels/"+createdCh.ID, bytes.NewReader(updateBytes))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on update, got %d: %s", w.Code, w.Body.String())
	}

	// 4. Get Metrics
	req = httptest.NewRequest(http.MethodGet, "/api/v1/ai/metrics", nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on metrics, got %d: %s", w.Code, w.Body.String())
	}

	// 5. Delete channel
	req = httptest.NewRequest(http.MethodDelete, "/api/v1/ai/channels/"+createdCh.ID, nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on delete, got %d", w.Code)
	}

	// 6. List Builtin Skills
	req = httptest.NewRequest(http.MethodGet, "/api/v1/ai/skills", nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on skills, got %d: %s", w.Code, w.Body.String())
	}
}

func TestAIHandler_SessionsCRUD(t *testing.T) {
	testUserID := uuid.New()
	mockQ := &mockAIQuerier{}
	r := setupAITestRouter(mockQ, testUserID)

	// 1. List sessions (initially empty)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/ai/sessions", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	// 2. Create session
	createBody := map[string]interface{}{
		"title":      "测试会话",
		"skill_code": "general",
		"model_name": "deepseek-ai/DeepSeek-V3",
		"is_pinned":  false,
	}
	bodyBytes, _ := json.Marshal(createBody)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/ai/sessions", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", w.Code, w.Body.String())
	}

	var createdSession sqlc.AiSession
	if err := json.Unmarshal(w.Body.Bytes(), &createdSession); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	sessionID := createdSession.ID.String()

	// 3. Get session by ID
	req = httptest.NewRequest(http.MethodGet, "/api/v1/ai/sessions/"+sessionID, nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on get session, got %d: %s", w.Code, w.Body.String())
	}

	// 4. Update session (pin & title)
	updateBody := map[string]interface{}{
		"title":      "置顶测试会话",
		"skill_code": "general",
		"model_name": "deepseek-ai/DeepSeek-R1",
		"is_pinned":  true,
	}
	updateBytes, _ := json.Marshal(updateBody)
	req = httptest.NewRequest(http.MethodPut, "/api/v1/ai/sessions/"+sessionID, bytes.NewReader(updateBytes))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on update session, got %d: %s", w.Code, w.Body.String())
	}

	// 5. List messages for session (initially empty)
	req = httptest.NewRequest(http.MethodGet, "/api/v1/ai/sessions/"+sessionID+"/messages", nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on list messages, got %d", w.Code)
	}

	// 5.1 Add message with ThinkingDurationMs and verify retrieval
	_, err := mockQ.CreateAIMessage(context.Background(), sqlc.CreateAIMessageParams{
		SessionID:          createdSession.ID,
		Role:               "assistant",
		Content:            "这是AI回复",
		ReasoningContent:   "这是思考过程",
		ToolCalls:          []byte("[]"),
		ThinkingDurationMs: pgtype.Int8{Int64: 3450, Valid: true},
	})
	if err != nil {
		t.Fatalf("failed to create test AI message: %v", err)
	}

	req = httptest.NewRequest(http.MethodGet, "/api/v1/ai/sessions/"+sessionID+"/messages", nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on list messages after insert, got %d", w.Code)
	}

	var msgList []map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &msgList); err != nil {
		t.Fatalf("failed to decode message list: %v", err)
	}
	if len(msgList) != 1 {
		t.Fatalf("expected 1 message, got %d", len(msgList))
	}
	if dur, ok := msgList[0]["thinking_duration_ms"].(float64); !ok || int64(dur) != 3450 {
		t.Errorf("expected thinking_duration_ms 3450, got %v", msgList[0]["thinking_duration_ms"])
	}

	// 6. Delete session
	req = httptest.NewRequest(http.MethodDelete, "/api/v1/ai/sessions/"+sessionID, nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on delete session, got %d", w.Code)
	}
}

