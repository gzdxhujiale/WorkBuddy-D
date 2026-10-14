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

type ProjectHandler struct {
	queries sqlc.Querier
	hub     *ws.Hub
}

func NewProjectHandler(queries sqlc.Querier, hub *ws.Hub) *ProjectHandler {
	return &ProjectHandler{queries: queries, hub: hub}
}

func (h *ProjectHandler) ListProjects(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	projects, err := h.queries.ListProjects(c.Request.Context(), pgtype.UUID{Bytes: userID, Valid: true})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, projects)
}

type ProjectInput struct {
	ID          string   `json:"id"`
	Name        string   `json:"name" binding:"required"`
	Description *string  `json:"description"`
	Status      string   `json:"status"`
	StartDate   *string  `json:"start_date"`
	EndDate     *string  `json:"end_date"`
	Priority    string   `json:"priority"`
	Tags        []string `json:"tags"`
	OwnerName   *string  `json:"owner_name"`
	LockVersion int64    `json:"lock_version"`
}

func (h *ProjectHandler) CreateProject(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	var req ProjectInput
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	id := uuid.New()
	if req.ID != "" {
		if p, err := uuid.Parse(req.ID); err == nil {
			id = p
		}
	}

	status := req.Status
	if status == "" {
		status = "not_started"
	}
	priority := req.Priority
	if priority == "" {
		priority = "medium"
	}
	tags := req.Tags
	if tags == nil {
		tags = []string{}
	}

	var startDate, endDate pgtype.Date
	if req.StartDate != nil && *req.StartDate != "" {
		if t, err := time.Parse("2006-01-02", *req.StartDate); err == nil {
			startDate = pgtype.Date{Time: t, Valid: true}
		}
	}
	if req.EndDate != nil && *req.EndDate != "" {
		if t, err := time.Parse("2006-01-02", *req.EndDate); err == nil {
			endDate = pgtype.Date{Time: t, Valid: true}
		}
	}

	project, err := h.queries.UpsertProject(c.Request.Context(), sqlc.UpsertProjectParams{
		ID:          pgtype.UUID{Bytes: id, Valid: true},
		UserID:      pgtype.UUID{Bytes: userID, Valid: true},
		Name:        req.Name,
		Description: pgtype.Text{String: derefString(req.Description), Valid: req.Description != nil},
		Status:      status,
		StartDate:   startDate,
		EndDate:     endDate,
		Priority:    priority,
		Tags:        tags,
		OwnerName:   pgtype.Text{String: derefString(req.OwnerName), Valid: req.OwnerName != nil},
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
		Type:   "ENTITY_DELTA",
		Table:  "projects",
		Action: ws.ActionInsert,
		ID:     id.String(),
		Data:   project,
	})

	c.JSON(http.StatusOK, project)
}

func (h *ProjectHandler) DeleteProject(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}

	pID := pgtype.UUID{Bytes: projectID, Valid: true}
	uID := pgtype.UUID{Bytes: userID, Valid: true}

	if err := h.queries.SoftDeleteProject(c.Request.Context(), sqlc.SoftDeleteProjectParams{
		ID:     pID,
		UserID: uID,
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 级联软删除阶段及关联任务
	_ = h.queries.SoftDeleteStagesByProject(c.Request.Context(), sqlc.SoftDeleteStagesByProjectParams{
		ProjectID: pID,
		UserID:    uID,
	})
	_ = h.queries.SoftDeleteTasksByProject(c.Request.Context(), sqlc.SoftDeleteTasksByProjectParams{
		ProjectID: pID,
		UserID:    uID,
	})

	h.hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
		Type:   "ENTITY_DELTA",
		Table:  "projects",
		Action: ws.ActionDelete,
		ID:     projectID.String(),
	})

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// --- Stages ---

func (h *ProjectHandler) ListAllStages(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	stages, err := h.queries.ListAllProjectStages(c.Request.Context(), pgtype.UUID{Bytes: userID, Valid: true})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, stages)
}

type StageInput struct {
	ID                 string  `json:"id"`
	ProjectID          string  `json:"project_id" binding:"required"`
	Name               string  `json:"name" binding:"required"`
	DefaultAssigneeName *string `json:"default_assignee_name"`
	SortOrder          int32   `json:"sort_order"`
	TemplateKey        *string `json:"template_key"`
	StartDate          *string `json:"start_date"`
	EndDate            *string `json:"end_date"`
	LockVersion        int64   `json:"lock_version"`
}

func (h *ProjectHandler) UpsertStage(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	var req StageInput
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	id := uuid.New()
	if req.ID != "" {
		if p, err := uuid.Parse(req.ID); err == nil {
			id = p
		}
	}

	projectID, err := uuid.Parse(req.ProjectID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}

	var startDate, endDate pgtype.Date
	if req.StartDate != nil && *req.StartDate != "" {
		if t, err := time.Parse("2006-01-02", *req.StartDate); err == nil {
			startDate = pgtype.Date{Time: t, Valid: true}
		}
	}
	if req.EndDate != nil && *req.EndDate != "" {
		if t, err := time.Parse("2006-01-02", *req.EndDate); err == nil {
			endDate = pgtype.Date{Time: t, Valid: true}
		}
	}

	sortOrder := req.SortOrder
	if req.ID == "" && sortOrder <= 0 {
		if nextOrder, err := h.queries.GetNextProjectStageSortOrder(c.Request.Context(), sqlc.GetNextProjectStageSortOrderParams{
			UserID:    pgtype.UUID{Bytes: userID, Valid: true},
			ProjectID: pgtype.UUID{Bytes: projectID, Valid: true},
		}); err == nil {
			sortOrder = nextOrder
		}
	}

	stage, err := h.queries.UpsertProjectStage(c.Request.Context(), sqlc.UpsertProjectStageParams{
		ID:                  pgtype.UUID{Bytes: id, Valid: true},
		UserID:              pgtype.UUID{Bytes: userID, Valid: true},
		ProjectID:           pgtype.UUID{Bytes: projectID, Valid: true},
		Name:                req.Name,
		DefaultAssigneeName: pgtype.Text{String: derefString(req.DefaultAssigneeName), Valid: req.DefaultAssigneeName != nil},
		SortOrder:           sortOrder,
		TemplateKey:         pgtype.Text{String: derefString(req.TemplateKey), Valid: req.TemplateKey != nil},
		StartDate:           startDate,
		EndDate:             endDate,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
		Type:   "ENTITY_DELTA",
		Table:  "project_stages",
		Action: ws.ActionUpdate,
		ID:     id.String(),
		Data:   stage,
	})

	c.JSON(http.StatusOK, stage)
}

type ReorderStageItem struct {
	ID        string `json:"id"`
	SortOrder int32  `json:"sort_order"`
}

type ReorderStagesRequest struct {
	Items []ReorderStageItem `json:"items" binding:"required"`
}

func (h *ProjectHandler) ReorderStages(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	var req ReorderStagesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var updated []sqlc.ProjectStage
	for _, item := range req.Items {
		stageID, err := uuid.Parse(item.ID)
		if err != nil {
			continue
		}
		s, err := h.queries.UpdateProjectStageSortOrder(c.Request.Context(), sqlc.UpdateProjectStageSortOrderParams{
			ID:        pgtype.UUID{Bytes: stageID, Valid: true},
			UserID:    pgtype.UUID{Bytes: userID, Valid: true},
			SortOrder: item.SortOrder,
		})
		if err == nil {
			updated = append(updated, s)
		}
	}

	h.hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
		Type:   "ENTITY_DELTA",
		Table:  "project_stages",
		Action: ws.ActionUpdate,
		Data:   updated,
	})

	c.JSON(http.StatusOK, updated)
}

func (h *ProjectHandler) DeleteStage(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	stageID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid stage id"})
		return
	}

	sID := pgtype.UUID{Bytes: stageID, Valid: true}
	uID := pgtype.UUID{Bytes: userID, Valid: true}

	if err := h.queries.SoftDeleteProjectStage(c.Request.Context(), sqlc.SoftDeleteProjectStageParams{
		ID:     sID,
		UserID: uID,
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 级联软删除阶段所属任务
	_ = h.queries.SoftDeleteTasksByStage(c.Request.Context(), sqlc.SoftDeleteTasksByStageParams{
		ProjectStageID: sID,
		UserID:         uID,
	})

	h.hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
		Type:   "ENTITY_DELTA",
		Table:  "project_stages",
		Action: ws.ActionDelete,
		ID:     stageID.String(),
	})

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// --- Project Templates ---

func (h *ProjectHandler) ListTemplates(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	templates, err := h.queries.ListProjectTemplates(c.Request.Context(), pgtype.UUID{Bytes: userID, Valid: true})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, templates)
}

type ProjectTemplateInput struct {
	ID          string          `json:"id"`
	Name        string          `json:"name" binding:"required"`
	Description *string         `json:"description"`
	Definition  json.RawMessage `json:"definition"`
	LockVersion int64           `json:"lock_version"`
}

func (h *ProjectHandler) UpsertTemplate(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	var req ProjectTemplateInput
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	id := uuid.New()
	if req.ID != "" {
		if p, err := uuid.Parse(req.ID); err == nil {
			id = p
		}
	}

	defBytes := req.Definition
	if len(defBytes) == 0 {
		defBytes = []byte("{}")
	}

	tmpl, err := h.queries.UpsertProjectTemplate(c.Request.Context(), sqlc.UpsertProjectTemplateParams{
		ID:          pgtype.UUID{Bytes: id, Valid: true},
		UserID:      pgtype.UUID{Bytes: userID, Valid: true},
		Name:        req.Name,
		Description: pgtype.Text{String: derefString(req.Description), Valid: req.Description != nil},
		Definition:  defBytes,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
		Type:   "ENTITY_DELTA",
		Table:  "project_templates",
		Action: ws.ActionUpdate,
		ID:     id.String(),
		Data:   tmpl,
	})

	c.JSON(http.StatusOK, tmpl)
}

func (h *ProjectHandler) DeleteTemplate(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	tmplID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid template id"})
		return
	}

	if err := h.queries.SoftDeleteProjectTemplate(c.Request.Context(), sqlc.SoftDeleteProjectTemplateParams{
		ID:     pgtype.UUID{Bytes: tmplID, Valid: true},
		UserID: pgtype.UUID{Bytes: userID, Valid: true},
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
		Type:   "ENTITY_DELTA",
		Table:  "project_templates",
		Action: ws.ActionDelete,
		ID:     tmplID.String(),
	})

	c.JSON(http.StatusOK, gin.H{"success": true})
}
