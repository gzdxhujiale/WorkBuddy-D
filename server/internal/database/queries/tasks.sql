-- name: ListTasks :many
SELECT * FROM time_management_tasks
WHERE user_id = $1 AND deleted_at IS NULL
ORDER BY sort_order ASC, created_at DESC;

-- name: ListTasksByProject :many
SELECT * FROM time_management_tasks
WHERE user_id = $1 AND project_id = $2 AND deleted_at IS NULL
ORDER BY sort_order ASC, created_at DESC;

-- name: GetTaskByID :one
SELECT * FROM time_management_tasks
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
LIMIT 1;

-- name: CreateTask :one
INSERT INTO time_management_tasks (
    id, user_id, title, quadrant, schedule_mode, scheduled_start_at, scheduled_end_at,
    completed, completed_at, description, reminder, project_id, project_stage_id,
    priority, assignee_name, sort_order, lock_version, created_at, updated_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7,
    $8, $9, $10, $11, $12, $13,
    $14, $15, $16, 1, now(), now()
)
RETURNING *;

-- name: UpdateTask :one
UPDATE time_management_tasks
SET title = $3, quadrant = $4, schedule_mode = $5, scheduled_start_at = $6, scheduled_end_at = $7,
    completed = $8, completed_at = $9, description = $10, reminder = $11, project_id = $12,
    project_stage_id = $13, priority = $14, assignee_name = $15, sort_order = $16,
    lock_version = lock_version + 1, updated_at = now()
WHERE id = $1 AND user_id = $2 AND lock_version = $17 AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteTask :exec
UPDATE time_management_tasks
SET deleted_at = now(), updated_at = now()
WHERE id = $1 AND user_id = $2;
