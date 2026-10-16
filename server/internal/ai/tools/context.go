package tools

import (
	"context"
	"errors"

	"github.com/google/uuid"
)

type userContextKey struct{}

var (
	// UserIDKey is the context key for tenant user ID propagation.
	UserIDKey = userContextKey{}

	// ErrMissingUserContext occurs when a tool is executed without an authenticated user in context.
	ErrMissingUserContext = errors.New("unauthorized: missing user context in AI tool execution")
)

// WithUserID binds a user UUID to context for tenant isolation.
func WithUserID(ctx context.Context, userID uuid.UUID) context.Context {
	return context.WithValue(ctx, UserIDKey, userID)
}

// GetUserID retrieves the authenticated user UUID from context.
func GetUserID(ctx context.Context) (uuid.UUID, error) {
	val := ctx.Value(UserIDKey)
	if val == nil {
		return uuid.Nil, ErrMissingUserContext
	}
	uid, ok := val.(uuid.UUID)
	if !ok || uid == uuid.Nil {
		return uuid.Nil, ErrMissingUserContext
	}
	return uid, nil
}
