package tools

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"workbuddy-server/internal/database/sqlc"
)

func TestContextUserID(t *testing.T) {
	ctx := context.Background()
	_, err := GetUserID(ctx)
	if err != ErrMissingUserContext {
		t.Fatalf("expected ErrMissingUserContext, got %v", err)
	}

	testUID := uuid.New()
	ctx = WithUserID(ctx, testUID)
	uid, err := GetUserID(ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if uid != testUID {
		t.Fatalf("expected %v, got %v", testUID, uid)
	}
}

func TestToolsRegistrySchema(t *testing.T) {
	reg, err := NewRegistry(&sqlc.Queries{}, nil)
	if err != nil {
		t.Fatalf("failed to initialize tools registry: %v", err)
	}

	tools := reg.Tools()
	if len(tools) != 10 {
		t.Fatalf("expected 10 registered tools, got %d", len(tools))
	}

	ctx := context.Background()
	for _, toolItem := range tools {
		info, err := toolItem.Info(ctx)
		if err != nil {
			t.Fatalf("failed to get info for tool: %v", err)
		}
		if info.Name == "" {
			t.Errorf("tool has empty name")
		}
		if info.Desc == "" {
			t.Errorf("tool %s has empty description", info.Name)
		}
	}
}
