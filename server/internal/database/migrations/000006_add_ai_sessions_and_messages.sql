-- 000006_add_ai_sessions_and_messages.sql: AI conversation sessions and structured messages
-- +goose Up

-- AI Conversation Sessions
CREATE TABLE IF NOT EXISTS ai_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '新对话',
    skill_code TEXT NOT NULL DEFAULT 'general',
    model_name TEXT NOT NULL DEFAULT '',
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_sessions_user ON ai_sessions (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_pinned ON ai_sessions (user_id, is_pinned, updated_at DESC);

-- AI Conversation Messages
CREATE TABLE IF NOT EXISTS ai_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    reasoning_content TEXT NOT NULL DEFAULT '',
    tool_calls JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_session ON ai_messages (session_id, created_at ASC);

-- +goose Down
DROP TABLE IF EXISTS ai_messages;
DROP TABLE IF EXISTS ai_sessions;
