-- ============================================================================
-- Migration: Create Habits & Habit Checkins Module
-- Description: Creates habits table (with frequency_type & frequency_days) and
--              habit_checkins table with RLS policies, triggers, and partial indexes.
-- ============================================================================

-- 1. Create habits Table (习惯定义表)
CREATE TABLE IF NOT EXISTS public.habits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    frequency_type TEXT NOT NULL DEFAULT 'daily' CHECK (frequency_type IN ('daily', 'weekly_days', 'custom')),
    frequency_days INT[] NULL DEFAULT NULL,
    goal TEXT NULL,
    start_date DATE NULL,
    duration TEXT NULL,
    category TEXT NULL,
    reminder TEXT NULL,
    auto_popup_log BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL DEFAULT NULL
);

-- Enable RLS for habits
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;

-- Configure RLS Policies for habits
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'habits' AND policyname = 'Users can select own habits') THEN
        CREATE POLICY "Users can select own habits" ON public.habits FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'habits' AND policyname = 'Users can insert own habits') THEN
        CREATE POLICY "Users can insert own habits" ON public.habits FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'habits' AND policyname = 'Users can update own habits') THEN
        CREATE POLICY "Users can update own habits" ON public.habits FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'habits' AND policyname = 'Users can delete own habits') THEN
        CREATE POLICY "Users can delete own habits" ON public.habits FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);
    END IF;
END $$;

-- Trigger for habits updated_at
DROP TRIGGER IF EXISTS update_habits_updated_at ON public.habits;
CREATE TRIGGER update_habits_updated_at
    BEFORE UPDATE ON public.habits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Partial Index for habits
CREATE INDEX IF NOT EXISTS idx_habits_user_active
    ON public.habits (user_id, sort_order)
    WHERE deleted_at IS NULL;


-- 2. Create habit_checkins Table (习惯打卡记录表)
CREATE TABLE IF NOT EXISTS public.habit_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL DEFAULT NULL,
    CONSTRAINT habit_checkins_user_habit_date_key UNIQUE (user_id, habit_id, date)
);

-- Enable RLS for habit_checkins
ALTER TABLE public.habit_checkins ENABLE ROW LEVEL SECURITY;

-- Configure RLS Policies for habit_checkins
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'habit_checkins' AND policyname = 'Users can select own habit_checkins') THEN
        CREATE POLICY "Users can select own habit_checkins" ON public.habit_checkins FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'habit_checkins' AND policyname = 'Users can insert own habit_checkins') THEN
        CREATE POLICY "Users can insert own habit_checkins" ON public.habit_checkins FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'habit_checkins' AND policyname = 'Users can update own habit_checkins') THEN
        CREATE POLICY "Users can update own habit_checkins" ON public.habit_checkins FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'habit_checkins' AND policyname = 'Users can delete own habit_checkins') THEN
        CREATE POLICY "Users can delete own habit_checkins" ON public.habit_checkins FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);
    END IF;
END $$;

-- Trigger for habit_checkins updated_at
DROP TRIGGER IF EXISTS update_habit_checkins_updated_at ON public.habit_checkins;
CREATE TRIGGER update_habit_checkins_updated_at
    BEFORE UPDATE ON public.habit_checkins
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Partial Index for habit_checkins
CREATE INDEX IF NOT EXISTS idx_habit_checkins_user_habit_date
    ON public.habit_checkins (user_id, habit_id, date)
    WHERE deleted_at IS NULL;
