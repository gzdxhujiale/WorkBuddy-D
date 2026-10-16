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

// ProjectDTO represents a clean JSON representation of a project.
type ProjectDTO struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description,omitempty"`
	Status      string   `json:"status"`
	Priority    string   `json:"priority"`
	StartDate   string   `json:"start_date,omitempty"`
	EndDate     string   `json:"end_date,omitempty"`
	Tags        []string `json:"tags,omitempty"`
}

func toProjectDTO(p sqlc.Project) ProjectDTO {
	dto := ProjectDTO{
		ID:          uuidToString(p.ID),
		Name:        p.Name,
		Description: p.Description.String,
		Status:      p.Status,
		Priority:    p.Priority,
		Tags:        p.Tags,
	}
	if p.StartDate.Valid {
		dto.StartDate = p.StartDate.Time.Format("2006-01-02")
	}
	if p.EndDate.Valid {
		dto.EndDate = p.EndDate.Time.Format("2006-01-02")
	}
	return dto
}

// ListProjectsInput contains query filters.
type ListProjectsInput struct{}

// NewListProjectsTool creates an Eino tool for listing user projects.
func NewListProjectsTool(queries sqlc.Querier) (tool.InvokableTool, error) {
	return utils.InferTool(
		"list_projects",
		"List all active projects in the user project center",
		func(ctx context.Context, _ ListProjectsInput) ([]ProjectDTO, error) {
			userID, err := GetUserID(ctx)
			if err != nil {
				return nil, err
			}

			userUUID := pgtype.UUID{Bytes: userID, Valid: true}
			projects, err := queries.ListProjects(ctx, userUUID)
			if err != nil {
				return nil, fmt.Errorf("list projects failed: %w", err)
			}

			var dtos []ProjectDTO
			for _, p := range projects {
				dtos = append(dtos, toProjectDTO(p))
			}
			return dtos, nil
		},
	)
}

// CreateProjectInput provides fields to create a new project.
type CreateProjectInput struct {
	Name        string   `json:"name" jsonschema:"required" jsonschema_description:"Name of the project"`
	Description string   `json:"description,omitempty" jsonschema_description:"Project goal or description"`
	Status      string   `json:"status,omitempty" jsonschema_description:"Status: planning, active, paused, completed (default active)"`
	Priority    string   `json:"priority,omitempty" jsonschema_description:"Priority: high, medium, low (default medium)"`
	StartDate   string   `json:"start_date,omitempty" jsonschema_description:"Optional start date YYYY-MM-DD"`
	EndDate     string   `json:"end_date,omitempty" jsonschema_description:"Optional target completion date YYYY-MM-DD"`
	Tags        []string `json:"tags,omitempty" jsonschema_description:"Optional tags"`
}

// NewCreateProjectTool creates an Eino tool for creating projects.
func NewCreateProjectTool(queries sqlc.Querier, hub *ws.Hub) (tool.InvokableTool, error) {
	return utils.InferTool(
		"create_project",
		"Create a new project in the project center",
		func(ctx context.Context, in CreateProjectInput) (ProjectDTO, error) {
			userID, err := GetUserID(ctx)
			if err != nil {
				return ProjectDTO{}, err
			}

			status := in.Status
			if status == "" {
				status = "active"
			}
			priority := in.Priority
			if priority == "" {
				priority = "medium"
			}

			var startD, endD pgtype.Date
			if in.StartDate != "" {
				if t, err := time.Parse("2006-01-02", in.StartDate); err == nil {
					startD = pgtype.Date{Time: t, Valid: true}
				}
			}
			if in.EndDate != "" {
				if t, err := time.Parse("2006-01-02", in.EndDate); err == nil {
					endD = pgtype.Date{Time: t, Valid: true}
				}
			}

			id := uuid.New()
			userUUID := pgtype.UUID{Bytes: userID, Valid: true}

			created, err := queries.UpsertProject(ctx, sqlc.UpsertProjectParams{
				ID:          pgtype.UUID{Bytes: id, Valid: true},
				UserID:      userUUID,
				Name:        in.Name,
				Description: pgtype.Text{String: in.Description, Valid: in.Description != ""},
				Status:      status,
				StartDate:   startD,
				EndDate:     endD,
				Priority:    priority,
				Tags:        in.Tags,
			})
			if err != nil {
				return ProjectDTO{}, fmt.Errorf("create project failed: %w", err)
			}

			dto := toProjectDTO(created)
			if hub != nil {
				hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
					Type:   "ENTITY_DELTA",
					Table:  "projects",
					Action: ws.ActionInsert,
					ID:     id.String(),
					Data:   dto,
				})
			}
			return dto, nil
		},
	)
}

// ProjectStageDTO represents a milestone or stage in a project.
type ProjectStageDTO struct {
	ID        string `json:"id"`
	ProjectID string `json:"project_id"`
	Name      string `json:"name"`
	SortOrder int32  `json:"sort_order"`
	StartDate string `json:"start_date,omitempty"`
	EndDate   string `json:"end_date,omitempty"`
}

// ListProjectStagesInput takes an optional project ID.
type ListProjectStagesInput struct {
	ProjectID string `json:"project_id,omitempty" jsonschema_description:"Optional project UUID to filter stages"`
}

// NewListProjectStagesTool creates an Eino tool for listing project stages.
func NewListProjectStagesTool(queries sqlc.Querier) (tool.InvokableTool, error) {
	return utils.InferTool(
		"list_project_stages",
		"List project stages/milestones",
		func(ctx context.Context, in ListProjectStagesInput) ([]ProjectStageDTO, error) {
			userID, err := GetUserID(ctx)
			if err != nil {
				return nil, err
			}

			userUUID := pgtype.UUID{Bytes: userID, Valid: true}
			stages, err := queries.ListAllProjectStages(ctx, userUUID)
			if err != nil {
				return nil, fmt.Errorf("list stages failed: %w", err)
			}

			var dtos []ProjectStageDTO
			for _, s := range stages {
				if in.ProjectID != "" && uuidToString(s.ProjectID) != in.ProjectID {
					continue
				}
				dto := ProjectStageDTO{
					ID:        uuidToString(s.ID),
					ProjectID: uuidToString(s.ProjectID),
					Name:      s.Name,
					SortOrder: s.SortOrder,
				}
				if s.StartDate.Valid {
					dto.StartDate = s.StartDate.Time.Format("2006-01-02")
				}
				if s.EndDate.Valid {
					dto.EndDate = s.EndDate.Time.Format("2006-01-02")
				}
				dtos = append(dtos, dto)
			}
			return dtos, nil
		},
	)
}
