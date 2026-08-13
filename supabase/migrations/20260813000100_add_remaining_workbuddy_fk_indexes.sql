-- Cover the remaining foreign keys with full indexes. Partial active-record
-- indexes intentionally do not cover FK checks on soft-deleted rows.
create index if not exists folder_note_groups_user_id_idx
  on public.folder_note_groups (user_id);
create index if not exists knowledge_base_folders_knowledge_base_id_idx
  on public.knowledge_base_folders (knowledge_base_id);
