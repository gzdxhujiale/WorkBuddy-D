package gateway

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/cloudwego/eino-ext/components/model/openai"
	"github.com/cloudwego/eino/components/model"
	"github.com/google/uuid"
	"workbuddy-server/internal/database/sqlc"
)

// ChannelDTO represents a user-facing AI channel configuration.
type ChannelDTO struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Provider  string    `json:"provider"`
	BaseURL   string    `json:"base_url"`
	APIKey    string    `json:"api_key,omitempty"`
	Models    []string  `json:"models"`
	IsActive  bool      `json:"is_active"`
	Priority  int32     `json:"priority"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ParseModels converts jsonb raw models into a string slice.
func ParseModels(raw []byte) []string {
	if len(raw) == 0 {
		return []string{}
	}
	var res []string
	if err := json.Unmarshal(raw, &res); err != nil {
		return []string{}
	}
	return res
}

// NormalizeBaseURL ensures a clean base URL with standard protocol and no trailing endpoint.
func NormalizeBaseURL(provider, rawURL string) string {
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" {
		switch strings.ToLower(provider) {
		case "deepseek":
			return "https://api.deepseek.com/v1"
		case "openai":
			return "https://api.openai.com/v1"
		case "ollama":
			return "http://localhost:11434/v1"
		case "siliconflow":
			return "https://api.siliconflow.cn/v1"
		default:
			return "https://api.openai.com/v1"
		}
	}
	u := strings.TrimRight(rawURL, "/")
	// If user pasted full endpoint (e.g. https://.../v1/chat/completions), strip /chat/completions
	lower := strings.ToLower(u)
	if strings.HasSuffix(lower, "/chat/completions") {
		u = u[:len(u)-len("/chat/completions")]
	}
	return strings.TrimRight(u, "/")
}

type customTransport struct {
	base    http.RoundTripper
	session string
}

func (t *customTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	clone := req.Clone(req.Context())
	if clone.Header.Get("User-Agent") == "" {
		clone.Header.Set("User-Agent", "WorkBuddy/1.0")
	}
	if clone.Header.Get("x-opencode-session") == "" && t.session != "" {
		clone.Header.Set("x-opencode-session", t.session)
	}
	if clone.Header.Get("x-session-id") == "" && t.session != "" {
		clone.Header.Set("x-session-id", t.session)
	}
	base := t.base
	if base == nil {
		base = http.DefaultTransport
	}
	return base.RoundTrip(clone)
}

// Factory builds Eino ChatModel instances from channel configuration.
type Factory struct{}

func NewFactory() *Factory {
	return &Factory{}
}

// CreateChatModel initializes an Eino OpenAI-compatible ChatModel for a channel.
func (f *Factory) CreateChatModel(ctx context.Context, ch *sqlc.AiChannel, modelName string) (model.ChatModel, error) {
	baseURL := NormalizeBaseURL(ch.Provider, ch.BaseUrl)
	apiKey := strings.TrimSpace(ch.ApiKey)
	sessionID := uuid.New().String()

	httpClient := &http.Client{
		Timeout: 60 * time.Second,
		Transport: &customTransport{
			base:    http.DefaultTransport,
			session: sessionID,
		},
	}

	cfg := &openai.ChatModelConfig{
		BaseURL:    baseURL,
		APIKey:     apiKey,
		Model:      modelName,
		HTTPClient: httpClient,
	}

	cm, err := openai.NewChatModel(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("init eino chat model: %w", err)
	}

	return cm, nil
}

// PingChannel tests connectivity to the channel endpoint and returns round-trip latency.
func (f *Factory) PingChannel(ctx context.Context, ch *sqlc.AiChannel) (time.Duration, error) {
	baseURL := NormalizeBaseURL(ch.Provider, ch.BaseUrl)
	apiKey := strings.TrimSpace(ch.ApiKey)
	sessionID := uuid.New().String()

	client := &http.Client{
		Timeout: 6 * time.Second,
		Transport: &customTransport{
			base:    http.DefaultTransport,
			session: sessionID,
		},
	}

	// 1. Try GET /models (standard OpenAI endpoint)
	testURL := baseURL + "/models"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, testURL, nil)
	if err == nil {
		if apiKey != "" {
			req.Header.Set("Authorization", "Bearer "+apiKey)
		}
		start := time.Now()
		resp, err := client.Do(req)
		if err == nil {
			defer resp.Body.Close()
			latency := time.Since(start)
			if resp.StatusCode < 400 || resp.StatusCode == http.StatusUnauthorized {
				return latency, nil
			}
		}
	}

	// 2. Fallback probe: Probe /chat/completions directly (handles providers that only implement chat)
	chatURL := baseURL + "/chat/completions"
	models := ParseModels(ch.Models)
	probeModel := "default"
	if len(models) > 0 && models[0] != "" {
		probeModel = models[0]
	}
	probeBody := fmt.Sprintf(`{"model":%q,"messages":[{"role":"user","content":"ping"}],"max_tokens":1}`, probeModel)
	chatReq, err := http.NewRequestWithContext(ctx, http.MethodPost, chatURL, bytes.NewBufferString(probeBody))
	if err != nil {
		return 0, fmt.Errorf("create ping probe request: %w", err)
	}
	chatReq.Header.Set("Content-Type", "application/json")
	if apiKey != "" {
		chatReq.Header.Set("Authorization", "Bearer "+apiKey)
	}

	start := time.Now()
	resp, err := client.Do(chatReq)
	latency := time.Since(start)
	if err != nil {
		return latency, fmt.Errorf("ping connection error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 500 {
		return latency, fmt.Errorf("upstream responded with status: %d", resp.StatusCode)
	}

	return latency, nil
}
