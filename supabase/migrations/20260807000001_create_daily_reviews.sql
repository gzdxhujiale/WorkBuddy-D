-- ============================================================================
-- Migration: Create Daily Review Module
-- Description: Creates daily_reviews table with RLS policies, updated_at trigger,
--              unique date constraints, and partial indexes.
-- ============================================================================

-- 1. Create daily_reviews Table (每日复盘表)
CREATE TABLE IF NOT EXISTS public.daily_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL DEFAULT NULL,
    CONSTRAINT daily_reviews_user_date_key UNIQUE (user_id, date)
);

-- 2. Enable RLS for daily_reviews
ALTER TABLE public.daily_reviews ENABLE ROW LEVEL SECURITY;

-- 3. Configure RLS Policies
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_reviews' AND policyname = 'Users can select own daily_reviews') THEN
        CREATE POLICY "Users can select own daily_reviews" ON public.daily_reviews FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_reviews' AND policyname = 'Users can insert own daily_reviews') THEN
        CREATE POLICY "Users can insert own daily_reviews" ON public.daily_reviews FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_reviews' AND policyname = 'Users can update own daily_reviews') THEN
        CREATE POLICY "Users can update own daily_reviews" ON public.daily_reviews FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_reviews' AND policyname = 'Users can delete own daily_reviews') THEN
        CREATE POLICY "Users can delete own daily_reviews" ON public.daily_reviews FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);
    END IF;
END $$;

-- 4. Trigger for daily_reviews updated_at
DROP TRIGGER IF EXISTS update_daily_reviews_updated_at ON public.daily_reviews;
CREATE TRIGGER update_daily_reviews_updated_at
    BEFORE UPDATE ON public.daily_reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Partial Index for Active Daily Reviews Querying
CREATE INDEX IF NOT EXISTS idx_daily_reviews_user_date
    ON public.daily_reviews (user_id, date)
    WHERE deleted_at IS NULL;
