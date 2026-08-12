-- Practical hardening for the current single-user application.
-- Keep RLS and the existing RPC API, but make writes predictable:
-- soft-delete from the client, database-owned updated_at, indexed relations,
-- and Postgres Changes for realtime invalidation.

-- Foreign-key lookup indexes.
create index if not exists folder_note_groups_folder_id_idx
  on public.folder_note_groups (folder_id);
create index if not exists notes_folder_id_idx
  on public.notes (folder_id);
create index if not exists notes_group_id_idx
  on public.notes (group_id);
create index if not exists habit_checkins_habit_id_idx
  on public.habit_checkins (habit_id);
create index if not exists focus_sessions_task_id_idx
  on public.focus_sessions (task_id);
create index if not exists focus_sessions_cycle_id_idx
  on public.focus_sessions (cycle_id);

-- Query indexes for the active (not soft-deleted) views.
create index if not exists time_management_tasks_active_idx
  on public.time_management_tasks (user_id, completed, created_at desc)
  where deleted_at is null;
create index if not exists habits_active_idx
  on public.habits (user_id, sort_order, created_at)
  where deleted_at is null;
create index if not exists notes_active_idx
  on public.notes (user_id, folder_id, sort_order)
  where deleted_at is null;
create index if not exists knowledge_bases_active_idx
  on public.knowledge_bases (user_id, sort_order)
  where deleted_at is null;
create index if not exists knowledge_base_folders_active_idx
  on public.knowledge_base_folders (user_id, knowledge_base_id, sort_order)
  where deleted_at is null;
create index if not exists tasks_schedule_active_idx
  on public.time_management_tasks (user_id, scheduled_end_at)
  where deleted_at is null and scheduled_end_at is not null;
create index if not exists focus_sessions_recent_idx
  on public.focus_sessions (user_id, started_at desc);

-- The unique index already satisfies date lookups.
drop index if exists public.idx_daily_reviews_user_date;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'daily_reviews', 'focus_sessions', 'folder_note_groups', 'habit_checkins',
    'habits', 'knowledge_base_folders', 'knowledge_base_templates',
    'knowledge_bases', 'notes', 'time_management_tasks'
  ] loop
    execute format(
      'drop trigger if exists %I_set_updated_at on public.%I',
      table_name, table_name
    );
    execute format(
      'create trigger %I_set_updated_at before update on public.%I '
      'for each row execute function public.set_updated_at()',
      table_name, table_name
    );
  end loop;
end
$$;

-- Soft-delete a folder and its children in one transaction. Restoration is
-- intentionally not automatic, so independently deleted children stay deleted.
create or replace function public.soft_delete_knowledge_base(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  deleted_at_value timestamptz := now();
begin
  update public.notes n
     set deleted_at = deleted_at_value
   where n.folder_id in (
     select f.id from public.knowledge_base_folders f
      where f.knowledge_base_id = p_id
        and f.user_id = (select auth.uid())
   ) and n.deleted_at is null and n.user_id = (select auth.uid());

  update public.folder_note_groups g
     set deleted_at = deleted_at_value
   where g.folder_id in (
     select f.id from public.knowledge_base_folders f
      where f.knowledge_base_id = p_id
        and f.user_id = (select auth.uid())
   ) and g.deleted_at is null and g.user_id = (select auth.uid());

  update public.knowledge_base_folders f
     set deleted_at = deleted_at_value
   where f.knowledge_base_id = p_id
     and f.user_id = (select auth.uid())
     and f.deleted_at is null;

  update public.knowledge_bases b
     set deleted_at = deleted_at_value
   where b.id = p_id
     and b.user_id = (select auth.uid())
     and b.deleted_at is null;
end;
$$;

create or replace function public.soft_delete_knowledge_base_folder(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  deleted_at_value timestamptz := now();
begin
  update public.notes n
     set deleted_at = deleted_at_value
   where n.folder_id = p_id
     and n.deleted_at is null
     and n.user_id = (select auth.uid());

  update public.folder_note_groups g
     set deleted_at = deleted_at_value
   where g.folder_id = p_id
     and g.deleted_at is null
     and g.user_id = (select auth.uid());

  update public.knowledge_base_folders f
     set deleted_at = deleted_at_value
   where f.id = p_id
     and f.user_id = (select auth.uid())
     and f.deleted_at is null;
end;
$$;

create or replace function public.soft_delete_habit(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  deleted_at_value timestamptz := now();
begin
  update public.habit_checkins c
     set deleted_at = deleted_at_value
   where c.habit_id = p_id
     and c.user_id = (select auth.uid())
     and c.deleted_at is null;

  update public.habits h
     set deleted_at = deleted_at_value
   where h.id = p_id
     and h.user_id = (select auth.uid())
     and h.deleted_at is null;
end;
$$;

-- The old function referenced retired list_* tables. Remove it so it cannot be
-- called accidentally by a future client.
drop function if exists public.cascade_soft_delete_list();

-- These are application RPCs, not anonymous endpoints. RLS remains the final
-- data boundary for table access.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'save_daily_review', 'save_habit', 'save_note',
         'save_time_management_task', 'reorder_notes',
         'reorder_knowledge_base_folders', 'reorder_knowledge_bases',
         'soft_delete_knowledge_base', 'soft_delete_knowledge_base_folder',
         'soft_delete_habit'
       )
  loop
    execute format('revoke execute on function %s from public', fn.signature);
    execute format('revoke execute on function %s from anon', fn.signature);
    execute format('grant execute on function %s to authenticated', fn.signature);
  end loop;
end
$$;

-- Use Postgres Changes for the focus module too. The client filters every
-- subscription by user_id and invalidates queries rather than trusting event
-- payloads as authoritative data.
do $$
begin
  begin
    alter publication supabase_realtime add table public.focus_sessions;
  exception when duplicate_object then null;
  end;
end
$$;
