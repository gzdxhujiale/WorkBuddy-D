package gateway_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/jackc/pgx/v5/pgtype"
	"workbuddy-server/internal/ai/gateway"
	"workbuddy-server/internal/database/sqlc"
)

func TestNormalizeBaseURL(t *testing.T) {
	tests := []struct {
		provider string
		raw      string
		expected string
	}{
		{"openai", "", "https://api.openai.com/v1"},
		{"deepseek", "", "https://api.deepseek.com/v1"},
		{"ollama", "", "http://localhost:11434/v1"},
		{"custom", "https://my-proxy.com/v1/", "https://my-proxy.com/v1"},
		{"siliconflow", "", "https://api.siliconflow.cn/v1"},
	}

	for _, tc := range tests {
		actual := gateway.NormalizeBaseURL(tc.provider, tc.raw)
		if actual != tc.expected {
			t.Errorf("NormalizeBaseURL(%q, %q) = %q; want %q", tc.provider, tc.raw, actual, tc.expected)
		}
	}
}

func TestParseModels(t *testing.T) {
	raw := []byte(`["deepseek-chat", "deepseek-coder"]`)
	models := gateway.ParseModels(raw)
	if len(models) != 2 || models[0] != "deepseek-chat" || models[1] != "deepseek-coder" {
		t.Fatalf("unexpected parsed models: %v", models)
	}

	empty := gateway.ParseModels([]byte(""))
	if len(empty) != 0 {
		t.Fatalf("expected empty slice, got: %v", empty)
	}
}

func TestPingChannel(t *testing.T) {
	// Mock upstream server
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v1/models" {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"data": []}`))
			return
		}
		http.NotFound(w, r)
	}))
	defer ts.Close()

	factory := gateway.NewFactory()
	ch := &sqlc.AiChannel{
		Provider: "custom",
		BaseUrl:  ts.URL + "/v1",
		ApiKey:   "sk-test",
	}

	latency, err := factory.PingChannel(context.Background(), ch)
	if err != nil {
		t.Fatalf("expected ping success, got: %v", err)
	}
	if latency <= 0 {
		t.Fatalf("expected positive latency, got: %v", latency)
	}

	// Test failing upstream
	badServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer badServer.Close()

	badCh := &sqlc.AiChannel{
		Provider: "custom",
		BaseUrl:  badServer.URL,
		ApiKey:   "sk-test",
	}
	_, err = factory.PingChannel(context.Background(), badCh)
	if err == nil {
		t.Fatal("expected error on 500 status, got nil")
	}
}

type mockQuerier struct {
	sqlc.Querier
	channels []sqlc.AiChannel
}

func (m *mockQuerier) GetActiveAIChannels(ctx context.Context, userID pgtype.UUID) ([]sqlc.AiChannel, error) {
	return m.channels, nil
}

func TestRouter_ResolveCandidates(t *testing.T) {
	mockQ := &mockQuerier{
		channels: []sqlc.AiChannel{
			{
				Name:     "DeepSeek Primary",
				Provider: "deepseek",
				Priority: 10,
				Models:   []byte(`["deepseek-chat"]`),
				IsActive: true,
			},
			{
				Name:     "Ollama Local",
				Provider: "ollama",
				Priority: 5,
				Models:   []byte(`["qwen2.5:7b"]`),
				IsActive: true,
			},
		},
	}

	router := gateway.NewRouter(mockQ, gateway.NewFactory())
	candidates, err := router.ResolveCandidates(context.Background(), pgtype.UUID{}, "deepseek-chat")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(candidates) != 1 || candidates[0].Channel.Name != "DeepSeek Primary" {
		t.Fatalf("expected 1 candidate 'DeepSeek Primary', got: %v", candidates)
	}

	// Test fallback when model not in explicit list
	fallbackCandidates, err := router.ResolveCandidates(context.Background(), pgtype.UUID{}, "unknown-model")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(fallbackCandidates) != 2 {
		t.Fatalf("expected fallback to return all 2 channels, got: %d", len(fallbackCandidates))
	}
}
