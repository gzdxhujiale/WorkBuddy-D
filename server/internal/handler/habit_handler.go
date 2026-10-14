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

type HabitHandler struct {
	queries sqlc.Querier
	hub     *ws.Hub
}

func NewHabitHandler(queries sqlc.Querier, hub *ws.Hub) *HabitHandler {
	return &HabitHandler{queries: queries, hub: hub}
}

func (h *HabitHandler) ListHabits(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	habits, err := h.queries.ListHabits(c.Request.Context(), pgtype.UUID{Bytes: userID, Valid: true})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, habits)
}

type HabitInput struct {
	ID            string  `json:"id"`
	Name          string  `json:"name" binding:"required"`
	FrequencyType string  `json:"frequency_type"`
	Goal          *string `json:"goal"`
	StartDate     *string `json:"start_date"`
	Duration      *string `json:"duration"`
	Category      *string `json:"category"`
	Reminder      *string `json:"reminder"`
	AutoPopupLog  bool    `json:"auto_popup_log"`
	SortOrder     int32   `json:"sort_order"`
	LockVersion   int64   `json:"lock_version"`
}

func (h *HabitHandler) CreateHabit(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	var req HabitInput
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	id := uuid.New()
	if req.ID != "" {
		if parsed, err := uuid.Parse(req.ID); err == nil {
			id = parsed
		}
	}

	freq := req.FrequencyType
	if freq == "" {
		freq = "daily"
	}

	var startDate pgtype.Date
	if req.StartDate != nil && *req.StartDate != "" {
		if t, err := time.Parse("2006-01-02", *req.StartDate); err == nil {
			startDate = pgtype.Date{Time: t, Valid: true}
		}
	}

	habit, err := h.queries.CreateHabit(c.Request.Context(), sqlc.CreateHabitParams{
		ID:            pgtype.UUID{Bytes: id, Valid: true},
		UserID:        pgtype.UUID{Bytes: userID, Valid: true},
		Name:          req.Name,
		FrequencyType: freq,
		Goal:          pgtype.Text{String: derefString(req.Goal), Valid: req.Goal != nil},
		StartDate:     startDate,
		Duration:      pgtype.Text{String: derefString(req.Duration), Valid: req.Duration != nil},
		Category:      pgtype.Text{String: derefString(req.Category), Valid: req.Category != nil},
		Reminder:      pgtype.Text{String: derefString(req.Reminder), Valid: req.Reminder != nil},
		AutoPopupLog:  req.AutoPopupLog,
		SortOrder:     req.SortOrder,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
		Type:   "ENTITY_DELTA",
		Table:  "habits",
		Action: ws.ActionInsert,
		ID:     id.String(),
		Data:   habit,
	})

	c.JSON(http.StatusCreated, habit)
}

type CheckinInput struct {
	HabitID   string `json:"habit_id" binding:"required"`
	Date      string `json:"date" binding:"required"`
	Completed bool   `json:"completed"`
}

func (h *HabitHandler) UpsertCheckin(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	var req CheckinInput
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	habitUUID, err := uuid.Parse(req.HabitID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid habit id"})
		return
	}

	dateParsed, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid date format (YYYY-MM-DD)"})
		return
	}

	checkin, err := h.queries.UpsertHabitCheckin(c.Request.Context(), sqlc.UpsertHabitCheckinParams{
		ID:        pgtype.UUID{Bytes: uuid.New(), Valid: true},
		UserID:    pgtype.UUID{Bytes: userID, Valid: true},
		HabitID:   pgtype.UUID{Bytes: habitUUID, Valid: true},
		Date:      pgtype.Date{Time: dateParsed, Valid: true},
		Completed: req.Completed,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
		Type:   "ENTITY_DELTA",
		Table:  "habit_checkins",
		Action: ws.ActionUpdate,
		ID:     uuid.UUID(checkin.ID.Bytes).String(),
		Data:   checkin,
	})

	c.JSON(http.StatusOK, checkin)
}

func (h *HabitHandler) UpdateHabit(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	habitID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid habit id"})
		return
	}

	var req HabitInput
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	freq := req.FrequencyType
	if freq == "" {
		freq = "daily"
	}

	var startDate pgtype.Date
	if req.StartDate != nil && *req.StartDate != "" {
		if t, err := time.Parse("2006-01-02", *req.StartDate); err == nil {
			startDate = pgtype.Date{Time: t, Valid: true}
		}
	}

	lockVersion := req.LockVersion
	if lockVersion <= 0 {
		lockVersion = 1
	}

	habit, err := h.queries.UpdateHabit(c.Request.Context(), sqlc.UpdateHabitParams{
		ID:            pgtype.UUID{Bytes: habitID, Valid: true},
		UserID:        pgtype.UUID{Bytes: userID, Valid: true},
		Name:          req.Name,
		FrequencyType: freq,
		Goal:          pgtype.Text{String: derefString(req.Goal), Valid: req.Goal != nil},
		StartDate:     startDate,
		Duration:      pgtype.Text{String: derefString(req.Duration), Valid: req.Duration != nil},
		Category:      pgtype.Text{String: derefString(req.Category), Valid: req.Category != nil},
		Reminder:      pgtype.Text{String: derefString(req.Reminder), Valid: req.Reminder != nil},
		AutoPopupLog:  req.AutoPopupLog,
		SortOrder:     req.SortOrder,
		LockVersion:   lockVersion,
	})
	if err != nil {
		// Version conflict or habit deleted/not found
		c.JSON(http.StatusConflict, gin.H{"error": "conflict or habit not found: " + err.Error()})
		return
	}

	h.hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
		Type:   "ENTITY_DELTA",
		Table:  "habits",
		Action: ws.ActionUpdate,
		ID:     habitID.String(),
		Data:   habit,
	})

	c.JSON(http.StatusOK, habit)
}

func (h *HabitHandler) DeleteHabit(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	habitID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid habit id"})
		return
	}

	// Soft delete associated checkins first
	_ = h.queries.SoftDeleteHabitCheckins(c.Request.Context(), sqlc.SoftDeleteHabitCheckinsParams{
		HabitID: pgtype.UUID{Bytes: habitID, Valid: true},
		UserID:  pgtype.UUID{Bytes: userID, Valid: true},
	})

	// Soft delete habit
	if err := h.queries.SoftDeleteHabit(c.Request.Context(), sqlc.SoftDeleteHabitParams{
		ID:     pgtype.UUID{Bytes: habitID, Valid: true},
		UserID: pgtype.UUID{Bytes: userID, Valid: true},
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
		Type:   "ENTITY_DELTA",
		Table:  "habits",
		Action: ws.ActionDelete,
		ID:     habitID.String(),
		Data:   nil,
	})

	c.JSON(http.StatusOK, gin.H{"message": "habit deleted"})
}

func (h *HabitHandler) ListCheckins(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	checkins, err := h.queries.ListAllHabitCheckins(c.Request.Context(), pgtype.UUID{Bytes: userID, Valid: true})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if checkins == nil {
		checkins = []sqlc.HabitCheckin{}
	}
	c.JSON(http.StatusOK, checkins)
}

