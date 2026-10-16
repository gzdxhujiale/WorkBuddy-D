-- 000007_add_thinking_duration_to_ai_messages.sql: Add thinking duration column to ai_messages
-- +goose Up
ALTER TABLE ai_messages ADD COLUMN thinking_duration_ms BIGINT;

-- +goose Down
ALTER TABLE ai_messages DROP COLUMN thinking_duration_ms;
