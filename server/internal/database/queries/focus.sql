-- name: ListFocusSessions :many
SELECT * FROM focus_sessions
WHERE user_id = $1
ORDER BY started_at DESC
LIMIT 50;

-- name: ListFocusSessionsSince :many
SELECT * FROM focus_sessions
WHERE user_id = $1 AND started_at >= $2
ORDER BY started_at ASC;

-- name: CreateFocusSession :one
INSERT INTO focus_sessions (
    id, user_id, cycle_id, task_id, type, status, planned_minutes,
    active_seconds, rest_completed, started_at, ended_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7,
    $8, $9, now(), $10
)
RETURNING *;

-- name: UpdateFocusSession :one
UPDATE focus_sessions
SET status = $3, active_seconds = $4, rest_completed = $5, ended_at = $6
WHERE id = $1 AND user_id = $2
RETURNING *;

-- name: InterruptOpenFocusSessions :exec
UPDATE focus_sessions
SET status = 'interrupted', ended_at = now()
WHERE user_id = $1 AND status IN ('running', 'paused');
