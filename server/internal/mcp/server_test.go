package mcp

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"workbuddy-server/internal/database/sqlc"
)

type mockQuerierForMCP struct {
	sqlc.Querier
	tasks    []sqlc.TimeManagementTask
	projects []sqlc.Project
	reviews  []sqlc.DailyReview
}

func (m *mockQuerierForMCP) ListTasks(ctx context.Context, userID pgtype.UUID) ([]sqlc.TimeManagementTask, error) {
	return m.tasks, nil
}

func (m *mockQuerierForMCP) CreateTask(ctx context.Context, arg sqlc.CreateTaskParams) (sqlc.TimeManagementTask, error) {
	t := sqlc.TimeManagementTask{
		ID:          arg.ID,
		UserID:      arg.UserID,
		Title:       arg.Title,
		Quadrant:    arg.Quadrant,
		Completed:   arg.Completed,
		Priority:    arg.Priority,
		Description: arg.Description,
	}
	m.tasks = append(m.tasks, t)
	return t, nil
}

func (m *mockQuerierForMCP) ListProjects(ctx context.Context, userID pgtype.UUID) ([]sqlc.Project, error) {
	return m.projects, nil
}

func TestMCPServerRegistrationAndCall(t *testing.T) {
	testUID := uuid.New()
	getUserID := func(ctx context.Context) (uuid.UUID, error) {
		return testUID, nil
	}

	mockQ := &mockQuerierForMCP{}
	s := NewMCPServer(mockQ, nil, getUserID)

	tools := s.ListTools()
	if len(tools) < 8 {
		t.Fatalf("expected at least 8 MCP tools registered, got %d", len(tools))
	}

	toolNames := make(map[string]bool)
	var createTaskHandler server.ToolHandlerFunc
	for _, st := range tools {
		toolNames[st.Tool.Name] = true
		if st.Tool.Name == "workbuddy_create_task" {
			createTaskHandler = st.Handler
		}
	}

	requiredTools := []string{
		"workbuddy_list_tasks",
		"workbuddy_create_task",
		"workbuddy_update_task",
		"workbuddy_delete_task",
		"workbuddy_list_projects",
		"workbuddy_create_project",
		"workbuddy_get_daily_review",
		"workbuddy_upsert_daily_review",
	}

	for _, reqName := range requiredTools {
		if !toolNames[reqName] {
			t.Errorf("expected tool %s to be registered", reqName)
		}
	}

	if createTaskHandler == nil {
		t.Fatalf("workbuddy_create_task handler not found")
	}

	// Test calling workbuddy_create_task
	ctx := context.Background()
	req := mcp.CallToolRequest{
		Request: mcp.Request{
			Method: "tools/call",
		},
		Params: mcp.CallToolParams{
			Name: "workbuddy_create_task",
			Arguments: map[string]any{
				"title":    "MCP Automated Task",
				"quadrant": "Q1_URGENT_IMPORTANT",
				"priority": "high",
			},
		},
	}

	res, err := createTaskHandler(ctx, req)
	if err != nil {
		t.Fatalf("unexpected error calling tool: %v", err)
	}

	if res.IsError {
		t.Fatalf("tool returned error result: %+v", res)
	}

	if len(mockQ.tasks) != 1 {
		t.Fatalf("expected 1 task created, got %d", len(mockQ.tasks))
	}
	if mockQ.tasks[0].Title != "MCP Automated Task" {
		t.Errorf("expected title 'MCP Automated Task', got %s", mockQ.tasks[0].Title)
	}
}
