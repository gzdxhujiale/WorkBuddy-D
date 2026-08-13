-- Complete the production hardening that was missing from the workbuddy copy.
-- This migration is idempotent and deliberately preserves all existing data.

-- Index foreign-key columns and the application's common active-record queries.
create index if not exists folder_note_groups_folder_id_idx
  on public.folder_note_groups (folder_id);
create index if not exists notes_folder_id_idx on public.notes (folder_id);
create index if not exists notes_group_id_idx on public.notes (group_id);
create index if not exists habit_checkins_habit_id_idx
  on public.habit_checkins (habit_id);
create index if not exists focus_sessions_task_id_idx
  on public.focus_sessions (task_id);
create index if not exists focus_sessions_cycle_idx
  on public.focus_sessions (cycle_id);
create index if not exists focus_sessions_user_started_idx
  on public.focus_sessions (user_id, started_at desc);

create index if not exists time_management_tasks_active_idx
  on public.time_management_tasks (user_id, completed, created_at desc)
  where deleted_at is null;
create index if not exists tasks_schedule_active_idx
  on public.time_management_tasks (user_id, scheduled_end_at)
  where deleted_at is null and scheduled_end_at is not null;
create index if not exists habits_active_idx
  on public.habits (user_id, sort_order, created_at)
  where deleted_at is null;
create index if not exists habit_checkins_user_deleted_date_idx
  on public.habit_checkins (user_id, deleted_at, date desc);
create index if not exists notes_active_idx
  on public.notes (user_id, folder_id, sort_order)
  where deleted_at is null;
create index if not exists knowledge_bases_active_idx
  on public.knowledge_bases (user_id, sort_order)
  where deleted_at is null;
create index if not exists knowledge_base_folders_active_idx
  on public.knowledge_base_folders (user_id, knowledge_base_id, sort_order)
  where deleted_at is null;
create index if not exists knowledge_base_templates_active_idx
  on public.knowledge_base_templates (user_id)
  where deleted_at is null;

-- Make updated_at database-owned so direct writes and RPC writes behave alike.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
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
    execute format('drop trigger if exists %I on public.%I', table_name || '_set_updated_at', table_name);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      table_name || '_set_updated_at', table_name
    );
  end loop;
end
$$;

-- User-scoped, SECURITY INVOKER soft-delete APIs. RLS still applies.
create or replace function public.soft_delete_knowledge_base(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare deleted_at_value timestamptz := now();
begin
  update public.notes n set deleted_at = deleted_at_value
   where n.folder_id in (
     select f.id from public.knowledge_base_folders f
      where f.knowledge_base_id = p_id and f.user_id = (select auth.uid())
   ) and n.deleted_at is null and n.user_id = (select auth.uid());

  update public.folder_note_groups g set deleted_at = deleted_at_value
   where g.folder_id in (
     select f.id from public.knowledge_base_folders f
      where f.knowledge_base_id = p_id and f.user_id = (select auth.uid())
   ) and g.deleted_at is null and g.user_id = (select auth.uid());

  update public.knowledge_base_folders f set deleted_at = deleted_at_value
   where f.knowledge_base_id = p_id and f.user_id = (select auth.uid())
     and f.deleted_at is null;

  update public.knowledge_bases b set deleted_at = deleted_at_value
   where b.id = p_id and b.user_id = (select auth.uid()) and b.deleted_at is null;
end;
$$;

create or replace function public.soft_delete_knowledge_base_folder(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare deleted_at_value timestamptz := now();
begin
  update public.notes n set deleted_at = deleted_at_value
   where n.folder_id = p_id and n.user_id = (select auth.uid()) and n.deleted_at is null;
  update public.folder_note_groups g set deleted_at = deleted_at_value
   where g.folder_id = p_id and g.user_id = (select auth.uid()) and g.deleted_at is null;
  update public.knowledge_base_folders f set deleted_at = deleted_at_value
   where f.id = p_id and f.user_id = (select auth.uid()) and f.deleted_at is null;
end;
$$;

create or replace function public.soft_delete_habit(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare deleted_at_value timestamptz := now();
begin
  update public.habit_checkins c set deleted_at = deleted_at_value
   where c.habit_id = p_id and c.user_id = (select auth.uid()) and c.deleted_at is null;
  update public.habits h set deleted_at = deleted_at_value
   where h.id = p_id and h.user_id = (select auth.uid()) and h.deleted_at is null;
end;
$$;

-- Expose only authenticated application RPCs, never PUBLIC/anon endpoints.
do $$
declare fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'save_daily_review', 'save_habit', 'save_note', 'save_time_management_task',
        'reorder_notes', 'reorder_knowledge_base_folders', 'reorder_knowledge_bases',
        'soft_delete_knowledge_base', 'soft_delete_knowledge_base_folder', 'soft_delete_habit'
      )
  loop
    execute format('revoke execute on function %s from public, anon', fn.signature);
    execute format('grant execute on function %s to authenticated', fn.signature);
  end loop;
end
$$;

-- Security clean-up for legacy helper functions.
alter function public.update_updated_at_column() set search_path = pg_catalog, public;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- Realtime invalidation uses Postgres Changes. Add every subscribed table.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'daily_reviews', 'focus_sessions', 'folder_note_groups', 'habit_checkins',
    'habits', 'knowledge_base_folders', 'knowledge_base_templates',
    'knowledge_bases', 'notes', 'time_management_tasks'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    exception when duplicate_object then null;
    end;
  end loop;
end
$$;
