-- Prune unused and legacy columns across application tables:
-- 1. projects: drop legacy due_date (replaced by start_date/end_date).
-- 2. habits: drop unused frequency_days integer[].
-- 3. knowledge_bases: drop unused is_pinned.
-- 4. knowledge_base_folders: drop unused icon, color, view_type, is_pinned.
-- 5. notes: drop unused is_pinned.
-- Recreate affected RPC functions to remove pruned parameters.

-- ---------------------------------------------------------------------------
-- 1. Column Drops
-- ---------------------------------------------------------------------------
alter table public.projects drop column if exists due_date;
alter table public.habits drop column if exists frequency_days;
alter table public.knowledge_bases drop column if exists is_pinned;
alter table public.knowledge_base_folders drop column if exists icon;
alter table public.knowledge_base_folders drop column if exists color;
alter table public.knowledge_base_folders drop column if exists view_type;
alter table public.knowledge_base_folders drop column if exists is_pinned;
alter table public.notes drop column if exists is_pinned;

-- ---------------------------------------------------------------------------
-- 2. Drop Old Function Signatures
-- ---------------------------------------------------------------------------
drop function if exists public.save_knowledge_base(uuid, text, boolean, integer);
drop function if exists public.save_knowledge_base(uuid, text, boolean, integer, timestamptz);
drop function if exists public.save_knowledge_base(uuid, text, integer);

drop function if exists public.save_knowledge_base_folder(uuid, uuid, text, text, text, text, boolean, integer);
drop function if exists public.save_knowledge_base_folder(uuid, uuid, text, text, text, text, boolean, integer, timestamptz);
drop function if exists public.save_knowledge_base_folder(uuid, uuid, text, integer);

drop function if exists public.save_note(uuid, uuid, uuid, text, text, boolean, integer, timestamptz);
drop function if exists public.save_note(uuid, uuid, uuid, text, text, integer, timestamptz);

drop function if exists public.patch_note(uuid, timestamptz, text, text, boolean, integer, uuid, uuid, boolean);
drop function if exists public.patch_note(uuid, timestamptz, text, text, integer, uuid, uuid, boolean);

drop function if exists public.save_habit(uuid, text, text, integer[], text, date, text, text, text, boolean, integer, timestamptz);
drop function if exists public.save_habit(uuid, text, text, text, date, text, text, text, boolean, integer, timestamptz);

-- ---------------------------------------------------------------------------
-- 3. Recreate Clean Functions
-- ---------------------------------------------------------------------------

create function public.save_knowledge_base(
  p_id uuid, p_name text, p_sort_order integer
) returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  insert into public.knowledge_bases (id, user_id, name, sort_order)
  values (p_id, (select auth.uid()), p_name, p_sort_order)
  on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;
end;
$$;

create function public.save_knowledge_base_folder(
  p_id uuid, p_knowledge_base_id uuid, p_name text, p_sort_order integer
) returns integer language plpgsql security invoker set search_path = pg_catalog, public as $$
declare saved_sort_order integer;
begin
  if p_knowledge_base_id is not null and not exists (
    select 1 from public.knowledge_bases b
     where b.id = p_knowledge_base_id and b.user_id = (select auth.uid()) and b.deleted_at is null
  ) then raise exception 'KNOWLEDGE_BASE_NOT_FOUND' using errcode = 'P0002'; end if;

  if exists (select 1 from public.knowledge_base_folders f where f.id = p_id and f.user_id = (select auth.uid())) then
    update public.knowledge_base_folders
       set knowledge_base_id = p_knowledge_base_id, name = p_name, sort_order = p_sort_order
     where id = p_id and user_id = (select auth.uid())
     returning sort_order into saved_sort_order;
  else
    perform pg_advisory_xact_lock(hashtextextended(coalesce(p_knowledge_base_id::text, 'root'), 0));
    select coalesce(max(f.sort_order), -1) + 1 into saved_sort_order
      from public.knowledge_base_folders f
     where f.user_id = (select auth.uid()) and f.deleted_at is null
       and f.knowledge_base_id is not distinct from p_knowledge_base_id;
    insert into public.knowledge_base_folders (
      id, user_id, knowledge_base_id, name, sort_order
    ) values (
      p_id, (select auth.uid()), p_knowledge_base_id, p_name, saved_sort_order
    );
  end if;
  return saved_sort_order;
end;
$$;

create function public.save_note(
  p_id uuid, p_folder_id uuid, p_group_id uuid, p_title text, p_content text,
  p_sort_order integer, p_expected_updated_at timestamptz
) returns table(updated_at timestamptz, sort_order integer)
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare saved_at timestamptz;
declare saved_sort_order integer;
begin
  if not exists (
    select 1 from public.knowledge_base_folders f
     where f.id = p_folder_id and f.user_id = (select auth.uid()) and f.deleted_at is null
  ) then raise exception 'FOLDER_NOT_FOUND' using errcode = 'P0002'; end if;
  if p_group_id is not null and not exists (
    select 1 from public.folder_note_groups g
     where g.id = p_group_id and g.folder_id = p_folder_id
       and g.user_id = (select auth.uid()) and g.deleted_at is null
  ) then raise exception 'GROUP_NOT_FOUND' using errcode = 'P0002'; end if;
  if p_expected_updated_at is null then
    perform pg_advisory_xact_lock(hashtextextended(p_folder_id::text || ':' || coalesce(p_group_id::text, 'root'), 0));
    select coalesce(max(n.sort_order), -1) + 1 into saved_sort_order
      from public.notes n
     where n.user_id = (select auth.uid()) and n.deleted_at is null
       and n.folder_id = p_folder_id and n.group_id is not distinct from p_group_id;
    insert into public.notes (id, user_id, folder_id, group_id, title, content, sort_order)
    values (p_id, (select auth.uid()), p_folder_id, p_group_id, p_title, p_content, saved_sort_order)
    on conflict (id) do nothing returning public.notes.updated_at, public.notes.sort_order
      into saved_at, saved_sort_order;
  else
    update public.notes as n
       set folder_id = p_folder_id, group_id = p_group_id, title = p_title,
           content = p_content, sort_order = p_sort_order
     where n.id = p_id and n.user_id = (select auth.uid()) and n.deleted_at is null
       and date_trunc('milliseconds', n.updated_at) = date_trunc('milliseconds', p_expected_updated_at)
     returning n.updated_at, n.sort_order into saved_at, saved_sort_order;
  end if;
  if saved_at is null then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
  return query select saved_at, saved_sort_order;
end;
$$;

create function public.patch_note(
  p_id uuid, p_expected_updated_at timestamptz, p_title text default null,
  p_content text default null, p_sort_order integer default null,
  p_folder_id uuid default null, p_group_id uuid default null,
  p_set_group boolean default false
) returns timestamptz language plpgsql security invoker set search_path = pg_catalog, public as $$
declare saved_at timestamptz;
begin
  update public.notes
     set title = coalesce(p_title, title), content = coalesce(p_content, content),
         sort_order = coalesce(p_sort_order, sort_order),
         folder_id = coalesce(p_folder_id, folder_id),
         group_id = case when p_set_group then p_group_id else group_id end
   where id = p_id and user_id = (select auth.uid()) and deleted_at is null
     and date_trunc('milliseconds', updated_at) = date_trunc('milliseconds', p_expected_updated_at)
   returning updated_at into saved_at;
  if saved_at is null then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
  return saved_at;
end;
$$;

create function public.save_habit(
  p_id uuid, p_name text, p_frequency_type text, p_goal text,
  p_start_date date, p_duration text, p_category text, p_reminder text,
  p_auto_popup_log boolean, p_sort_order integer,
  p_expected_updated_at timestamptz
) returns timestamptz language plpgsql security invoker set search_path = pg_catalog, public as $$
declare saved_at timestamptz;
begin
  if p_expected_updated_at is null then
    insert into public.habits (
      id, user_id, name, frequency_type, goal, start_date,
      duration, category, reminder, auto_popup_log, sort_order
    ) values (
      p_id, (select auth.uid()), p_name, p_frequency_type,
      p_goal, p_start_date, p_duration, p_category, p_reminder,
      p_auto_popup_log, p_sort_order
    ) on conflict (id) do nothing returning updated_at into saved_at;
  else
    update public.habits
       set name = p_name, frequency_type = p_frequency_type,
           goal = p_goal, start_date = p_start_date, duration = p_duration,
           category = p_category, reminder = p_reminder,
           auto_popup_log = p_auto_popup_log, sort_order = p_sort_order
     where id = p_id and user_id = (select auth.uid()) and deleted_at is null
       and date_trunc('milliseconds', updated_at) = date_trunc('milliseconds', p_expected_updated_at)
     returning updated_at into saved_at;
  end if;
  if saved_at is null then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
  return saved_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Permissions
-- ---------------------------------------------------------------------------
do $$
declare fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'save_knowledge_base', 'save_knowledge_base_folder',
      'save_note', 'patch_note', 'save_habit'
    )
  loop
    execute format('revoke execute on function %s from public, anon', fn.signature);
    execute format('grant execute on function %s to authenticated', fn.signature);
  end loop;
end;
$$;
