package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"

	"workbuddy-server/internal/database/sqlc"
	"workbuddy-server/internal/ws"
)

type UserIDResolver func(ctx context.Context) (uuid.UUID, error)

// NewMCPServer constructs an MCP server exposing WorkBuddy domain operations as tools.
func NewMCPServer(queries sqlc.Querier, hub *ws.Hub, getUserID UserIDResolver) *server.MCPServer {
	s := server.NewMCPServer("workbuddy", "1.0.0")

	// 1. workbuddy_list_tasks
	listTasksTool := mcp.NewTool("workbuddy_list_tasks",
		mcp.WithDescription("List tasks in the user's 4-quadrants task center with optional filtering"),
		mcp.WithString("quadrant", mcp.Description("Optional quadrant: Q1_URGENT_IMPORTANT, Q2_NOT_URGENT_IMPORTANT, Q3_URGENT_NOT_IMPORTANT, Q4_NOT_URGENT_NOT_IMPORTANT")),
		mcp.WithBoolean("completed", mcp.Description("Optional filter by completion status (true/false)")),
	)
	s.AddTool(listTasksTool, func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := getUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError("unauthorized: " + err.Error()), nil
		}

		userUUID := pgtype.UUID{Bytes: userID, Valid: true}
		tasks, err := queries.ListTasks(ctx, userUUID)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("failed to list tasks: %v", err)), nil
		}

		var quadrantFilter string
		if q, ok := request.Params.Arguments.(map[string]any)["quadrant"].(string); ok {
			quadrantFilter = q
		}
		var completedFilter *bool
		if c, ok := request.Params.Arguments.(map[string]any)["completed"].(bool); ok {
			completedFilter = &c
		}

		var results []map[string]any
		for _, t := range tasks {
			if quadrantFilter != "" && t.Quadrant != quadrantFilter {
				continue
			}
			if completedFilter != nil && t.Completed != *completedFilter {
				continue
			}
			results = append(results, map[string]any{
				"id":          t.ID.String(),
				"title":       t.Title,
				"quadrant":    t.Quadrant,
				"completed":   t.Completed,
				"priority":    t.Priority,
				"description": t.Description.String,
			})
		}

		data, _ := json.Marshal(results)
		return mcp.NewToolResultText(string(data)), nil
	})

	// 2. workbuddy_create_task
	createTaskTool := mcp.NewTool("workbuddy_create_task",
		mcp.WithDescription("Create a new task in the four quadrants task center (triggers real-time desktop UI refresh)"),
		mcp.WithString("title", mcp.Required(), mcp.Description("Task title")),
		mcp.WithString("quadrant", mcp.Description("Quadrant: Q1_URGENT_IMPORTANT, Q2_NOT_URGENT_IMPORTANT, Q3_URGENT_NOT_IMPORTANT, Q4_NOT_URGENT_NOT_IMPORTANT (default Q2)")),
		mcp.WithString("priority", mcp.Description("Priority: high, medium, low (default medium)")),
		mcp.WithString("description", mcp.Description("Detailed description of the task")),
	)
	s.AddTool(createTaskTool, func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := getUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError("unauthorized: " + err.Error()), nil
		}

		args, _ := request.Params.Arguments.(map[string]any)
		title, _ := args["title"].(string)
		if title == "" {
			return mcp.NewToolResultError("title is required"), nil
		}

		quadrant, _ := args["quadrant"].(string)
		if quadrant == "" {
			quadrant = "Q2_NOT_URGENT_IMPORTANT"
		}
		priority, _ := args["priority"].(string)
		if priority == "" {
			priority = "medium"
		}
		desc, _ := args["description"].(string)

		id := uuid.New()
		userUUID := pgtype.UUID{Bytes: userID, Valid: true}

		created, err := queries.CreateTask(ctx, sqlc.CreateTaskParams{
			ID:           pgtype.UUID{Bytes: id, Valid: true},
			UserID:       userUUID,
			Title:        title,
			Quadrant:     quadrant,
			ScheduleMode: pgtype.Text{String: "manual", Valid: true},
			Completed:    false,
			Description:  pgtype.Text{String: desc, Valid: desc != ""},
			Priority:     priority,
			SortOrder:    0,
		})
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("create task failed: %v", err)), nil
		}

		resp := map[string]any{
			"id":          created.ID.String(),
			"title":       created.Title,
			"quadrant":    created.Quadrant,
			"completed":   created.Completed,
			"priority":    created.Priority,
			"description": created.Description.String,
		}

		if hub != nil {
			hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
				Type:   "ENTITY_DELTA",
				Table:  "time_management_tasks",
				Action: ws.ActionInsert,
				ID:     id.String(),
				Data:   resp,
			})
		}

		data, _ := json.Marshal(resp)
		return mcp.NewToolResultText(string(data)), nil
	})

	// 3. workbuddy_update_task
	updateTaskTool := mcp.NewTool("workbuddy_update_task",
		mcp.WithDescription("Update task attributes such as completion status, title, quadrant or priority"),
		mcp.WithString("id", mcp.Required(), mcp.Description("UUID of the task")),
		mcp.WithBoolean("completed", mcp.Description("Whether task is completed")),
		mcp.WithString("title", mcp.Description("Updated title")),
		mcp.WithString("quadrant", mcp.Description("Updated quadrant")),
		mcp.WithString("priority", mcp.Description("Updated priority")),
	)
	s.AddTool(updateTaskTool, func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := getUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError("unauthorized: " + err.Error()), nil
		}

		args, _ := request.Params.Arguments.(map[string]any)
		idStr, _ := args["id"].(string)
		taskUUID, err := uuid.Parse(idStr)
		if err != nil {
			return mcp.NewToolResultError("invalid task id: " + err.Error()), nil
		}

		userUUID := pgtype.UUID{Bytes: userID, Valid: true}
		current, err := queries.GetTaskByID(ctx, sqlc.GetTaskByIDParams{
			ID:     pgtype.UUID{Bytes: taskUUID, Valid: true},
			UserID: userUUID,
		})
		if err != nil {
			return mcp.NewToolResultError("task not found or unauthorized"), nil
		}

		title := current.Title
		if t, ok := args["title"].(string); ok && t != "" {
			title = t
		}
		quadrant := current.Quadrant
		if q, ok := args["quadrant"].(string); ok && q != "" {
			quadrant = q
		}
		priority := current.Priority
		if p, ok := args["priority"].(string); ok && p != "" {
			priority = p
		}
		completed := current.Completed
		compTS := current.CompletedAt
		if c, ok := args["completed"].(bool); ok {
			completed = c
			if completed && !current.Completed {
				compTS = pgtype.Timestamptz{Time: time.Now(), Valid: true}
			} else if !completed {
				compTS = pgtype.Timestamptz{Valid: false}
			}
		}

		updated, err := queries.UpdateTask(ctx, sqlc.UpdateTaskParams{
			ID:               current.ID,
			UserID:           userUUID,
			Title:            title,
			Quadrant:         quadrant,
			ScheduleMode:     current.ScheduleMode,
			ScheduledStartAt: current.ScheduledStartAt,
			ScheduledEndAt:   current.ScheduledEndAt,
			Completed:        completed,
			CompletedAt:      compTS,
			Description:      current.Description,
			Reminder:         current.Reminder,
			ProjectID:        current.ProjectID,
			ProjectStageID:   current.ProjectStageID,
			Priority:         priority,
			AssigneeName:     current.AssigneeName,
			SortOrder:        current.SortOrder,
			LockVersion:      current.LockVersion,
		})
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("update task failed: %v", err)), nil
		}

		resp := map[string]any{
			"id":        updated.ID.String(),
			"title":     updated.Title,
			"quadrant":  updated.Quadrant,
			"completed": updated.Completed,
			"priority":  updated.Priority,
		}

		if hub != nil {
			hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
				Type:   "ENTITY_DELTA",
				Table:  "time_management_tasks",
				Action: ws.ActionUpdate,
				ID:     taskUUID.String(),
				Data:   resp,
			})
		}

		data, _ := json.Marshal(resp)
		return mcp.NewToolResultText(string(data)), nil
	})

	// 4. workbuddy_delete_task
	deleteTaskTool := mcp.NewTool("workbuddy_delete_task",
		mcp.WithDescription("Soft delete a task from the task center"),
		mcp.WithString("id", mcp.Required(), mcp.Description("UUID of the task")),
	)
	s.AddTool(deleteTaskTool, func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := getUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError("unauthorized: " + err.Error()), nil
		}

		args, _ := request.Params.Arguments.(map[string]any)
		idStr, _ := args["id"].(string)
		taskUUID, err := uuid.Parse(idStr)
		if err != nil {
			return mcp.NewToolResultError("invalid uuid: " + err.Error()), nil
		}

		userUUID := pgtype.UUID{Bytes: userID, Valid: true}
		err = queries.SoftDeleteTask(ctx, sqlc.SoftDeleteTaskParams{
			ID:     pgtype.UUID{Bytes: taskUUID, Valid: true},
			UserID: userUUID,
		})
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("delete task failed: %v", err)), nil
		}

		if hub != nil {
			hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
				Type:   "ENTITY_DELTA",
				Table:  "time_management_tasks",
				Action: ws.ActionDelete,
				ID:     taskUUID.String(),
			})
		}

		return mcp.NewToolResultText(`{"success":true,"message":"task deleted"}`), nil
	})

	// 5. workbuddy_list_projects
	listProjectsTool := mcp.NewTool("workbuddy_list_projects",
		mcp.WithDescription("List all active projects in the project center"),
	)
	s.AddTool(listProjectsTool, func(ctx context.Context, _ mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := getUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError("unauthorized: " + err.Error()), nil
		}

		userUUID := pgtype.UUID{Bytes: userID, Valid: true}
		projects, err := queries.ListProjects(ctx, userUUID)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("list projects failed: %v", err)), nil
		}

		var results []map[string]any
		for _, p := range projects {
			results = append(results, map[string]any{
				"id":          p.ID.String(),
				"name":        p.Name,
				"description": p.Description.String,
				"status":      p.Status,
				"priority":    p.Priority,
				"tags":        p.Tags,
			})
		}

		data, _ := json.Marshal(results)
		return mcp.NewToolResultText(string(data)), nil
	})

	// 6. workbuddy_create_project
	createProjectTool := mcp.NewTool("workbuddy_create_project",
		mcp.WithDescription("Create a new project in the project center"),
		mcp.WithString("name", mcp.Required(), mcp.Description("Project name")),
		mcp.WithString("description", mcp.Description("Project description")),
		mcp.WithString("status", mcp.Description("Status: planning, active, paused, completed (default active)")),
		mcp.WithString("priority", mcp.Description("Priority: high, medium, low (default medium)")),
	)
	s.AddTool(createProjectTool, func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := getUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError("unauthorized: " + err.Error()), nil
		}

		args, _ := request.Params.Arguments.(map[string]any)
		name, _ := args["name"].(string)
		if name == "" {
			return mcp.NewToolResultError("name is required"), nil
		}
		desc, _ := args["description"].(string)
		status, _ := args["status"].(string)
		if status == "" {
			status = "active"
		}
		priority, _ := args["priority"].(string)
		if priority == "" {
			priority = "medium"
		}

		id := uuid.New()
		userUUID := pgtype.UUID{Bytes: userID, Valid: true}

		created, err := queries.UpsertProject(ctx, sqlc.UpsertProjectParams{
			ID:          pgtype.UUID{Bytes: id, Valid: true},
			UserID:      userUUID,
			Name:        name,
			Description: pgtype.Text{String: desc, Valid: desc != ""},
			Status:      status,
			Priority:    priority,
		})
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("create project failed: %v", err)), nil
		}

		resp := map[string]any{
			"id":          created.ID.String(),
			"name":        created.Name,
			"description": created.Description.String,
			"status":      created.Status,
			"priority":    created.Priority,
		}

		if hub != nil {
			hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
				Type:   "ENTITY_DELTA",
				Table:  "projects",
				Action: ws.ActionInsert,
				ID:     id.String(),
				Data:   resp,
			})
		}

		data, _ := json.Marshal(resp)
		return mcp.NewToolResultText(string(data)), nil
	})

	// 7. workbuddy_get_daily_review
	getReviewTool := mcp.NewTool("workbuddy_get_daily_review",
		mcp.WithDescription("Get daily review content for a specific date (YYYY-MM-DD)"),
		mcp.WithString("date", mcp.Required(), mcp.Description("Date string YYYY-MM-DD")),
	)
	s.AddTool(getReviewTool, func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := getUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError("unauthorized: " + err.Error()), nil
		}

		args, _ := request.Params.Arguments.(map[string]any)
		dateStr, _ := args["date"].(string)
		parsed, err := time.Parse("2006-01-02", dateStr)
		if err != nil {
			return mcp.NewToolResultError("invalid date format YYYY-MM-DD: " + err.Error()), nil
		}

		userUUID := pgtype.UUID{Bytes: userID, Valid: true}
		dateVal := pgtype.Date{Time: parsed, Valid: true}

		rev, err := queries.GetDailyReviewByDate(ctx, sqlc.GetDailyReviewByDateParams{
			UserID: userUUID,
			Date:   dateVal,
		})
		if err != nil {
			return mcp.NewToolResultText(fmt.Sprintf(`{"date":"%s","content":""}`, dateStr)), nil
		}

		resp := map[string]any{
			"id":      rev.ID.String(),
			"date":    dateStr,
			"content": string(rev.Content),
		}
		data, _ := json.Marshal(resp)
		return mcp.NewToolResultText(string(data)), nil
	})

	// 8. workbuddy_upsert_daily_review
	upsertReviewTool := mcp.NewTool("workbuddy_upsert_daily_review",
		mcp.WithDescription("Save or update daily review content for a specific date (triggers desktop UI auto-refresh)"),
		mcp.WithString("date", mcp.Required(), mcp.Description("Date string YYYY-MM-DD")),
		mcp.WithString("content", mcp.Required(), mcp.Description("Review markdown or JSON content")),
	)
	s.AddTool(upsertReviewTool, func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, err := getUserID(ctx)
		if err != nil {
			return mcp.NewToolResultError("unauthorized: " + err.Error()), nil
		}

		args, _ := request.Params.Arguments.(map[string]any)
		dateStr, _ := args["date"].(string)
		content, _ := args["content"].(string)
		parsed, err := time.Parse("2006-01-02", dateStr)
		if err != nil {
			return mcp.NewToolResultError("invalid date format YYYY-MM-DD: " + err.Error()), nil
		}

		rawContent := []byte(content)
		if !json.Valid(rawContent) {
			m, _ := json.Marshal(content)
			rawContent = m
		}

		id := uuid.New()
		userUUID := pgtype.UUID{Bytes: userID, Valid: true}
		dateVal := pgtype.Date{Time: parsed, Valid: true}

		saved, err := queries.UpsertDailyReview(ctx, sqlc.UpsertDailyReviewParams{
			ID:      pgtype.UUID{Bytes: id, Valid: true},
			UserID:  userUUID,
			Date:    dateVal,
			Content: rawContent,
		})
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("save daily review failed: %v", err)), nil
		}

		resp := map[string]any{
			"id":      saved.ID.String(),
			"date":    dateStr,
			"content": content,
		}

		if hub != nil {
			hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
				Type:   "ENTITY_DELTA",
				Table:  "daily_reviews",
				Action: ws.ActionUpdate,
				ID:     saved.ID.String(),
				Data:   resp,
			})
		}

		data, _ := json.Marshal(resp)
		return mcp.NewToolResultText(string(data)), nil
	})

	return s
}
