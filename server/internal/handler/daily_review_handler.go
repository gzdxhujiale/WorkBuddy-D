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

type DailyReviewHandler struct {
	queries sqlc.Querier
	hub     *ws.Hub
}

func NewDailyReviewHandler(queries sqlc.Querier, hub *ws.Hub) *DailyReviewHandler {
	return &DailyReviewHandler{queries: queries, hub: hub}
}

func (h *DailyReviewHandler) ListDailyReviews(c *gin.Context) {
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	reviews, err := h.queries.ListDailyReviews(c.Request.Context(), pgtype.UUID{Bytes: userID, Valid: true})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, reviews)
}

type UpsertDailyReviewRequest struct {
	ID          string          `json:"id"`
	Date        string          `json:"date" binding:"required"`
	Content     json.RawMessage `json:"content" binding:"required"`
	LockVersion int64           `json:"lock_version"`
}

func (h *DailyReviewHandler) UpsertReview(c *gin.Context) {
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req UpsertDailyReviewRequest
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

	parsedDate, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid date format (YYYY-MM-DD)"})
		return
	}

	review, err := h.queries.UpsertDailyReview(c.Request.Context(), sqlc.UpsertDailyReviewParams{
		ID:      pgtype.UUID{Bytes: id, Valid: true},
		UserID:  pgtype.UUID{Bytes: userID, Valid: true},
		Date:    pgtype.Date{Time: parsedDate, Valid: true},
		Content: req.Content,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
		Type:   "ENTITY_DELTA",
		Table:  "daily_reviews",
		Action: ws.ActionUpdate,
		ID:     uuid.UUID(review.ID.Bytes).String(),
		Data:   review,
	})

	c.JSON(http.StatusOK, review)
}
