-- 000010_add_stage_history_to_tasks.sql: Add stage_history to time_management_tasks
-- +goose Up
ALTER TABLE time_management_tasks ADD COLUMN IF NOT EXISTS stage_history JSONB NOT NULL DEFAULT '[]'::jsonb;

-- +goose Down
ALTER TABLE time_management_tasks DROP COLUMN IF EXISTS stage_history;
