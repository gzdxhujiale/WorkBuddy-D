package gateway

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"slices"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
	"github.com/jackc/pgx/v5/pgtype"
	"workbuddy-server/internal/database/sqlc"
)

var (
	ErrNoActiveChannels = errors.New("no active AI channels configured")
	ErrAllChannelsFailed = errors.New("all candidate AI channels failed in fallback chain")
)

// Router orchestrates dynamic channel selection and failover.
type Router struct {
	queries sqlc.Querier
	factory *Factory
}

func NewRouter(queries sqlc.Querier, factory *Factory) *Router {
	return &Router{
		queries: queries,
		factory: factory,
	}
}

// CandidateChannel holds a channel along with its resolved model name.
type CandidateChannel struct {
	Channel   sqlc.AiChannel
	ModelName string
}

// ResolveCandidates fetches active channels for the user that can serve the requested model.
func (r *Router) ResolveCandidates(ctx context.Context, userID pgtype.UUID, requestedModel string) ([]CandidateChannel, error) {
	channels, err := r.queries.GetActiveAIChannels(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("fetch active channels: %w", err)
	}
	if len(channels) == 0 {
		return nil, ErrNoActiveChannels
	}

	var candidates []CandidateChannel
	for _, ch := range channels {
		models := ParseModels(ch.Models)
		// If the channel has explicit models, check if it contains the requested one
		if len(models) == 0 || requestedModel == "" || slices.Contains(models, requestedModel) {
			mName := requestedModel
			if mName == "" && len(models) > 0 {
				mName = models[0]
			}
			if mName == "" {
				mName = "gpt-4o"
			}
			candidates = append(candidates, CandidateChannel{
				Channel:   ch,
				ModelName: mName,
			})
		}
	}

	// Fallback to all channels if none matched the exact model
	if len(candidates) == 0 {
		for _, ch := range channels {
			models := ParseModels(ch.Models)
			mName := requestedModel
			if len(models) > 0 {
				mName = models[0]
			}
			candidates = append(candidates, CandidateChannel{
				Channel:   ch,
				ModelName: mName,
			})
		}
	}

	return candidates, nil
}

// ExecuteWithFallback iterates through candidate channels in priority order until one succeeds.
func (r *Router) ExecuteWithFallback(
	ctx context.Context,
	userID pgtype.UUID,
	requestedModel string,
	fn func(ctx context.Context, cm model.ChatModel, ch sqlc.AiChannel, modelName string) (*schema.Message, error),
) (*schema.Message, *sqlc.AiChannel, error) {
	candidates, err := r.ResolveCandidates(ctx, userID, requestedModel)
	if err != nil {
		return nil, nil, err
	}

	var lastErr error
	for i, c := range candidates {
		cm, err := r.factory.CreateChatModel(ctx, &c.Channel, c.ModelName)
		if err != nil {
			slog.Warn("failed to initialize model for channel, trying next",
				slog.String("channel_id", c.Channel.ID.String()),
				slog.String("channel_name", c.Channel.Name),
				slog.Any("error", err),
			)
			lastErr = err
			continue
		}

		slog.Info("attempting model invocation on channel",
			slog.Int("attempt", i+1),
			slog.Int("total_candidates", len(candidates)),
			slog.String("channel_name", c.Channel.Name),
			slog.String("model", c.ModelName),
		)

		msg, err := fn(ctx, cm, c.Channel, c.ModelName)
		if err == nil {
			return msg, &c.Channel, nil
		}

		slog.Warn("channel invocation failed, falling back to next candidate",
			slog.String("channel_name", c.Channel.Name),
			slog.String("model", c.ModelName),
			slog.Any("error", err),
		)
		lastErr = err
	}

	return nil, nil, fmt.Errorf("%w: %v", ErrAllChannelsFailed, lastErr)
}
