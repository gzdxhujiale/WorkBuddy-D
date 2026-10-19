-- name: ListKnowledgeBases :many
SELECT * FROM knowledge_bases
WHERE user_id = $1 AND deleted_at IS NULL
ORDER BY sort_order ASC, created_at ASC;

-- name: CreateKnowledgeBase :one
INSERT INTO knowledge_bases (id, user_id, name, sort_order, lock_version, created_at, updated_at)
VALUES ($1, $2, $3, $4, 1, now(), now())
RETURNING *;

-- name: UpsertKnowledgeBase :one
INSERT INTO knowledge_bases (id, user_id, name, sort_order, lock_version, created_at, updated_at)
VALUES ($1, $2, $3, $4, 1, now(), now())
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order,
    lock_version = knowledge_bases.lock_version + 1, updated_at = now()
WHERE knowledge_bases.user_id = $2 AND knowledge_bases.deleted_at IS NULL
RETURNING *;

-- name: UpdateKnowledgeBase :one
UPDATE knowledge_bases
SET name = $3, sort_order = $4, lock_version = lock_version + 1, updated_at = now()
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
RETURNING *;

-- name: UpdateKnowledgeBaseSortOrder :one
UPDATE knowledge_bases
SET sort_order = $3, lock_version = lock_version + 1, updated_at = now()
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteKnowledgeBase :exec
UPDATE knowledge_bases
SET deleted_at = now(), updated_at = now()
WHERE id = $1 AND user_id = $2;

-- name: ListFolders :many
SELECT * FROM knowledge_base_folders
WHERE user_id = $1 AND deleted_at IS NULL
ORDER BY sort_order ASC, created_at ASC;

-- name: GetFolderByID :one
SELECT * FROM knowledge_base_folders
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
LIMIT 1;

-- name: CreateFolder :one
INSERT INTO knowledge_base_folders (id, user_id, knowledge_base_id, name, sort_order, lock_version, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, 1, now(), now())
RETURNING *;

-- name: UpsertFolder :one
INSERT INTO knowledge_base_folders (id, user_id, knowledge_base_id, name, sort_order, lock_version, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, 1, now(), now())
ON CONFLICT (id) DO UPDATE
SET knowledge_base_id = EXCLUDED.knowledge_base_id, name = EXCLUDED.name, sort_order = EXCLUDED.sort_order,
    lock_version = knowledge_base_folders.lock_version + 1, updated_at = now()
WHERE knowledge_base_folders.user_id = $2 AND knowledge_base_folders.deleted_at IS NULL
RETURNING *;

-- name: UpdateFolder :one
UPDATE knowledge_base_folders
SET name = $3, sort_order = $4, knowledge_base_id = $5, lock_version = lock_version + 1, updated_at = now()
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
RETURNING *;

-- name: UpdateFolderSortOrder :one
UPDATE knowledge_base_folders
SET sort_order = $3, lock_version = lock_version + 1, updated_at = now()
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteFolder :exec
UPDATE knowledge_base_folders
SET deleted_at = now(), updated_at = now()
WHERE id = $1 AND user_id = $2;

-- name: ListFolderGroups :many
SELECT * FROM folder_note_groups
WHERE user_id = $1 AND folder_id = $2 AND deleted_at IS NULL
ORDER BY sort_order ASC, created_at ASC;

-- name: CreateFolderGroup :one
INSERT INTO folder_note_groups (id, user_id, folder_id, name, sort_order, lock_version, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, 1, now(), now())
RETURNING *;

-- name: UpsertFolderGroup :one
INSERT INTO folder_note_groups (id, user_id, folder_id, name, sort_order, lock_version, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, 1, now(), now())
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order,
    lock_version = folder_note_groups.lock_version + 1, updated_at = now()
WHERE folder_note_groups.user_id = $2 AND folder_note_groups.deleted_at IS NULL
RETURNING *;

-- name: UpdateFolderGroup :one
UPDATE folder_note_groups
SET name = $3, sort_order = $4, lock_version = lock_version + 1, updated_at = now()
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteFolderGroup :exec
UPDATE folder_note_groups
SET deleted_at = now(), updated_at = now()
WHERE id = $1 AND user_id = $2;

-- name: ListNotesInFolder :many
SELECT id, user_id, folder_id, group_id, title, sort_order, lock_version, created_at, updated_at, deleted_at
FROM notes
WHERE user_id = $1 AND folder_id = $2 AND deleted_at IS NULL
ORDER BY sort_order ASC, created_at ASC;

-- name: GetNoteByID :one
SELECT * FROM notes
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
LIMIT 1;

-- name: CreateNote :one
INSERT INTO notes (id, user_id, folder_id, group_id, title, content, sort_order, lock_version, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, 1, now(), now())
RETURNING *;

-- name: UpsertNote :one
INSERT INTO notes (id, user_id, folder_id, group_id, title, content, sort_order, lock_version, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, 1, now(), now())
ON CONFLICT (id) DO UPDATE
SET folder_id = EXCLUDED.folder_id, group_id = EXCLUDED.group_id,
    title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order,
    lock_version = notes.lock_version + 1, updated_at = now()
WHERE notes.user_id = $2 AND notes.deleted_at IS NULL
RETURNING *;

-- name: UpdateNote :one
UPDATE notes
SET title = $3, content = $4, group_id = $5, sort_order = $6, lock_version = lock_version + 1, updated_at = now()
WHERE id = $1 AND user_id = $2 AND lock_version = $7 AND deleted_at IS NULL
RETURNING *;

-- name: PatchNote :one
UPDATE notes
SET title = CASE WHEN $3 = TRUE THEN $4 ELSE title END,
    content = CASE WHEN $5 = TRUE THEN $6 ELSE content END,
    sort_order = CASE WHEN $7 = TRUE THEN $8 ELSE sort_order END,
    folder_id = CASE WHEN $9 = TRUE THEN $10 ELSE folder_id END,
    group_id = CASE WHEN $11 = TRUE THEN $12 ELSE group_id END,
    lock_version = lock_version + 1,
    updated_at = now()
WHERE id = $1 AND user_id = $2 AND lock_version = $13 AND deleted_at IS NULL
RETURNING *;

-- name: ListNotesWithContentInFolder :many
SELECT * FROM notes
WHERE user_id = $1 AND folder_id = $2 AND deleted_at IS NULL
ORDER BY sort_order ASC, created_at ASC;

-- name: DetachFoldersFromKnowledgeBase :exec
UPDATE knowledge_base_folders
SET knowledge_base_id = NULL, updated_at = now()
WHERE knowledge_base_id = $1 AND user_id = $2 AND deleted_at IS NULL;

-- name: UngroupNotesInGroup :exec
UPDATE notes
SET group_id = NULL, updated_at = now()
WHERE group_id = $1 AND user_id = $2 AND deleted_at IS NULL;

-- name: SoftDeleteFolderGroups :exec
UPDATE folder_note_groups
SET deleted_at = now(), updated_at = now()
WHERE folder_id = $1 AND user_id = $2 AND deleted_at IS NULL;

-- name: SoftDeleteFolderNotes :exec
UPDATE notes
SET deleted_at = now(), updated_at = now()
WHERE folder_id = $1 AND user_id = $2 AND deleted_at IS NULL;


-- name: UpdateNoteSortOrder :one
UPDATE notes
SET sort_order = $3, lock_version = lock_version + 1, updated_at = now()
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
RETURNING *;

-- name: MoveNote :one
UPDATE notes
SET folder_id = $3, group_id = $4, sort_order = $5, lock_version = lock_version + 1, updated_at = now()
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteNote :exec
UPDATE notes
SET deleted_at = now(), updated_at = now()
WHERE id = $1 AND user_id = $2;

-- name: ListKnowledgeBaseTemplates :many
SELECT * FROM knowledge_base_templates
WHERE user_id = $1 AND deleted_at IS NULL
ORDER BY created_at ASC;

-- name: UpsertKnowledgeBaseTemplate :one
INSERT INTO knowledge_base_templates (id, user_id, name, content, lock_version, created_at, updated_at)
VALUES ($1, $2, $3, $4, 1, now(), now())
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, content = EXCLUDED.content,
    lock_version = knowledge_base_templates.lock_version + 1, updated_at = now()
WHERE knowledge_base_templates.user_id = $2 AND knowledge_base_templates.deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteKnowledgeBaseTemplate :exec
UPDATE knowledge_base_templates
SET deleted_at = now(), updated_at = now()
WHERE id = $1 AND user_id = $2;

-- name: SearchNotes :many
SELECT id, user_id, folder_id, group_id, title, content, sort_order, lock_version, created_at, updated_at
FROM notes
WHERE user_id = $1 AND deleted_at IS NULL
  AND (title ILIKE '%' || $2 || '%' OR content ILIKE '%' || $2 || '%')
ORDER BY updated_at DESC
LIMIT 50;

-- name: CreateNoteSnapshot :one
INSERT INTO note_snapshots (id, note_id, user_id, snapshot_data, summary, created_at)
VALUES ($1, $2, $3, $4, $5, now())
RETURNING *;

-- name: ListNoteSnapshots :many
SELECT id, note_id, user_id, summary, created_at
FROM note_snapshots
WHERE note_id = $1 AND user_id = $2
ORDER BY created_at DESC
LIMIT $3;

-- name: GetNoteSnapshotByID :one
SELECT *
FROM note_snapshots
WHERE id = $1 AND note_id = $2 AND user_id = $3
LIMIT 1;

-- name: DeleteNoteSnapshot :exec
DELETE FROM note_snapshots
WHERE id = $1 AND note_id = $2 AND user_id = $3;

