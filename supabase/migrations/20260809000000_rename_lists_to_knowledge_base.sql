-- Rename the Lists & Notes domain to Knowledge Base.
-- Existing rows are preserved; only relation/table names are changed.

ALTER TABLE IF EXISTS public.list_folders
  RENAME TO knowledge_bases;

ALTER TABLE IF EXISTS public.list_lists
  RENAME TO knowledge_base_folders;

ALTER TABLE IF EXISTS public.list_note_groups
  RENAME TO folder_note_groups;

ALTER TABLE IF EXISTS public.list_notes
  RENAME TO notes;

ALTER TABLE IF EXISTS public.list_templates
  RENAME TO knowledge_base_templates;

ALTER TABLE IF EXISTS public.knowledge_base_folders
  RENAME COLUMN folder_id TO knowledge_base_id;

ALTER TABLE IF EXISTS public.folder_note_groups
  RENAME COLUMN list_id TO folder_id;

ALTER TABLE IF EXISTS public.notes
  RENAME COLUMN list_id TO folder_id;

-- Rebuild the soft-delete cascade against the new folder/knowledge-base names.
DROP TRIGGER IF EXISTS trg_cascade_soft_delete_list ON public.knowledge_base_folders;

CREATE OR REPLACE FUNCTION public.cascade_soft_delete_folder()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE public.notes
    SET deleted_at = NEW.deleted_at
    WHERE folder_id = NEW.id AND deleted_at IS NULL;

    UPDATE public.folder_note_groups
    SET deleted_at = NEW.deleted_at
    WHERE folder_id = NEW.id AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

DROP TRIGGER IF EXISTS trg_cascade_soft_delete_folder ON public.knowledge_base_folders;
CREATE TRIGGER trg_cascade_soft_delete_folder
  AFTER UPDATE OF deleted_at ON public.knowledge_base_folders
  FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_folder();
