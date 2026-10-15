package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgtype"
	"workbuddy-server/internal/database/sqlc"
	"workbuddy-server/internal/middleware"
)

type SyncHandler struct {
	queries sqlc.Querier
}

func NewSyncHandler(queries sqlc.Querier) *SyncHandler {
	return &SyncHandler{queries: queries}
}

// SyncChanges returns delta change logs since a given sequence ID
func (h *SyncHandler) SyncChanges(c *gin.Context) {
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	sinceSeqStr := c.DefaultQuery("since_seq", "0")
	sinceSeq, err := strconv.ParseInt(sinceSeqStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid since_seq parameter"})
		return
	}

	userUUID := pgtype.UUID{Bytes: userID, Valid: true}

	changes, err := h.queries.ListChangeLogsSince(c.Request.Context(), sqlc.ListChangeLogsSinceParams{
		UserID: userUUID,
		SeqID:  sinceSeq,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	latestSeq, err := h.queries.GetLatestSeqID(c.Request.Context(), userUUID)
	if err != nil {
		latestSeq = 0
	}

	hasMore := len(changes) >= 500

	c.JSON(http.StatusOK, gin.H{
		"latest_seq": latestSeq,
		"since_seq":  sinceSeq,
		"has_more":   hasMore,
		"changes":    changes,
	})
}
