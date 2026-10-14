package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"workbuddy-server/internal/database/sqlc"
	"workbuddy-server/internal/middleware"
	"workbuddy-server/internal/ws"
)

type FocusHandler struct {
	queries sqlc.Querier
	hub     *ws.Hub
}

func NewFocusHandler(queries sqlc.Querier, hub *ws.Hub) *FocusHandler {
	return &FocusHandler{queries: queries, hub: hub}
}

func (h *FocusHandler) ListFocusSessions(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	sinceStr := c.Query("since")
	if sinceStr != "" {
		if t, err := time.Parse(time.RFC3339, sinceStr); err == nil {
			sessions, err := h.queries.ListFocusSessionsSince(c.Request.Context(), sqlc.ListFocusSessionsSinceParams{
				UserID:    pgtype.UUID{Bytes: userID, Valid: true},
				StartedAt: pgtype.Timestamptz{Time: t, Valid: true},
			})
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, sessions)
			return
		}
	}

	sessions, err := h.queries.ListFocusSessions(c.Request.Context(), pgtype.UUID{Bytes: userID, Valid: true})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, sessions)
}

type CreateFocusSessionInput struct {
	ID             string  `json:"id"`
	CycleID        string  `json:"cycle_id" binding:"required"`
	TaskID         *string `json:"task_id"`
	Type           string  `json:"type"`
	Status         string  `json:"status"`
	PlannedMinutes int16   `json:"planned_minutes"`
	ActiveSeconds  int32   `json:"active_seconds"`
	RestCompleted  bool    `json:"rest_completed"`
}

func (h *FocusHandler) CreateSession(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	var req CreateFocusSessionInput
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

	cycleUUID, err := uuid.Parse(req.CycleID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid cycle id"})
		return
	}

	var taskUUID pgtype.UUID
	if req.TaskID != nil && *req.TaskID != "" {
		if p, err := uuid.Parse(*req.TaskID); err == nil {
			taskUUID = pgtype.UUID{Bytes: p, Valid: true}
		}
	}

	sessType := req.Type
	if sessType == "" {
		sessType = "focus"
	}
	sessStatus := req.Status
	if sessStatus == "" {
		sessStatus = "running"
	}

	session, err := h.queries.CreateFocusSession(c.Request.Context(), sqlc.CreateFocusSessionParams{
		ID:             pgtype.UUID{Bytes: id, Valid: true},
		UserID:         pgtype.UUID{Bytes: userID, Valid: true},
		CycleID:        pgtype.UUID{Bytes: cycleUUID, Valid: true},
		TaskID:         taskUUID,
		Type:           sessType,
		Status:         sessStatus,
		PlannedMinutes: req.PlannedMinutes,
		ActiveSeconds:  req.ActiveSeconds,
		RestCompleted:  req.RestCompleted,
		EndedAt:        pgtype.Timestamptz{Valid: false},
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
		Type:   "ENTITY_DELTA",
		Table:  "focus_sessions",
		Action: ws.ActionInsert,
		ID:     id.String(),
		Data:   session,
	})

	c.JSON(http.StatusCreated, session)
}

type UpdateFocusSessionInput struct {
	Status        string `json:"status"`
	ActiveSeconds int32  `json:"active_seconds"`
	RestCompleted bool   `json:"rest_completed"`
}

func (h *FocusHandler) UpdateSession(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	idStr := c.Param("id")
	sessID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid session id"})
		return
	}

	var req UpdateFocusSessionInput
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var endedTS pgtype.Timestamptz
	if req.Status == "completed" || req.Status == "interrupted" {
		endedTS = pgtype.Timestamptz{Time: time.Now(), Valid: true}
	}

	session, err := h.queries.UpdateFocusSession(c.Request.Context(), sqlc.UpdateFocusSessionParams{
		ID:            pgtype.UUID{Bytes: sessID, Valid: true},
		UserID:        pgtype.UUID{Bytes: userID, Valid: true},
		Status:        req.Status,
		ActiveSeconds: req.ActiveSeconds,
		RestCompleted: req.RestCompleted,
		EndedAt:       endedTS,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
		Type:   "ENTITY_DELTA",
		Table:  "focus_sessions",
		Action: ws.ActionUpdate,
		ID:     sessID.String(),
		Data:   session,
	})

	c.JSON(http.StatusOK, session)
}

func (h *FocusHandler) InterruptOpenSessions(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	if err := h.queries.InterruptOpenFocusSessions(c.Request.Context(), pgtype.UUID{Bytes: userID, Valid: true}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}
