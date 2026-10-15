package handler

import (
	"encoding/json"
	"errors"
	"math"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
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

func (h *DailyReviewHandler) ListDailyReviewSummaries(c *gin.Context) {
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	summaries, err := h.queries.ListDailyReviewSummaries(c.Request.Context(), pgtype.UUID{Bytes: userID, Valid: true})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, summaries)
}

func (h *DailyReviewHandler) GetDailyReviewByDate(c *gin.Context) {
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	dateParam := c.Param("date")
	parsedDate, err := time.Parse("2006-01-02", dateParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid date format (YYYY-MM-DD)"})
		return
	}

	review, err := h.queries.GetDailyReviewByDate(c.Request.Context(), sqlc.GetDailyReviewByDateParams{
		UserID: pgtype.UUID{Bytes: userID, Valid: true},
		Date:   pgtype.Date{Time: parsedDate, Valid: true},
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "review not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, review)
}

type CompoundStatsResponse struct {
	CurrentStreak int     `json:"current_streak"`
	LongestStreak int     `json:"longest_streak"`
	TotalReviews  int     `json:"total_reviews"`
	CompoundValue float64 `json:"compound_value"`
}

func (h *DailyReviewHandler) GetStats(c *gin.Context) {
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	summaries, err := h.queries.ListDailyReviewSummaries(c.Request.Context(), pgtype.UUID{Bytes: userID, Valid: true})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if len(summaries) == 0 {
		c.JSON(http.StatusOK, CompoundStatsResponse{
			CurrentStreak: 0,
			LongestStreak: 0,
			TotalReviews:  0,
			CompoundValue: 1.00,
		})
		return
	}

	todayStr := time.Now().Format("2006-01-02")
	dateSet := make(map[string]struct{})
	for _, s := range summaries {
		dStr := s.Date.Time.Format("2006-01-02")
		if dStr <= todayStr {
			dateSet[dStr] = struct{}{}
		}
	}

	var dates []string
	for d := range dateSet {
		dates = append(dates, d)
	}
	sort.Strings(dates)

	longestStreak := 0
	currentStreak := 0
	streakCount := 0

	for i := 0; i < len(dates); i++ {
		if i == 0 {
			streakCount = 1
			longestStreak = 1
			continue
		}
		prev, _ := time.Parse("2006-01-02", dates[i-1])
		curr, _ := time.Parse("2006-01-02", dates[i])
		daysDiff := int(curr.Sub(prev).Hours() / 24)
		if daysDiff == 1 {
			streakCount++
			if streakCount > longestStreak {
				longestStreak = streakCount
			}
		} else {
			streakCount = 1
		}
	}

	// Calculate current streak
	today, _ := time.Parse("2006-01-02", todayStr)
	yesterday := today.AddDate(0, 0, -1)
	yesterdayStr := yesterday.Format("2006-01-02")

	_, hasToday := dateSet[todayStr]
	_, hasYesterday := dateSet[yesterdayStr]

	if hasToday || hasYesterday {
		currentStreak = 0
		checkDate := today
		if !hasToday {
			checkDate = yesterday
		}
		for {
			cStr := checkDate.Format("2006-01-02")
			if _, exists := dateSet[cStr]; exists {
				currentStreak++
				checkDate = checkDate.AddDate(0, 0, -1)
			} else {
				break
			}
		}
	}

	totalReviews := len(dates)
	compoundValue := math.Round(math.Pow(1.01, float64(totalReviews))*100) / 100

	c.JSON(http.StatusOK, CompoundStatsResponse{
		CurrentStreak: currentStreak,
		LongestStreak: longestStreak,
		TotalReviews:  totalReviews,
		CompoundValue: compoundValue,
	})
}

func (h *DailyReviewHandler) GetHeatmap(c *gin.Context) {
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	yearStr := c.DefaultQuery("year", strconv.Itoa(time.Now().Year()))
	year, err := strconv.Atoi(yearStr)
	if err != nil {
		year = time.Now().Year()
	}

	startDate, _ := time.Parse("2006-01-02", strconv.Itoa(year)+"-01-01")
	endDate, _ := time.Parse("2006-01-02", strconv.Itoa(year)+"-12-31")

	rows, err := h.queries.GetDailyReviewDatesInRange(c.Request.Context(), sqlc.GetDailyReviewDatesInRangeParams{
		UserID: pgtype.UUID{Bytes: userID, Valid: true},
		Date:   pgtype.Date{Time: startDate, Valid: true},
		Date_2: pgtype.Date{Time: endDate, Valid: true},
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	days := make(map[string]gin.H)
	for _, r := range rows {
		dStr := r.Date.Time.Format("2006-01-02")
		days[dStr] = gin.H{
			"has_review": true,
			"level":      1,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"year": year,
		"days": days,
	})
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
