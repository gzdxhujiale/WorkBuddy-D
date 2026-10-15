-- name: InsertChangeLog :one
INSERT INTO entity_change_logs (user_id, entity_type, entity_id, action, payload, created_at)
VALUES ($1, $2, $3, $4, $5, now())
RETURNING *;

-- name: ListChangeLogsSince :many
SELECT * FROM entity_change_logs
WHERE user_id = $1 AND seq_id > $2
ORDER BY seq_id ASC
LIMIT 500;

-- name: GetLatestSeqID :one
SELECT COALESCE(MAX(seq_id), 0)::bigint AS latest_seq
FROM entity_change_logs
WHERE user_id = $1;
