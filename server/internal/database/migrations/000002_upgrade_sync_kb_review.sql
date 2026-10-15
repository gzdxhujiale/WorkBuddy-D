-- 000002_upgrade_sync_kb_review.sql: Ordered Sync Logs, Trigram Search, and Review Metadata Support
-- +goose Up

-- 1. Trigram Extension for fuzzy and substring search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Entity Change Logs table for sequential delta synchronization
CREATE TABLE IF NOT EXISTS entity_change_logs (
    seq_id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    action TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_change_logs_user_seq ON entity_change_logs (user_id, seq_id);
CREATE INDEX IF NOT EXISTS idx_change_logs_created_at ON entity_change_logs (created_at);

-- 3. Trigram GIN index on notes for full-text and substring search
CREATE INDEX IF NOT EXISTS idx_notes_trgm_search ON notes USING gin ((title || ' ' || content) gin_trgm_ops)
WHERE deleted_at IS NULL;

-- +goose Down
DROP INDEX IF EXISTS idx_notes_trgm_search;
DROP TABLE IF EXISTS entity_change_logs;

