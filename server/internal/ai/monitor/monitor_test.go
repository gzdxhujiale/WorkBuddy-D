package monitor_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/cloudwego/eino/callbacks"
	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
	"github.com/jackc/pgx/v5/pgtype"
	"workbuddy-server/internal/ai/monitor"
	"workbuddy-server/internal/database/sqlc"
)

type mockMonitorQuerier struct {
	sqlc.Querier
	insertedLogs []sqlc.CreateAIInvocationLogParams
}

func (m *mockMonitorQuerier) CreateAIInvocationLog(ctx context.Context, arg sqlc.CreateAIInvocationLogParams) (sqlc.AiInvocationLog, error) {
	m.insertedLogs = append(m.insertedLogs, arg)
	return sqlc.AiInvocationLog{
		ID:               pgtype.UUID{},
		UserID:           arg.UserID,
		SkillCode:        arg.SkillCode,
		ModelName:        arg.ModelName,
		Provider:         arg.Provider,
		PromptTokens:     arg.PromptTokens,
		CompletionTokens: arg.CompletionTokens,
		TotalLatencyMs:   arg.TotalLatencyMs,
		TtftMs:           arg.TtftMs,
		StatusCode:       arg.StatusCode,
		ErrorMsg:         arg.ErrorMsg,
	}, nil
}

func TestTrackerAndRecorder(t *testing.T) {
	mockQ := &mockMonitorQuerier{}
	rec := monitor.NewRecorder(mockQ)

	tracker := monitor.NewTracker(rec, pgtype.UUID{}, "daily_review", "deepseek-chat", "deepseek")
	time.Sleep(10 * time.Millisecond)
	tracker.MarkFirstToken()
	tracker.SetTokens(150, 250)
	time.Sleep(10 * time.Millisecond)
	tracker.Complete(context.Background(), nil)

	if len(mockQ.insertedLogs) != 1 {
		t.Fatalf("expected 1 invocation log, got %d", len(mockQ.insertedLogs))
	}

	log := mockQ.insertedLogs[0]
	if log.SkillCode != "daily_review" || log.ModelName != "deepseek-chat" {
		t.Errorf("unexpected skill or model: %v", log)
	}
	if log.PromptTokens != 150 || log.CompletionTokens != 250 {
		t.Errorf("expected 150/250 tokens, got %d/%d", log.PromptTokens, log.CompletionTokens)
	}
	if log.TtftMs <= 0 || log.TotalLatencyMs <= 0 {
		t.Errorf("expected positive latencies, got ttft=%d, total=%d", log.TtftMs, log.TotalLatencyMs)
	}
	if log.StatusCode != 200 {
		t.Errorf("expected status 200, got %d", log.StatusCode)
	}

	// Test error recording
	errTracker := monitor.NewTracker(rec, pgtype.UUID{}, "task_breakdown", "gpt-4o", "openai")
	errTracker.Complete(context.Background(), errors.New("upstream timeout"))

	if len(mockQ.insertedLogs) != 2 {
		t.Fatalf("expected 2 logs, got %d", len(mockQ.insertedLogs))
	}
	errLog := mockQ.insertedLogs[1]
	if errLog.StatusCode != 500 || errLog.ErrorMsg != "upstream timeout" {
		t.Errorf("expected status 500 and timeout message, got: %v", errLog)
	}
}

func TestEinoCallbackHandler(t *testing.T) {
	mockQ := &mockMonitorQuerier{}
	rec := monitor.NewRecorder(mockQ)
	tracker := monitor.NewTracker(rec, pgtype.UUID{}, "test", "test-model", "test-prov")

	handler := monitor.CreateEinoCallbackHandler(tracker)
	if handler == nil {
		t.Fatal("expected non-nil handler")
	}

	// Test callback execution
	ctx := context.Background()
	runInfo := &callbacks.RunInfo{Name: "chat_model"}
	out := &model.CallbackOutput{
		Message: &schema.Message{
			ResponseMeta: &schema.ResponseMeta{
				Usage: &schema.TokenUsage{
					PromptTokens:     88,
					CompletionTokens: 122,
				},
			},
		},
	}

	ctx = handler.OnEnd(ctx, runInfo, out)
	tracker.Complete(ctx, nil)

	if len(mockQ.insertedLogs) != 1 {
		t.Fatalf("expected 1 log from callback, got %d", len(mockQ.insertedLogs))
	}
	if mockQ.insertedLogs[0].PromptTokens != 88 || mockQ.insertedLogs[0].CompletionTokens != 122 {
		t.Errorf("expected tokens 88/122 from callback, got %d/%d",
			mockQ.insertedLogs[0].PromptTokens, mockQ.insertedLogs[0].CompletionTokens)
	}
}
