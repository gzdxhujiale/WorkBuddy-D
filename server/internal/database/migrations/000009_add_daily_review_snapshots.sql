-- 000009_add_daily_review_snapshots.sql: Add daily_review_snapshots table for version history and diffing
-- +goose Up
CREATE TABLE IF NOT EXISTS daily_review_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    review_date DATE NOT NULL,
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_review_snapshots_date ON daily_review_snapshots(user_id, review_date, created_at DESC);

-- +goose Down
DROP TABLE IF EXISTS daily_review_snapshots;
