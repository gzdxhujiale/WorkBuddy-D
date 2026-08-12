-- Support the existing foreign-key access paths identified by the Supabase
-- performance advisor. These indexes also prevent relationship maintenance
-- from scanning whole tables as user data grows.

create index if not exists focus_sessions_task_id_idx
  on public.focus_sessions (task_id);

create index if not exists folder_note_groups_folder_id_idx
  on public.folder_note_groups (folder_id);

create index if not exists habit_checkins_habit_id_idx
  on public.habit_checkins (habit_id);

create index if not exists knowledge_base_folders_knowledge_base_id_idx
  on public.knowledge_base_folders (knowledge_base_id);

create index if not exists notes_group_id_idx
  on public.notes (group_id);

create index if not exists notes_folder_id_idx
  on public.notes (folder_id);
