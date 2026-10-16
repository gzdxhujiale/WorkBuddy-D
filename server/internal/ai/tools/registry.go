package tools

import (
	"fmt"

	"github.com/cloudwego/eino/components/tool"
	"workbuddy-server/internal/database/sqlc"
	"workbuddy-server/internal/ws"
)

// Registry contains all instantiated Eino tools.
type Registry struct {
	tools []tool.BaseTool
}

// NewRegistry constructs and registers all domain tools for the AI agent.
func NewRegistry(queries sqlc.Querier, hub *ws.Hub) (*Registry, error) {
	listTasks, err := NewListTasksTool(queries)
	if err != nil {
		return nil, fmt.Errorf("init list_tasks: %w", err)
	}

	createTask, err := NewCreateTaskTool(queries, hub)
	if err != nil {
		return nil, fmt.Errorf("init create_task: %w", err)
	}

	updateTask, err := NewUpdateTaskTool(queries, hub)
	if err != nil {
		return nil, fmt.Errorf("init update_task: %w", err)
	}

	deleteTask, err := NewDeleteTaskTool(queries, hub)
	if err != nil {
		return nil, fmt.Errorf("init delete_task: %w", err)
	}

	listProjects, err := NewListProjectsTool(queries)
	if err != nil {
		return nil, fmt.Errorf("init list_projects: %w", err)
	}

	createProject, err := NewCreateProjectTool(queries, hub)
	if err != nil {
		return nil, fmt.Errorf("init create_project: %w", err)
	}

	listStages, err := NewListProjectStagesTool(queries)
	if err != nil {
		return nil, fmt.Errorf("init list_project_stages: %w", err)
	}

	getReview, err := NewGetDailyReviewTool(queries)
	if err != nil {
		return nil, fmt.Errorf("init get_daily_review: %w", err)
	}

	upsertReview, err := NewUpsertDailyReviewTool(queries, hub)
	if err != nil {
		return nil, fmt.Errorf("init upsert_daily_review: %w", err)
	}

	getActivities, err := NewGetTodayActivitiesTool(queries)
	if err != nil {
		return nil, fmt.Errorf("init get_today_activities: %w", err)
	}

	allTools := []tool.BaseTool{
		listTasks,
		createTask,
		updateTask,
		deleteTask,
		listProjects,
		createProject,
		listStages,
		getReview,
		upsertReview,
		getActivities,
	}

	return &Registry{tools: allTools}, nil
}

// Tools returns all registered tools as a slice of tool.BaseTool.
func (r *Registry) Tools() []tool.BaseTool {
	return r.tools
}
