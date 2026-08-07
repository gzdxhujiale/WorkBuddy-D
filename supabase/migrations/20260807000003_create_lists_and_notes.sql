-- ============================================================================
-- Migration: Create Lists & Notes Module Tables
-- Description: Creates list_folders, list_lists, list_note_groups, list_notes,
--              and list_templates tables with RLS policies, updated_at triggers,
--              and high-performance partial indexes.
-- ============================================================================

-- Helper Function for updated_at column timestamp refresh
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Create list_folders Table (清单文件夹表)
CREATE TABLE IF NOT EXISTS public.list_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL DEFAULT NULL
);

-- Enable RLS for list_folders
ALTER TABLE public.list_folders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'list_folders' AND policyname = 'Users can select own list_folders') THEN
        CREATE POLICY "Users can select own list_folders" ON public.list_folders FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'list_folders' AND policyname = 'Users can insert own list_folders') THEN
        CREATE POLICY "Users can insert own list_folders" ON public.list_folders FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'list_folders' AND policyname = 'Users can update own list_folders') THEN
        CREATE POLICY "Users can update own list_folders" ON public.list_folders FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'list_folders' AND policyname = 'Users can delete own list_folders') THEN
        CREATE POLICY "Users can delete own list_folders" ON public.list_folders FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);
    END IF;
END $$;

DROP TRIGGER IF EXISTS update_list_folders_updated_at ON public.list_folders;
CREATE TRIGGER update_list_folders_updated_at
    BEFORE UPDATE ON public.list_folders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_list_folders_active
    ON public.list_folders (user_id, sort_order)
    WHERE deleted_at IS NULL;


-- 2. Create list_lists Table (清单/卡片集表)
CREATE TABLE IF NOT EXISTS public.list_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    folder_id UUID NULL REFERENCES public.list_folders(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT '#000000',
    view_type TEXT NOT NULL DEFAULT 'list' CHECK (view_type IN ('list', 'kanban', 'grid')),
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL DEFAULT NULL
);

-- Enable RLS for list_lists
ALTER TABLE public.list_lists ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'list_lists' AND policyname = 'Users can select own list_lists') THEN
        CREATE POLICY "Users can select own list_lists" ON public.list_lists FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'list_lists' AND policyname = 'Users can insert own list_lists') THEN
        CREATE POLICY "Users can insert own list_lists" ON public.list_lists FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'list_lists' AND policyname = 'Users can update own list_lists') THEN
        CREATE POLICY "Users can update own list_lists" ON public.list_lists FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'list_lists' AND policyname = 'Users can delete own list_lists') THEN
        CREATE POLICY "Users can delete own list_lists" ON public.list_lists FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);
    END IF;
END $$;

DROP TRIGGER IF EXISTS update_list_lists_updated_at ON public.list_lists;
CREATE TRIGGER update_list_lists_updated_at
    BEFORE UPDATE ON public.list_lists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_list_lists_folder
    ON public.list_lists (user_id, folder_id, sort_order)
    WHERE deleted_at IS NULL;


-- 3. Create list_note_groups Table (清单笔记分组表)
CREATE TABLE IF NOT EXISTS public.list_note_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    list_id UUID NOT NULL REFERENCES public.list_lists(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL DEFAULT NULL
);

-- Enable RLS for list_note_groups
ALTER TABLE public.list_note_groups ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'list_note_groups' AND policyname = 'Users can select own list_note_groups') THEN
        CREATE POLICY "Users can select own list_note_groups" ON public.list_note_groups FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'list_note_groups' AND policyname = 'Users can insert own list_note_groups') THEN
        CREATE POLICY "Users can insert own list_note_groups" ON public.list_note_groups FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'list_note_groups' AND policyname = 'Users can update own list_note_groups') THEN
        CREATE POLICY "Users can update own list_note_groups" ON public.list_note_groups FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'list_note_groups' AND policyname = 'Users can delete own list_note_groups') THEN
        CREATE POLICY "Users can delete own list_note_groups" ON public.list_note_groups FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);
    END IF;
END $$;

DROP TRIGGER IF EXISTS update_list_note_groups_updated_at ON public.list_note_groups;
CREATE TRIGGER update_list_note_groups_updated_at
    BEFORE UPDATE ON public.list_note_groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_list_note_groups_list
    ON public.list_note_groups (user_id, list_id, sort_order)
    WHERE deleted_at IS NULL;


-- 4. Create list_notes Table (笔记/卡片条目表)
CREATE TABLE IF NOT EXISTS public.list_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    list_id UUID NOT NULL REFERENCES public.list_lists(id) ON DELETE CASCADE,
    group_id UUID NULL REFERENCES public.list_note_groups(id) ON DELETE SET NULL,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL DEFAULT NULL
);

-- Enable RLS for list_notes
ALTER TABLE public.list_notes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'list_notes' AND policyname = 'Users can select own list_notes') THEN
        CREATE POLICY "Users can select own list_notes" ON public.list_notes FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'list_notes' AND policyname = 'Users can insert own list_notes') THEN
        CREATE POLICY "Users can insert own list_notes" ON public.list_notes FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'list_notes' AND policyname = 'Users can update own list_notes') THEN
        CREATE POLICY "Users can update own list_notes" ON public.list_notes FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'list_notes' AND policyname = 'Users can delete own list_notes') THEN
        CREATE POLICY "Users can delete own list_notes" ON public.list_notes FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);
    END IF;
END $$;

DROP TRIGGER IF EXISTS update_list_notes_updated_at ON public.list_notes;
CREATE TRIGGER update_list_notes_updated_at
    BEFORE UPDATE ON public.list_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_list_notes_list_group
    ON public.list_notes (user_id, list_id, group_id, sort_order)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_list_notes_pinned
    ON public.list_notes (user_id, list_id, is_pinned)
    WHERE deleted_at IS NULL AND is_pinned = TRUE;


-- 5. Create list_templates Table (清单/笔记模板表)
CREATE TABLE IF NOT EXISTS public.list_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL DEFAULT NULL
);

-- Enable RLS for list_templates
ALTER TABLE public.list_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'list_templates' AND policyname = 'Users can select own list_templates') THEN
        CREATE POLICY "Users can select own list_templates" ON public.list_templates FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'list_templates' AND policyname = 'Users can insert own list_templates') THEN
        CREATE POLICY "Users can insert own list_templates" ON public.list_templates FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'list_templates' AND policyname = 'Users can update own list_templates') THEN
        CREATE POLICY "Users can update own list_templates" ON public.list_templates FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'list_templates' AND policyname = 'Users can delete own list_templates') THEN
        CREATE POLICY "Users can delete own list_templates" ON public.list_templates FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);
    END IF;
END $$;

DROP TRIGGER IF EXISTS update_list_templates_updated_at ON public.list_templates;
CREATE TRIGGER update_list_templates_updated_at
    BEFORE UPDATE ON public.list_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_list_templates_active
    ON public.list_templates (user_id)
    WHERE deleted_at IS NULL;
