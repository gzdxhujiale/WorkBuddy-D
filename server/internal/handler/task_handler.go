package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"workbuddy-server/internal/database/sqlc"
	"workbuddy-server/internal/middleware"
	"workbuddy-server/internal/ws"
)

type TaskHandler struct {
	queries sqlc.Querier
	hub     *ws.Hub
}

func NewTaskHandler(queries sqlc.Querier, hub *ws.Hub) *TaskHandler {
	return &TaskHandler{queries: queries, hub: hub}
}

type TaskResponse struct {
	ID               pgtype.UUID        `json:"id"`
	UserID           pgtype.UUID        `json:"user_id"`
	Title            string             `json:"title"`
	Quadrant         string             `json:"quadrant"`
	ScheduleMode     pgtype.Text        `json:"schedule_mode"`
	ScheduledStartAt pgtype.Timestamptz `json:"scheduled_start_at"`
	ScheduledEndAt   pgtype.Timestamptz `json:"scheduled_end_at"`
	Completed        bool               `json:"completed"`
	CompletedAt      pgtype.Timestamptz `json:"completed_at"`
	Description      pgtype.Text        `json:"description"`
	Reminder         json.RawMessage    `json:"reminder"`
	ProjectID        pgtype.UUID        `json:"project_id"`
	ProjectStageID   pgtype.UUID        `json:"project_stage_id"`
	Priority         string             `json:"priority"`
	AssigneeName     pgtype.Text        `json:"assignee_name"`
	SortOrder        int32              `json:"sort_order"`
	LockVersion      int64              `json:"lock_version"`
	CreatedAt        pgtype.Timestamptz `json:"created_at"`
	UpdatedAt        pgtype.Timestamptz `json:"updated_at"`
	DeletedAt        pgtype.Timestamptz `json:"deleted_at"`
}

func toTaskResponse(t sqlc.TimeManagementTask) TaskResponse {
	var rem json.RawMessage
	if len(t.Reminder) > 0 && string(t.Reminder) != "null" {
		rem = json.RawMessage(t.Reminder)
	}
	return TaskResponse{
		ID:               t.ID,
		UserID:           t.UserID,
		Title:            t.Title,
		Quadrant:         t.Quadrant,
		ScheduleMode:     t.ScheduleMode,
		ScheduledStartAt: t.ScheduledStartAt,
		ScheduledEndAt:   t.ScheduledEndAt,
		Completed:        t.Completed,
		CompletedAt:      t.CompletedAt,
		Description:      t.Description,
		Reminder:         rem,
		ProjectID:        t.ProjectID,
		ProjectStageID:   t.ProjectStageID,
		Priority:         t.Priority,
		AssigneeName:     t.AssigneeName,
		SortOrder:        t.SortOrder,
		LockVersion:      t.LockVersion,
		CreatedAt:        t.CreatedAt,
		UpdatedAt:        t.UpdatedAt,
		DeletedAt:        t.DeletedAt,
	}
}

func toTaskResponses(tasks []sqlc.TimeManagementTask) []TaskResponse {
	res := make([]TaskResponse, len(tasks))
	for i, t := range tasks {
		res[i] = toTaskResponse(t)
	}
	return res
}

func (h *TaskHandler) ListTasks(c *gin.Context) {
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	projectIDStr := c.Query("project_id")
	if projectIDStr != "" {
		projUUID, err := uuid.Parse(projectIDStr)
		if err == nil {
			tasks, err := h.queries.ListTasksByProject(c.Request.Context(), sqlc.ListTasksByProjectParams{
				UserID:    pgtype.UUID{Bytes: userID, Valid: true},
				ProjectID: pgtype.UUID{Bytes: projUUID, Valid: true},
			})
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, toTaskResponses(tasks))
			return
		}
	}

	tasks, err := h.queries.ListTasks(c.Request.Context(), pgtype.UUID{Bytes: userID, Valid: true})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, toTaskResponses(tasks))
}

type TaskInput struct {
	ID               string           `json:"id"`
	Title            string           `json:"title"`
	Quadrant         string           `json:"quadrant"`
	ScheduleMode     *string          `json:"schedule_mode"`
	ScheduledStartAt *time.Time       `json:"scheduled_start_at"`
	ScheduledEndAt   *time.Time       `json:"scheduled_end_at"`
	Completed        *bool            `json:"completed"`
	CompletedAt      *time.Time       `json:"completed_at"`
	Description      *string          `json:"description"`
	Reminder         *json.RawMessage `json:"reminder"`
	ProjectID        *string          `json:"project_id"`
	ProjectStageID   *string          `json:"project_stage_id"`
	Priority         string           `json:"priority"`
	AssigneeName     *string          `json:"assignee_name"`
	SortOrder        *int32           `json:"sort_order"`
	LockVersion      int64            `json:"lock_version"`
}

func (h *TaskHandler) CreateTask(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	var req TaskInput
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Title == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "title is required"})
		return
	}

	id := uuid.New()
	if req.ID != "" {
		if parsed, err := uuid.Parse(req.ID); err == nil {
			id = parsed
		}
	}

	quadrant := req.Quadrant
	if quadrant == "" {
		quadrant = "Q2_NOT_URGENT_IMPORTANT"
	}
	priority := req.Priority
	if priority == "" {
		priority = "medium"
	}

	var projUUID, stageUUID pgtype.UUID
	if req.ProjectID != nil && *req.ProjectID != "" {
		if p, err := uuid.Parse(*req.ProjectID); err == nil {
			projUUID = pgtype.UUID{Bytes: p, Valid: true}
		}
	}
	if req.ProjectStageID != nil && *req.ProjectStageID != "" {
		if s, err := uuid.Parse(*req.ProjectStageID); err == nil {
			stageUUID = pgtype.UUID{Bytes: s, Valid: true}
		}
	}

	var startTS, endTS, compTS pgtype.Timestamptz
	if req.ScheduledStartAt != nil {
		startTS = pgtype.Timestamptz{Time: *req.ScheduledStartAt, Valid: true}
	}
	if req.ScheduledEndAt != nil {
		endTS = pgtype.Timestamptz{Time: *req.ScheduledEndAt, Valid: true}
	}

	completed := false
	if req.Completed != nil {
		completed = *req.Completed
	}
	if completed && req.CompletedAt == nil {
		now := time.Now()
		compTS = pgtype.Timestamptz{Time: now, Valid: true}
	} else if req.CompletedAt != nil {
		compTS = pgtype.Timestamptz{Time: *req.CompletedAt, Valid: true}
	}

	var sortOrder int32
	if req.SortOrder != nil {
		sortOrder = *req.SortOrder
	}

	var reminderBytes []byte
	if req.Reminder != nil && string(*req.Reminder) != "null" && string(*req.Reminder) != "" {
		reminderBytes = []byte(*req.Reminder)
	}

	task, err := h.queries.CreateTask(c.Request.Context(), sqlc.CreateTaskParams{
		ID:               pgtype.UUID{Bytes: id, Valid: true},
		UserID:           pgtype.UUID{Bytes: userID, Valid: true},
		Title:            req.Title,
		Quadrant:         quadrant,
		ScheduleMode:     pgtype.Text{String: derefString(req.ScheduleMode), Valid: req.ScheduleMode != nil},
		ScheduledStartAt: startTS,
		ScheduledEndAt:   endTS,
		Completed:        completed,
		CompletedAt:      compTS,
		Description:      pgtype.Text{String: derefString(req.Description), Valid: req.Description != nil},
		Reminder:         reminderBytes,
		ProjectID:        projUUID,
		ProjectStageID:   stageUUID,
		Priority:         priority,
		AssigneeName:     pgtype.Text{String: derefString(req.AssigneeName), Valid: req.AssigneeName != nil},
		SortOrder:        sortOrder,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	resp := toTaskResponse(task)
	h.hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
		Type:   "ENTITY_DELTA",
		Table:  "time_management_tasks",
		Action: ws.ActionInsert,
		ID:     id.String(),
		Data:   resp,
	})

	c.JSON(http.StatusCreated, resp)
}

func (h *TaskHandler) UpdateTask(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	taskIDStr := c.Param("id")
	taskID, err := uuid.Parse(taskIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task id"})
		return
	}

	var req TaskInput
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	existing, err := h.queries.GetTaskByID(c.Request.Context(), sqlc.GetTaskByIDParams{
		ID:     pgtype.UUID{Bytes: taskID, Valid: true},
		UserID: pgtype.UUID{Bytes: userID, Valid: true},
	})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}

	title := req.Title
	if title == "" {
		title = existing.Title
	}

	quadrant := req.Quadrant
	if quadrant == "" {
		quadrant = existing.Quadrant
	}

	priority := req.Priority
	if priority == "" {
		priority = existing.Priority
	}

	scheduleMode := existing.ScheduleMode
	if req.ScheduleMode != nil {
		scheduleMode = pgtype.Text{String: derefString(req.ScheduleMode), Valid: *req.ScheduleMode != ""}
	}

	startTS := existing.ScheduledStartAt
	if req.ScheduledStartAt != nil {
		startTS = pgtype.Timestamptz{Time: *req.ScheduledStartAt, Valid: true}
	} else if req.ScheduleMode != nil && *req.ScheduleMode == "" {
		startTS = pgtype.Timestamptz{Valid: false}
	}

	endTS := existing.ScheduledEndAt
	if req.ScheduledEndAt != nil {
		endTS = pgtype.Timestamptz{Time: *req.ScheduledEndAt, Valid: true}
	} else if req.ScheduleMode != nil && *req.ScheduleMode == "" {
		endTS = pgtype.Timestamptz{Valid: false}
	}

	completed := existing.Completed
	compTS := existing.CompletedAt
	if req.Completed != nil {
		completed = *req.Completed
		if completed && !existing.Completed {
			if req.CompletedAt != nil {
				compTS = pgtype.Timestamptz{Time: *req.CompletedAt, Valid: true}
			} else {
				compTS = pgtype.Timestamptz{Time: time.Now(), Valid: true}
			}
		} else if !completed {
			compTS = pgtype.Timestamptz{Valid: false}
		}
	} else if req.CompletedAt != nil {
		compTS = pgtype.Timestamptz{Time: *req.CompletedAt, Valid: true}
	}

	desc := existing.Description
	if req.Description != nil {
		desc = pgtype.Text{String: derefString(req.Description), Valid: *req.Description != ""}
	}

	assignee := existing.AssigneeName
	if req.AssigneeName != nil {
		assignee = pgtype.Text{String: derefString(req.AssigneeName), Valid: *req.AssigneeName != ""}
	}

	projUUID := existing.ProjectID
	if req.ProjectID != nil {
		if *req.ProjectID != "" {
			if p, err := uuid.Parse(*req.ProjectID); err == nil {
				projUUID = pgtype.UUID{Bytes: p, Valid: true}
			}
		} else {
			projUUID = pgtype.UUID{Valid: false}
		}
	}

	stageUUID := existing.ProjectStageID
	if req.ProjectStageID != nil {
		if *req.ProjectStageID != "" {
			if s, err := uuid.Parse(*req.ProjectStageID); err == nil {
				stageUUID = pgtype.UUID{Bytes: s, Valid: true}
			}
		} else {
			stageUUID = pgtype.UUID{Valid: false}
		}
	}

	sortOrder := existing.SortOrder
	if req.SortOrder != nil {
		sortOrder = *req.SortOrder
	}

	reminderBytes := existing.Reminder
	if req.Reminder != nil {
		if string(*req.Reminder) == "null" || string(*req.Reminder) == "" {
			reminderBytes = nil
		} else {
			reminderBytes = []byte(*req.Reminder)
		}
	}

	lockVersion := req.LockVersion
	if lockVersion == 0 {
		lockVersion = existing.LockVersion
	}

	task, err := h.queries.UpdateTask(c.Request.Context(), sqlc.UpdateTaskParams{
		ID:               pgtype.UUID{Bytes: taskID, Valid: true},
		UserID:           pgtype.UUID{Bytes: userID, Valid: true},
		Title:            title,
		Quadrant:         quadrant,
		ScheduleMode:     scheduleMode,
		ScheduledStartAt: startTS,
		ScheduledEndAt:   endTS,
		Completed:        completed,
		CompletedAt:      compTS,
		Description:      desc,
		Reminder:         reminderBytes,
		ProjectID:        projUUID,
		ProjectStageID:   stageUUID,
		Priority:         priority,
		AssigneeName:     assignee,
		SortOrder:        sortOrder,
		LockVersion:      lockVersion,
	})
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "VERSION_CONFLICT or task not found", "details": err.Error()})
		return
	}

	resp := toTaskResponse(task)
	h.hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
		Type:   "ENTITY_DELTA",
		Table:  "time_management_tasks",
		Action: ws.ActionUpdate,
		ID:     taskID.String(),
		Data:   resp,
	})

	c.JSON(http.StatusOK, resp)
}

func (h *TaskHandler) DeleteTask(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	taskIDStr := c.Param("id")
	taskID, err := uuid.Parse(taskIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task id"})
		return
	}

	if err := h.queries.SoftDeleteTask(c.Request.Context(), sqlc.SoftDeleteTaskParams{
		ID:     pgtype.UUID{Bytes: taskID, Valid: true},
		UserID: pgtype.UUID{Bytes: userID, Valid: true},
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
		Type:   "ENTITY_DELTA",
		Table:  "time_management_tasks",
		Action: ws.ActionDelete,
		ID:     taskID.String(),
	})

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func derefString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
