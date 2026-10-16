-- 000005_add_ai_module_tables.sql: AI gateway channels, skills, and invocation audit logs
-- +goose Up

-- AI Provider Channels (Gateway)
CREATE TABLE IF NOT EXISTS ai_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    provider TEXT NOT NULL,
    base_url TEXT NOT NULL DEFAULT '',
    api_key TEXT NOT NULL DEFAULT '',
    models JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_channels_user ON ai_channels (user_id, is_active);

-- AI Skills (Prompt templates & bound tools)
CREATE TABLE IF NOT EXISTS ai_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    system_prompt TEXT NOT NULL DEFAULT '',
    temperature DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    bound_tools JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_ai_skills_user_code UNIQUE (user_id, code)
);

CREATE INDEX IF NOT EXISTS idx_ai_skills_user ON ai_skills (user_id);

-- AI Invocation Audit Logs (Observability & Metrics)
CREATE TABLE IF NOT EXISTS ai_invocation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_code TEXT NOT NULL DEFAULT '',
    model_name TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT '',
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_latency_ms BIGINT NOT NULL DEFAULT 0,
    ttft_ms BIGINT NOT NULL DEFAULT 0,
    status_code INTEGER NOT NULL DEFAULT 200,
    error_msg TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_logs_user_created ON ai_invocation_logs (user_id, created_at DESC);

-- +goose Down
DROP TABLE IF EXISTS ai_invocation_logs;
DROP TABLE IF EXISTS ai_skills;
DROP TABLE IF EXISTS ai_channels;
