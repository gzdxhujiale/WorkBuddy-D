package tools

import (
	"context"
	"fmt"
	"time"

	"github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/components/tool/utils"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"workbuddy-server/internal/database/sqlc"
	"workbuddy-server/internal/ws"
)

// TaskDTO represents a clean JSON representation of a task for LLM consumption.
type TaskDTO struct {
	ID               string `json:"id"`
	Title            string `json:"title"`
	Quadrant         string `json:"quadrant"`
	ScheduleMode     string `json:"schedule_mode,omitempty"`
	ScheduledStartAt string `json:"scheduled_start_at,omitempty"`
	ScheduledEndAt   string `json:"scheduled_end_at,omitempty"`
	Completed        bool   `json:"completed"`
	CompletedAt      string `json:"completed_at,omitempty"`
	Description      string `json:"description,omitempty"`
	Priority         string `json:"priority"`
	SortOrder        int32  `json:"sort_order"`
}

func toTaskDTO(t sqlc.TimeManagementTask) TaskDTO {
	dto := TaskDTO{
		ID:           uuidToString(t.ID),
		Title:        t.Title,
		Quadrant:     t.Quadrant,
		ScheduleMode: t.ScheduleMode.String,
		Completed:    t.Completed,
		Description:  t.Description.String,
		Priority:     t.Priority,
		SortOrder:    t.SortOrder,
	}
	if t.ScheduledStartAt.Valid {
		dto.ScheduledStartAt = t.ScheduledStartAt.Time.Format(time.RFC3339)
	}
	if t.ScheduledEndAt.Valid {
		dto.ScheduledEndAt = t.ScheduledEndAt.Time.Format(time.RFC3339)
	}
	if t.CompletedAt.Valid {
		dto.CompletedAt = t.CompletedAt.Time.Format(time.RFC3339)
	}
	return dto
}

func uuidToString(u pgtype.UUID) string {
	if !u.Valid {
		return ""
	}
	return fmt.Sprintf("%x-%x-%x-%x-%x", u.Bytes[0:4], u.Bytes[4:6], u.Bytes[6:8], u.Bytes[8:10], u.Bytes[10:16])
}

// ListTasksInput provides filter parameters for querying user tasks.
type ListTasksInput struct {
	Quadrant  string `json:"quadrant,omitempty" jsonschema_description:"Filter by quadrant (Q1_URGENT_IMPORTANT, Q2_NOT_URGENT_IMPORTANT, Q3_URGENT_NOT_IMPORTANT, Q4_NOT_URGENT_NOT_IMPORTANT)"`
	Completed *bool  `json:"completed,omitempty" jsonschema_description:"Filter by completion status (true or false)"`
}

// NewListTasksTool creates an Eino tool for listing tasks.
func NewListTasksTool(queries sqlc.Querier) (tool.InvokableTool, error) {
	return utils.InferTool(
		"list_tasks",
		"List user tasks from the four quadrants task center with optional quadrant or completion filtering",
		func(ctx context.Context, in ListTasksInput) ([]TaskDTO, error) {
			userID, err := GetUserID(ctx)
			if err != nil {
				return nil, err
			}

			userUUID := pgtype.UUID{Bytes: userID, Valid: true}
			tasks, err := queries.ListTasks(ctx, userUUID)
			if err != nil {
				return nil, fmt.Errorf("list tasks failed: %w", err)
			}

			var dtos []TaskDTO
			for _, t := range tasks {
				if in.Quadrant != "" && t.Quadrant != in.Quadrant {
					continue
				}
				if in.Completed != nil && t.Completed != *in.Completed {
					continue
				}
				dtos = append(dtos, toTaskDTO(t))
			}
			return dtos, nil
		},
	)
}

// CreateTaskInput describes a new task to create.
type CreateTaskInput struct {
	Title            string `json:"title" jsonschema:"required" jsonschema_description:"Title of the task"`
	Quadrant         string `json:"quadrant,omitempty" jsonschema_description:"Quadrant: Q1_URGENT_IMPORTANT, Q2_NOT_URGENT_IMPORTANT, Q3_URGENT_NOT_IMPORTANT, Q4_NOT_URGENT_NOT_IMPORTANT (default Q2)"`
	Priority         string `json:"priority,omitempty" jsonschema_description:"Priority: high, medium, low (default medium)"`
	Description      string `json:"description,omitempty" jsonschema_description:"Detailed description of the task"`
	ScheduledStartAt string `json:"scheduled_start_at,omitempty" jsonschema_description:"Optional scheduled start datetime in RFC3339 format"`
	ScheduledEndAt   string `json:"scheduled_end_at,omitempty" jsonschema_description:"Optional scheduled end datetime in RFC3339 format"`
}

// NewCreateTaskTool creates an Eino tool for adding a new task.
func NewCreateTaskTool(queries sqlc.Querier, hub *ws.Hub) (tool.InvokableTool, error) {
	return utils.InferTool(
		"create_task",
		"Create a new task in the four quadrants task center",
		func(ctx context.Context, in CreateTaskInput) (TaskDTO, error) {
			userID, err := GetUserID(ctx)
			if err != nil {
				return TaskDTO{}, err
			}

			quadrant := in.Quadrant
			if quadrant == "" {
				quadrant = "Q2_NOT_URGENT_IMPORTANT"
			}
			priority := in.Priority
			if priority == "" {
				priority = "medium"
			}

			var startTS, endTS pgtype.Timestamptz
			if in.ScheduledStartAt != "" {
				if t, err := time.Parse(time.RFC3339, in.ScheduledStartAt); err == nil {
					startTS = pgtype.Timestamptz{Time: t, Valid: true}
				}
			}
			if in.ScheduledEndAt != "" {
				if t, err := time.Parse(time.RFC3339, in.ScheduledEndAt); err == nil {
					endTS = pgtype.Timestamptz{Time: t, Valid: true}
				}
			}

			id := uuid.New()
			userUUID := pgtype.UUID{Bytes: userID, Valid: true}

			created, err := queries.CreateTask(ctx, sqlc.CreateTaskParams{
				ID:               pgtype.UUID{Bytes: id, Valid: true},
				UserID:           userUUID,
				Title:            in.Title,
				Quadrant:         quadrant,
				ScheduleMode:     pgtype.Text{String: "manual", Valid: true},
				ScheduledStartAt: startTS,
				ScheduledEndAt:   endTS,
				Completed:        false,
				Description:      pgtype.Text{String: in.Description, Valid: in.Description != ""},
				Priority:         priority,
				SortOrder:        0,
			})
			if err != nil {
				return TaskDTO{}, fmt.Errorf("create task failed: %w", err)
			}

			dto := toTaskDTO(created)
			if hub != nil {
				hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
					Type:   "ENTITY_DELTA",
					Table:  "time_management_tasks",
					Action: ws.ActionInsert,
					ID:     id.String(),
					Data:   dto,
				})
			}
			return dto, nil
		},
	)
}

// UpdateTaskInput specifies task fields to update.
type UpdateTaskInput struct {
	ID          string  `json:"id" jsonschema:"required" jsonschema_description:"UUID of the task to update"`
	Title       *string `json:"title,omitempty" jsonschema_description:"Updated title"`
	Quadrant    *string `json:"quadrant,omitempty" jsonschema_description:"Updated quadrant"`
	Priority    *string `json:"priority,omitempty" jsonschema_description:"Updated priority"`
	Completed   *bool   `json:"completed,omitempty" jsonschema_description:"Updated completion status"`
	Description *string `json:"description,omitempty" jsonschema_description:"Updated description"`
}

// NewUpdateTaskTool creates an Eino tool for modifying an existing task.
func NewUpdateTaskTool(queries sqlc.Querier, hub *ws.Hub) (tool.InvokableTool, error) {
	return utils.InferTool(
		"update_task",
		"Update an existing task in the task center (e.g. mark completed, change title, quadrant, or description)",
		func(ctx context.Context, in UpdateTaskInput) (TaskDTO, error) {
			userID, err := GetUserID(ctx)
			if err != nil {
				return TaskDTO{}, err
			}

			taskUUID, err := uuid.Parse(in.ID)
			if err != nil {
				return TaskDTO{}, fmt.Errorf("invalid task id: %w", err)
			}

			userUUID := pgtype.UUID{Bytes: userID, Valid: true}
			current, err := queries.GetTaskByID(ctx, sqlc.GetTaskByIDParams{
				ID:     pgtype.UUID{Bytes: taskUUID, Valid: true},
				UserID: userUUID,
			})
			if err != nil {
				return TaskDTO{}, fmt.Errorf("task not found or access denied: %w", err)
			}

			title := current.Title
			if in.Title != nil {
				title = *in.Title
			}
			quadrant := current.Quadrant
			if in.Quadrant != nil {
				quadrant = *in.Quadrant
			}
			priority := current.Priority
			if in.Priority != nil {
				priority = *in.Priority
			}
			completed := current.Completed
			compTS := current.CompletedAt
			if in.Completed != nil {
				completed = *in.Completed
				if completed && !current.Completed {
					compTS = pgtype.Timestamptz{Time: time.Now(), Valid: true}
				} else if !completed {
					compTS = pgtype.Timestamptz{Valid: false}
				}
			}
			desc := current.Description
			if in.Description != nil {
				desc = pgtype.Text{String: *in.Description, Valid: true}
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
				Description:      desc,
				Reminder:         current.Reminder,
				ProjectID:        current.ProjectID,
				ProjectStageID:   current.ProjectStageID,
				Priority:         priority,
				AssigneeName:     current.AssigneeName,
				SortOrder:        current.SortOrder,
				LockVersion:      current.LockVersion,
			})
			if err != nil {
				return TaskDTO{}, fmt.Errorf("update task failed: %w", err)
			}

			dto := toTaskDTO(updated)
			if hub != nil {
				hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
					Type:   "ENTITY_DELTA",
					Table:  "time_management_tasks",
					Action: ws.ActionUpdate,
					ID:     taskUUID.String(),
					Data:   dto,
				})
			}
			return dto, nil
		},
	)
}

// DeleteTaskInput specifies task to delete.
type DeleteTaskInput struct {
	ID string `json:"id" jsonschema:"required" jsonschema_description:"UUID of the task to delete"`
}

// OperationResult is a generic success response.
type OperationResult struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

// NewDeleteTaskTool creates an Eino tool for soft deleting a task.
func NewDeleteTaskTool(queries sqlc.Querier, hub *ws.Hub) (tool.InvokableTool, error) {
	return utils.InferTool(
		"delete_task",
		"Delete (soft delete) a task from the task center",
		func(ctx context.Context, in DeleteTaskInput) (OperationResult, error) {
			userID, err := GetUserID(ctx)
			if err != nil {
				return OperationResult{Success: false, Message: err.Error()}, err
			}

			taskUUID, err := uuid.Parse(in.ID)
			if err != nil {
				return OperationResult{Success: false, Message: "invalid uuid"}, err
			}

			userUUID := pgtype.UUID{Bytes: userID, Valid: true}
			err = queries.SoftDeleteTask(ctx, sqlc.SoftDeleteTaskParams{
				ID:     pgtype.UUID{Bytes: taskUUID, Valid: true},
				UserID: userUUID,
			})
			if err != nil {
				return OperationResult{Success: false, Message: err.Error()}, err
			}

			if hub != nil {
				hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
					Type:   "ENTITY_DELTA",
					Table:  "time_management_tasks",
					Action: ws.ActionDelete,
					ID:     taskUUID.String(),
				})
			}
			return OperationResult{Success: true, Message: "task deleted successfully"}, nil
		},
	)
}
