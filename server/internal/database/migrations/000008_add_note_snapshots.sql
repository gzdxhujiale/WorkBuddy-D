-- 000008_add_note_snapshots.sql: Add note_snapshots table for Yjs collaborative state and visual version diffing
-- +goose Up
CREATE TABLE IF NOT EXISTS note_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    snapshot_data BYTEA NOT NULL,
    summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_note_snapshots_note_id ON note_snapshots(note_id, created_at DESC);

-- +goose Down
DROP TABLE IF EXISTS note_snapshots;
