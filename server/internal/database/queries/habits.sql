-- name: ListHabits :many
SELECT * FROM habits
WHERE user_id = $1 AND deleted_at IS NULL
ORDER BY sort_order ASC, created_at ASC;

-- name: CreateHabit :one
INSERT INTO habits (
    id, user_id, name, frequency_type, goal, start_date, duration, category,
    reminder, auto_popup_log, sort_order, lock_version, created_at, updated_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8,
    $9, $10, $11, 1, now(), now()
)
RETURNING *;

-- name: UpdateHabit :one
UPDATE habits
SET name = $3, frequency_type = $4, goal = $5, start_date = $6, duration = $7,
    category = $8, reminder = $9, auto_popup_log = $10, sort_order = $11,
    lock_version = lock_version + 1, updated_at = now()
WHERE id = $1 AND user_id = $2 AND lock_version = $12 AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteHabit :exec
UPDATE habits
SET deleted_at = now(), updated_at = now()
WHERE id = $1 AND user_id = $2;

-- name: ListHabitCheckins :many
SELECT * FROM habit_checkins
WHERE user_id = $1 AND habit_id = $2 AND deleted_at IS NULL
ORDER BY date DESC;

-- name: UpsertHabitCheckin :one
INSERT INTO habit_checkins (id, user_id, habit_id, date, completed, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, now(), now())
ON CONFLICT (user_id, habit_id, date) DO UPDATE
SET completed = EXCLUDED.completed, updated_at = now(), deleted_at = NULL
RETURNING *;

-- name: ListAllHabitCheckins :many
SELECT * FROM habit_checkins
WHERE user_id = $1 AND deleted_at IS NULL
ORDER BY date DESC;

-- name: SoftDeleteHabitCheckins :exec
UPDATE habit_checkins
SET deleted_at = now(), updated_at = now()
WHERE habit_id = $1 AND user_id = $2 AND deleted_at IS NULL;

