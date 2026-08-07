-- ============================================================================
-- Migration: Add Cascade Soft-Delete Triggers for Lists & Notes Module
-- Description: When a list is soft-deleted (deleted_at set), automatically
--              cascade soft-delete all associated notes and groups.
--              This ensures data integrity at the database level.
-- ============================================================================

-- Trigger function: cascade soft-delete when a list is soft-deleted
CREATE OR REPLACE FUNCTION cascade_soft_delete_list()
RETURNS TRIGGER AS $$
BEGIN
    -- Only cascade when deleted_at changes from NULL to a value
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
        -- Soft-delete all notes belonging to this list
        UPDATE public.list_notes
        SET deleted_at = NEW.deleted_at
        WHERE list_id = NEW.id AND deleted_at IS NULL;

        -- Soft-delete all note groups belonging to this list
        UPDATE public.list_note_groups
        SET deleted_at = NEW.deleted_at
        WHERE list_id = NEW.id AND deleted_at IS NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Attach trigger to list_lists table
DROP TRIGGER IF EXISTS trg_cascade_soft_delete_list ON public.list_lists;
CREATE TRIGGER trg_cascade_soft_delete_list
    AFTER UPDATE OF deleted_at ON public.list_lists
    FOR EACH ROW
    EXECUTE FUNCTION cascade_soft_delete_list();