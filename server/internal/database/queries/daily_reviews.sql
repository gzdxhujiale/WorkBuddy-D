-- name: ListDailyReviews :many
SELECT * FROM daily_reviews
WHERE user_id = $1
ORDER BY date DESC;

-- name: ListDailyReviewSummaries :many
SELECT id, user_id, date, content, lock_version, created_at, updated_at
FROM daily_reviews
WHERE user_id = $1
ORDER BY date DESC;

-- name: GetDailyReviewByDate :one
SELECT * FROM daily_reviews
WHERE user_id = $1 AND date = $2
LIMIT 1;

-- name: GetDailyReviewDatesInRange :many
SELECT date, id, content, lock_version, updated_at
FROM daily_reviews
WHERE user_id = $1 AND date >= $2 AND date <= $3
ORDER BY date ASC;

-- name: UpsertDailyReview :one
INSERT INTO daily_reviews (id, user_id, date, content, lock_version, created_at, updated_at)
VALUES ($1, $2, $3, $4, 1, now(), now())
ON CONFLICT (user_id, date) DO UPDATE
SET content = EXCLUDED.content, lock_version = daily_reviews.lock_version + 1, updated_at = now()
RETURNING *;

-- name: DeleteDailyReviewByDate :exec
DELETE FROM daily_reviews
WHERE user_id = $1 AND date = $2;

-- name: DeleteDailyReview :exec
DELETE FROM daily_reviews
WHERE user_id = $1 AND id = $2;

