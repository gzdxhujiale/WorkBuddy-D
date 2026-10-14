-- name: ListProjects :many
SELECT * FROM projects
WHERE user_id = $1 AND deleted_at IS NULL
ORDER BY created_at DESC;

-- name: UpsertProject :one
INSERT INTO projects (
    id, user_id, name, description, status, start_date, end_date,
    priority, tags, owner_name, lock_version, created_at, updated_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7,
    $8, $9, $10, 1, now(), now()
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description, status = EXCLUDED.status,
    start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date, priority = EXCLUDED.priority,
    tags = EXCLUDED.tags, owner_name = EXCLUDED.owner_name,
    lock_version = projects.lock_version + 1, updated_at = now()
WHERE projects.user_id = $2 AND projects.deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteProject :exec
UPDATE projects
SET deleted_at = now(), updated_at = now()
WHERE id = $1 AND user_id = $2;

-- name: SoftDeleteStagesByProject :exec
UPDATE project_stages
SET deleted_at = now(), updated_at = now()
WHERE project_id = $1 AND user_id = $2 AND deleted_at IS NULL;

-- name: SoftDeleteTasksByProject :exec
UPDATE time_management_tasks
SET deleted_at = now(), updated_at = now()
WHERE project_id = $1 AND user_id = $2 AND deleted_at IS NULL;

-- name: ListAllProjectStages :many
SELECT ps.id, ps.user_id, ps.project_id, ps.name, ps.default_assignee_name, ps.sort_order, ps.template_key, ps.start_date, ps.end_date, ps.lock_version, ps.created_at, ps.updated_at, ps.deleted_at
FROM project_stages ps
JOIN projects p ON p.id = ps.project_id
WHERE ps.user_id = $1 AND ps.deleted_at IS NULL AND p.deleted_at IS NULL
ORDER BY ps.sort_order ASC;

-- name: GetNextProjectStageSortOrder :one
SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order
FROM project_stages
WHERE user_id = $1 AND project_id = $2 AND deleted_at IS NULL;

-- name: UpsertProjectStage :one
INSERT INTO project_stages (
    id, user_id, project_id, name, default_assignee_name, sort_order,
    template_key, start_date, end_date, lock_version, created_at, updated_at
) VALUES (
    $1, $2, $3, $4, $5, $6,
    $7, $8, $9, 1, now(), now()
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, default_assignee_name = EXCLUDED.default_assignee_name,
    sort_order = EXCLUDED.sort_order, template_key = EXCLUDED.template_key,
    start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date,
    lock_version = project_stages.lock_version + 1, updated_at = now()
WHERE project_stages.user_id = $2 AND project_stages.deleted_at IS NULL
RETURNING *;

-- name: UpdateProjectStageSortOrder :one
UPDATE project_stages
SET sort_order = $3, lock_version = lock_version + 1, updated_at = now()
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteProjectStage :exec
UPDATE project_stages
SET deleted_at = now(), updated_at = now()
WHERE id = $1 AND user_id = $2;

-- name: SoftDeleteTasksByStage :exec
UPDATE time_management_tasks
SET deleted_at = now(), updated_at = now()
WHERE project_stage_id = $1 AND user_id = $2 AND deleted_at IS NULL;

-- name: ListProjectTemplates :many
SELECT * FROM project_templates
WHERE user_id = $1 AND deleted_at IS NULL
ORDER BY created_at DESC;

-- name: UpsertProjectTemplate :one
INSERT INTO project_templates (
    id, user_id, name, description, definition, lock_version, created_at, updated_at
) VALUES (
    $1, $2, $3, $4, $5, 1, now(), now()
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description,
    definition = EXCLUDED.definition, lock_version = project_templates.lock_version + 1, updated_at = now()
WHERE project_templates.user_id = $2 AND project_templates.deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteProjectTemplate :exec
UPDATE project_templates
SET deleted_at = now(), updated_at = now()
WHERE id = $1 AND user_id = $2;
