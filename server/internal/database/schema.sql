-- schema.sql: WorkBuddy-D clean PostgreSQL schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Knowledge Base
CREATE TABLE IF NOT EXISTS knowledge_bases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    lock_version BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_user ON knowledge_bases (user_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS knowledge_base_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    knowledge_base_id UUID REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    lock_version BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_kb_folders_user ON knowledge_base_folders (user_id, knowledge_base_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS folder_note_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    folder_id UUID NOT NULL REFERENCES knowledge_base_folders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    lock_version BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_folder_groups ON folder_note_groups (user_id, folder_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    folder_id UUID NOT NULL REFERENCES knowledge_base_folders(id) ON DELETE CASCADE,
    group_id UUID REFERENCES folder_note_groups(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    lock_version BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_notes_user_folder ON notes (user_id, folder_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS knowledge_base_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    lock_version BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_kb_templates_user ON knowledge_base_templates (user_id) WHERE deleted_at IS NULL;

-- Habits
CREATE TABLE IF NOT EXISTS habits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    frequency_type TEXT NOT NULL DEFAULT 'daily',
    goal TEXT,
    start_date DATE,
    duration TEXT,
    category TEXT,
    reminder TEXT,
    auto_popup_log BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    lock_version BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_habits_user ON habits (user_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS habit_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_habit_checkin_user_date UNIQUE (user_id, habit_id, date)
);
CREATE INDEX IF NOT EXISTS idx_habit_checkins_user_date ON habit_checkins (user_id, date) WHERE deleted_at IS NULL;

-- Daily Reviews
CREATE TABLE IF NOT EXISTS daily_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    lock_version BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_daily_reviews_user_date UNIQUE (user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_daily_reviews_user_date ON daily_reviews (user_id, date);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'not_started',
    start_date DATE,
    end_date DATE,
    priority TEXT NOT NULL DEFAULT 'medium',
    tags TEXT[] NOT NULL DEFAULT '{}',
    owner_name TEXT,
    lock_version BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects (user_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS project_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    default_assignee_name TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    template_key TEXT,
    start_date DATE,
    end_date DATE,
    lock_version BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_project_stages ON project_stages (user_id, project_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS project_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    definition JSONB NOT NULL DEFAULT '{}'::jsonb,
    lock_version BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_project_templates_user ON project_templates (user_id) WHERE deleted_at IS NULL;

-- Time Management Tasks
CREATE TABLE IF NOT EXISTS time_management_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    quadrant TEXT NOT NULL DEFAULT 'Q2_NOT_URGENT_IMPORTANT',
    schedule_mode TEXT,
    scheduled_start_at TIMESTAMPTZ,
    scheduled_end_at TIMESTAMPTZ,
    completed BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMPTZ,
    description TEXT,
    reminder JSONB,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    project_stage_id UUID REFERENCES project_stages(id) ON DELETE SET NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    assignee_name TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    lock_version BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_tasks_user_quadrant ON time_management_tasks (user_id, quadrant) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_user_project ON time_management_tasks (user_id, project_id) WHERE deleted_at IS NULL;

-- Focus Sessions
CREATE TABLE IF NOT EXISTS focus_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cycle_id UUID NOT NULL,
    task_id UUID REFERENCES time_management_tasks(id) ON DELETE SET NULL,
    type TEXT NOT NULL DEFAULT 'focus',
    status TEXT NOT NULL DEFAULT 'completed',
    planned_minutes SMALLINT NOT NULL DEFAULT 25,
    active_seconds INTEGER NOT NULL DEFAULT 0,
    rest_completed BOOLEAN NOT NULL DEFAULT false,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_time ON focus_sessions (user_id, started_at);

-- 000002_upgrade_sync_kb_review.sql: Ordered Sync Logs, Trigram Search, and Review Metadata Support
CREATE EXTENSION IF NOT EXISTS pg_trgm;

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

CREATE INDEX IF NOT EXISTS idx_notes_trgm_search ON notes USING gin ((title || ' ' || content) gin_trgm_ops)
WHERE deleted_at IS NULL;
