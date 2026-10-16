package monitor

import (
	"context"
	"log/slog"
	"time"

	"github.com/cloudwego/eino/callbacks"
	"github.com/cloudwego/eino/components/model"
	"github.com/jackc/pgx/v5/pgtype"
	"workbuddy-server/internal/database/sqlc"
)

// InvocationMetrics contains all observable metrics for a single AI invocation.
type InvocationMetrics struct {
	UserID           pgtype.UUID `json:"user_id"`
	SkillCode        string      `json:"skill_code"`
	ModelName        string      `json:"model_name"`
	Provider         string      `json:"provider"`
	PromptTokens     int32       `json:"prompt_tokens"`
	CompletionTokens int32       `json:"completion_tokens"`
	TotalLatencyMs   int64       `json:"total_latency_ms"`
	TtftMs           int64       `json:"ttft_ms"`
	StatusCode       int32       `json:"status_code"`
	ErrorMsg         string      `json:"error_msg"`
}

// Recorder persists invocation metrics to the database.
type Recorder struct {
	queries sqlc.Querier
}

func NewRecorder(queries sqlc.Querier) *Recorder {
	return &Recorder{queries: queries}
}

// Record saves the metrics log into ai_invocation_logs.
func (r *Recorder) Record(ctx context.Context, m InvocationMetrics) error {
	_, err := r.queries.CreateAIInvocationLog(ctx, sqlc.CreateAIInvocationLogParams{
		UserID:           m.UserID,
		SkillCode:        m.SkillCode,
		ModelName:        m.ModelName,
		Provider:         m.Provider,
		PromptTokens:     m.PromptTokens,
		CompletionTokens: m.CompletionTokens,
		TotalLatencyMs:   m.TotalLatencyMs,
		TtftMs:           m.TtftMs,
		StatusCode:       m.StatusCode,
		ErrorMsg:         m.ErrorMsg,
	})
	if err != nil {
		slog.Error("failed to persist AI invocation log", slog.Any("error", err))
		return err
	}

	slog.Info("persisted AI invocation log",
		slog.String("skill", m.SkillCode),
		slog.String("model", m.ModelName),
		slog.Int64("latency_ms", m.TotalLatencyMs),
		slog.Int64("ttft_ms", m.TtftMs),
		slog.Int("tokens", int(m.PromptTokens+m.CompletionTokens)),
	)
	return nil
}

// Tracker manages lifecycle timings for streaming and non-streaming calls.
type Tracker struct {
	startTime      time.Time
	firstTokenTime time.Time
	metrics        InvocationMetrics
	recorder       *Recorder
}

func NewTracker(recorder *Recorder, userID pgtype.UUID, skillCode, modelName, provider string) *Tracker {
	return &Tracker{
		startTime: time.Now(),
		metrics: InvocationMetrics{
			UserID:     userID,
			SkillCode:  skillCode,
			ModelName:  modelName,
			Provider:   provider,
			StatusCode: 200,
		},
		recorder: recorder,
	}
}

// MarkFirstToken notes the timestamp when the first stream chunk was delivered.
func (t *Tracker) MarkFirstToken() {
	if t.firstTokenTime.IsZero() {
		t.firstTokenTime = time.Now()
		t.metrics.TtftMs = time.Since(t.startTime).Milliseconds()
	}
}

// SetTokens assigns token usage counts.
func (t *Tracker) SetTokens(promptTokens, completionTokens int32) {
	t.metrics.PromptTokens = promptTokens
	t.metrics.CompletionTokens = completionTokens
}

// Complete ends the timer, computes total latency, and records the metrics.
func (t *Tracker) Complete(ctx context.Context, err error) {
	t.metrics.TotalLatencyMs = time.Since(t.startTime).Milliseconds()
	if t.metrics.TtftMs == 0 {
		t.metrics.TtftMs = t.metrics.TotalLatencyMs
	}
	if err != nil {
		t.metrics.StatusCode = 500
		t.metrics.ErrorMsg = err.Error()
	}
	if t.recorder != nil {
		_ = t.recorder.Record(ctx, t.metrics)
	}
}

// CreateEinoCallbackHandler creates an Eino Callback Handler to observe model execution.
func CreateEinoCallbackHandler(tracker *Tracker) callbacks.Handler {
	return callbacks.NewHandlerBuilder().
		OnEndFn(func(ctx context.Context, info *callbacks.RunInfo, output callbacks.CallbackOutput) context.Context {
			if tracker != nil {
				mo := model.ConvCallbackOutput(output)
				if mo != nil && mo.Message != nil && mo.Message.ResponseMeta != nil && mo.Message.ResponseMeta.Usage != nil {
					tracker.SetTokens(
						int32(mo.Message.ResponseMeta.Usage.PromptTokens),
						int32(mo.Message.ResponseMeta.Usage.CompletionTokens),
					)
				}
			}
			return ctx
		}).
		OnErrorFn(func(ctx context.Context, info *callbacks.RunInfo, err error) context.Context {
			if tracker != nil {
				tracker.metrics.StatusCode = 500
				tracker.metrics.ErrorMsg = err.Error()
			}
			return ctx
		}).
		Build()
}
