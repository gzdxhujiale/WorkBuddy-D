package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/components/tool/utils"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"workbuddy-server/internal/database/sqlc"
	"workbuddy-server/internal/ws"
)

// DailyReviewDTO represents a review record.
type DailyReviewDTO struct {
	ID      string `json:"id"`
	Date    string `json:"date"`
	Content string `json:"content"`
}

// GetDailyReviewInput holds the date query.
type GetDailyReviewInput struct {
	Date string `json:"date" jsonschema:"required" jsonschema_description:"Date string YYYY-MM-DD"`
}

// NewGetDailyReviewTool retrieves an existing review for a specific date.
func NewGetDailyReviewTool(queries sqlc.Querier) (tool.InvokableTool, error) {
	return utils.InferTool(
		"get_daily_review",
		"Get existing daily review content for a specific date (YYYY-MM-DD)",
		func(ctx context.Context, in GetDailyReviewInput) (DailyReviewDTO, error) {
			userID, err := GetUserID(ctx)
			if err != nil {
				return DailyReviewDTO{}, err
			}

			parsedDate, err := time.Parse("2006-01-02", in.Date)
			if err != nil {
				return DailyReviewDTO{}, fmt.Errorf("invalid date format, expect YYYY-MM-DD: %w", err)
			}

			userUUID := pgtype.UUID{Bytes: userID, Valid: true}
			dateVal := pgtype.Date{Time: parsedDate, Valid: true}

			rev, err := queries.GetDailyReviewByDate(ctx, sqlc.GetDailyReviewByDateParams{
				UserID: userUUID,
				Date:   dateVal,
			})
			if err != nil {
				return DailyReviewDTO{Date: in.Date, Content: ""}, nil
			}

			return DailyReviewDTO{
				ID:      uuidToString(rev.ID),
				Date:    in.Date,
				Content: string(rev.Content),
			}, nil
		},
	)
}

// UpsertDailyReviewInput provides parameters for saving daily review.
type UpsertDailyReviewInput struct {
	Date    string `json:"date" jsonschema:"required" jsonschema_description:"Target date YYYY-MM-DD"`
	Content string `json:"content" jsonschema:"required" jsonschema_description:"Review markdown or structured text content"`
}

// NewUpsertDailyReviewTool creates or updates a daily review.
func NewUpsertDailyReviewTool(queries sqlc.Querier, hub *ws.Hub) (tool.InvokableTool, error) {
	return utils.InferTool(
		"upsert_daily_review",
		"Save or update daily review content for a specific date (YYYY-MM-DD)",
		func(ctx context.Context, in UpsertDailyReviewInput) (DailyReviewDTO, error) {
			userID, err := GetUserID(ctx)
			if err != nil {
				return DailyReviewDTO{}, err
			}

			parsedDate, err := time.Parse("2006-01-02", in.Date)
			if err != nil {
				return DailyReviewDTO{}, fmt.Errorf("invalid date format: %w", err)
			}

			rawContent := []byte(in.Content)
			if !json.Valid(rawContent) {
				// Wrap plain text / markdown as JSON string for jsonb column compatibility
				marshaled, _ := json.Marshal(in.Content)
				rawContent = marshaled
			}

			id := uuid.New()
			userUUID := pgtype.UUID{Bytes: userID, Valid: true}
			dateVal := pgtype.Date{Time: parsedDate, Valid: true}

			saved, err := queries.UpsertDailyReview(ctx, sqlc.UpsertDailyReviewParams{
				ID:      pgtype.UUID{Bytes: id, Valid: true},
				UserID:  userUUID,
				Date:    dateVal,
				Content: rawContent,
			})
			if err != nil {
				return DailyReviewDTO{}, fmt.Errorf("save daily review failed: %w", err)
			}

			dto := DailyReviewDTO{
				ID:      uuidToString(saved.ID),
				Date:    in.Date,
				Content: in.Content,
			}

			if hub != nil {
				hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
					Type:   "ENTITY_DELTA",
					Table:  "daily_reviews",
					Action: ws.ActionUpdate,
					ID:     dto.ID,
					Data:   dto,
				})
			}
			return dto, nil
		},
	)
}

// TodayActivitiesDTO bundles facts for automated review synthesis.
type TodayActivitiesDTO struct {
	Date               string    `json:"date"`
	CompletedTasks     []TaskDTO `json:"completed_tasks"`
	PendingTasks       []TaskDTO `json:"pending_tasks"`
	TotalFocusMinutes  int       `json:"total_focus_minutes"`
	FocusSessionsCount int       `json:"focus_sessions_count"`
	HabitCheckinsCount int       `json:"habit_checkins_count"`
}

// GetTodayActivitiesInput filters activities by date.
type GetTodayActivitiesInput struct {
	Date string `json:"date" jsonschema:"required" jsonschema_description:"Date string YYYY-MM-DD"`
}

// NewGetTodayActivitiesTool extracts tasks, focus sessions and habits for review synthesis.
func NewGetTodayActivitiesTool(queries sqlc.Querier) (tool.InvokableTool, error) {
	return utils.InferTool(
		"get_today_activities",
		"Retrieve summary of completed/pending tasks, focus duration, and habit checkins for a specific date",
		func(ctx context.Context, in GetTodayActivitiesInput) (TodayActivitiesDTO, error) {
			userID, err := GetUserID(ctx)
			if err != nil {
				return TodayActivitiesDTO{}, err
			}

			targetDate, err := time.Parse("2006-01-02", in.Date)
			if err != nil {
				targetDate = time.Now()
			}
			dateStr := targetDate.Format("2006-01-02")
			dayStart := time.Date(targetDate.Year(), targetDate.Month(), targetDate.Day(), 0, 0, 0, 0, targetDate.Location())

			userUUID := pgtype.UUID{Bytes: userID, Valid: true}

			// 1. Tasks
			tasks, err := queries.ListTasks(ctx, userUUID)
			if err != nil {
				return TodayActivitiesDTO{}, fmt.Errorf("fetch tasks: %w", err)
			}

			var completed []TaskDTO
			var pending []TaskDTO
			for _, t := range tasks {
				dto := toTaskDTO(t)
				if t.Completed {
					if t.CompletedAt.Valid && t.CompletedAt.Time.Format("2006-01-02") == dateStr {
						completed = append(completed, dto)
					}
				} else {
					pending = append(pending, dto)
				}
			}

			// 2. Focus Sessions
			focusSessions, _ := queries.ListFocusSessionsSince(ctx, sqlc.ListFocusSessionsSinceParams{
				UserID:    userUUID,
				StartedAt: pgtype.Timestamptz{Time: dayStart, Valid: true},
			})

			totalSeconds := 0
			count := 0
			for _, s := range focusSessions {
				if s.Status == "completed" || s.Status == "paused" || s.Status == "running" {
					totalSeconds += int(s.ActiveSeconds)
					count++
				}
			}

			// 3. Habit Checkins
			checkins, _ := queries.ListAllHabitCheckins(ctx, userUUID)
			habitCount := 0
			for _, c := range checkins {
				if c.Date.Valid && c.Date.Time.Format("2006-01-02") == dateStr && c.Completed {
					habitCount++
				}
			}

			return TodayActivitiesDTO{
				Date:               dateStr,
				CompletedTasks:     completed,
				PendingTasks:       pending,
				TotalFocusMinutes:  totalSeconds / 60,
				FocusSessionsCount: count,
				HabitCheckinsCount: habitCount,
			}, nil
		},
	)
}
