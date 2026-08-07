-- ============================================================================
-- Migration: Create Time Management & Tasks Module
-- Description: Creates mission_roles (dependency) and time_management_tasks table
--              with RLS policies, updated_at triggers, and partial indexes.
-- ============================================================================

-- 1. Ensure Extension & Helper Function for updated_at
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create mission_roles Table (Dependency for FK role_id)
CREATE TABLE IF NOT EXISTS public.mission_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL DEFAULT NULL
);

-- Enable RLS for mission_roles
ALTER TABLE public.mission_roles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mission_roles' AND policyname = 'Users can select own mission_roles') THEN
        CREATE POLICY "Users can select own mission_roles" ON public.mission_roles FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mission_roles' AND policyname = 'Users can insert own mission_roles') THEN
        CREATE POLICY "Users can insert own mission_roles" ON public.mission_roles FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mission_roles' AND policyname = 'Users can update own mission_roles') THEN
        CREATE POLICY "Users can update own mission_roles" ON public.mission_roles FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mission_roles' AND policyname = 'Users can delete own mission_roles') THEN
        CREATE POLICY "Users can delete own mission_roles" ON public.mission_roles FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);
    END IF;
END $$;

-- Trigger for mission_roles updated_at
DROP TRIGGER IF EXISTS update_mission_roles_updated_at ON public.mission_roles;
CREATE TRIGGER update_mission_roles_updated_at
    BEFORE UPDATE ON public.mission_roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_mission_roles_active
    ON public.mission_roles (user_id, sort_order)
    WHERE deleted_at IS NULL;


-- 3. Create time_management_tasks Table (四象限任务表)
CREATE TABLE IF NOT EXISTS public.time_management_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id UUID NULL REFERENCES public.mission_roles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    quadrant TEXT NOT NULL CHECK (quadrant IN (
        'Q1_URGENT_IMPORTANT',
        'Q2_NOT_URGENT_IMPORTANT',
        'Q3_URGENT_NOT_IMPORTANT',
        'Q4_NOT_URGENT_NOT_IMPORTANT'
    )),
    scheduled_date DATE NULL,
    time_of_day TEXT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ NULL,
    description TEXT NULL,
    deadline TIMESTAMPTZ NULL,
    reminder JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL DEFAULT NULL
);

-- Enable RLS for time_management_tasks
ALTER TABLE public.time_management_tasks ENABLE ROW LEVEL SECURITY;

-- Configure RLS Policies
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'time_management_tasks' AND policyname = 'Users can select own tasks') THEN
        CREATE POLICY "Users can select own tasks" ON public.time_management_tasks FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'time_management_tasks' AND policyname = 'Users can insert own tasks') THEN
        CREATE POLICY "Users can insert own tasks" ON public.time_management_tasks FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'time_management_tasks' AND policyname = 'Users can update own tasks') THEN
        CREATE POLICY "Users can update own tasks" ON public.time_management_tasks FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'time_management_tasks' AND policyname = 'Users can delete own tasks') THEN
        CREATE POLICY "Users can delete own tasks" ON public.time_management_tasks FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);
    END IF;
END $$;

-- Trigger for time_management_tasks updated_at
DROP TRIGGER IF EXISTS update_time_management_tasks_updated_at ON public.time_management_tasks;
CREATE TRIGGER update_time_management_tasks_updated_at
    BEFORE UPDATE ON public.time_management_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- High-performance Partial Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_user_active_quadrant
    ON public.time_management_tasks (user_id, quadrant, scheduled_date)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_role_id
    ON public.time_management_tasks (role_id)
    WHERE role_id IS NOT NULL;
