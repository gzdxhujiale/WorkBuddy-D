-- State-transition timestamps and initial ordering are database-owned facts.
-- Clients provide user intent; PostgreSQL records when it committed that intent.

drop function if exists public.save_time_management_task(uuid, text, text, text, timestamptz, timestamptz, boolean, timestamptz, text, jsonb, timestamptz);
drop function if exists public.save_knowledge_base_folder(uuid, uuid, text, text, text, text, boolean, integer);
drop function if exists public.save_folder_note_group(uuid, uuid, text, integer);
drop function if exists public.save_note(uuid, uuid, uuid, text, text, boolean, integer, timestamptz);
drop function if exists public.create_focus_session(uuid, uuid, uuid, text, text, integer, integer, boolean, timestamptz);

create function public.save_time_management_task(
  p_id uuid, p_title text, p_quadrant text, p_schedule_mode text,
  p_scheduled_start_at timestamptz, p_scheduled_end_at timestamptz,
  p_completed boolean, p_description text, p_reminder jsonb,
  p_expected_updated_at timestamptz
) returns timestamptz language plpgsql security invoker set search_path = pg_catalog, public as $$
declare saved_at timestamptz;
begin
  if p_expected_updated_at is null then
    insert into public.time_management_tasks (
      id, user_id, title, quadrant, schedule_mode, scheduled_start_at,
      scheduled_end_at, completed, completed_at, description, reminder
    ) values (
      p_id, (select auth.uid()), p_title, p_quadrant, p_schedule_mode,
      p_scheduled_start_at, p_scheduled_end_at, p_completed,
      case when p_completed then now() else null end, p_description, p_reminder
    ) on conflict (id) do nothing returning updated_at into saved_at;
  else
    update public.time_management_tasks
       set title = p_title, quadrant = p_quadrant, schedule_mode = p_schedule_mode,
           scheduled_start_at = p_scheduled_start_at, scheduled_end_at = p_scheduled_end_at,
           completed = p_completed,
           completed_at = case
             when p_completed and not completed then now()
             when not p_completed then null
             else completed_at
           end,
           description = p_description, reminder = p_reminder
     where id = p_id and user_id = (select auth.uid()) and deleted_at is null
       and date_trunc('milliseconds', updated_at) = date_trunc('milliseconds', p_expected_updated_at)
     returning updated_at into saved_at;
  end if;
  if saved_at is null then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
  return saved_at;
end;
$$;

create function public.save_knowledge_base_folder(
  p_id uuid, p_knowledge_base_id uuid, p_name text, p_icon text, p_color text,
  p_view_type text, p_is_pinned boolean, p_sort_order integer
) returns integer language plpgsql security invoker set search_path = pg_catalog, public as $$
declare saved_sort_order integer;
begin
  if p_knowledge_base_id is not null and not exists (
    select 1 from public.knowledge_bases b
     where b.id = p_knowledge_base_id and b.user_id = (select auth.uid()) and b.deleted_at is null
  ) then raise exception 'KNOWLEDGE_BASE_NOT_FOUND' using errcode = 'P0002'; end if;

  if exists (select 1 from public.knowledge_base_folders f where f.id = p_id and f.user_id = (select auth.uid())) then
    update public.knowledge_base_folders
       set knowledge_base_id = p_knowledge_base_id, name = p_name, icon = coalesce(p_icon, ''),
           color = coalesce(p_color, '#000000'), view_type = coalesce(p_view_type, 'list'),
           is_pinned = p_is_pinned, sort_order = p_sort_order
     where id = p_id and user_id = (select auth.uid())
     returning sort_order into saved_sort_order;
  else
    perform pg_advisory_xact_lock(hashtextextended(coalesce(p_knowledge_base_id::text, 'root'), 0));
    select coalesce(max(f.sort_order), -1) + 1 into saved_sort_order
      from public.knowledge_base_folders f
     where f.user_id = (select auth.uid()) and f.deleted_at is null
       and f.knowledge_base_id is not distinct from p_knowledge_base_id;
    insert into public.knowledge_base_folders (
      id, user_id, knowledge_base_id, name, icon, color, view_type, is_pinned, sort_order
    ) values (
      p_id, (select auth.uid()), p_knowledge_base_id, p_name, coalesce(p_icon, ''),
      coalesce(p_color, '#000000'), coalesce(p_view_type, 'list'), p_is_pinned, saved_sort_order
    );
  end if;
  return saved_sort_order;
end;
$$;

create function public.save_folder_note_group(
  p_id uuid, p_folder_id uuid, p_name text, p_sort_order integer
) returns integer language plpgsql security invoker set search_path = pg_catalog, public as $$
declare saved_sort_order integer;
begin
  if not exists (
    select 1 from public.knowledge_base_folders f
     where f.id = p_folder_id and f.user_id = (select auth.uid()) and f.deleted_at is null
  ) then raise exception 'FOLDER_NOT_FOUND' using errcode = 'P0002'; end if;

  if exists (select 1 from public.folder_note_groups g where g.id = p_id and g.user_id = (select auth.uid())) then
    update public.folder_note_groups
       set folder_id = p_folder_id, name = p_name, sort_order = p_sort_order
     where id = p_id and user_id = (select auth.uid())
     returning sort_order into saved_sort_order;
  else
    perform pg_advisory_xact_lock(hashtextextended(p_folder_id::text, 0));
    select coalesce(max(g.sort_order), -1) + 1 into saved_sort_order
      from public.folder_note_groups g
     where g.user_id = (select auth.uid()) and g.deleted_at is null and g.folder_id = p_folder_id;
    insert into public.folder_note_groups (id, user_id, folder_id, name, sort_order)
    values (p_id, (select auth.uid()), p_folder_id, p_name, saved_sort_order);
  end if;
  return saved_sort_order;
end;
$$;

create function public.save_note(
  p_id uuid, p_folder_id uuid, p_group_id uuid, p_title text, p_content text,
  p_is_pinned boolean, p_sort_order integer, p_expected_updated_at timestamptz
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
    insert into public.notes (id, user_id, folder_id, group_id, title, content, is_pinned, sort_order)
    values (p_id, (select auth.uid()), p_folder_id, p_group_id, p_title, p_content, p_is_pinned, saved_sort_order)
    on conflict (id) do nothing returning public.notes.updated_at into saved_at;
  else
    update public.notes
       set folder_id = p_folder_id, group_id = p_group_id, title = p_title,
           content = p_content, is_pinned = p_is_pinned, sort_order = p_sort_order
     where id = p_id and user_id = (select auth.uid()) and deleted_at is null
       and date_trunc('milliseconds', updated_at) = date_trunc('milliseconds', p_expected_updated_at)
     returning public.notes.updated_at, public.notes.sort_order into saved_at, saved_sort_order;
  end if;
  if saved_at is null then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
  return query select saved_at, saved_sort_order;
end;
$$;

create function public.soft_delete_note(p_id uuid)
returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  update public.notes set deleted_at = now()
   where id = p_id and user_id = (select auth.uid()) and deleted_at is null;
end;
$$;

create function public.soft_delete_folder_note_group(p_id uuid)
returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  update public.folder_note_groups set deleted_at = now()
   where id = p_id and user_id = (select auth.uid()) and deleted_at is null;
end;
$$;

create function public.soft_delete_knowledge_base_template(p_id uuid)
returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  update public.knowledge_base_templates set deleted_at = now()
   where id = p_id and user_id = (select auth.uid()) and deleted_at is null;
end;
$$;

create function public.soft_delete_time_management_task(p_id uuid)
returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  update public.time_management_tasks set deleted_at = now()
   where id = p_id and user_id = (select auth.uid()) and deleted_at is null;
end;
$$;

create function public.create_focus_session(
  p_id uuid, p_cycle_id uuid, p_task_id uuid, p_type text, p_status text,
  p_planned_minutes integer, p_active_seconds integer, p_rest_completed boolean
) returns timestamptz language plpgsql security invoker set search_path = pg_catalog, public as $$
declare saved_started_at timestamptz;
begin
  if p_task_id is not null and not exists (
    select 1 from public.time_management_tasks t
     where t.id = p_task_id and t.user_id = (select auth.uid()) and t.deleted_at is null
  ) then raise exception 'TASK_NOT_FOUND' using errcode = 'P0002'; end if;
  insert into public.focus_sessions (
    id, user_id, cycle_id, task_id, type, status, planned_minutes, active_seconds, rest_completed
  ) values (
    p_id, (select auth.uid()), p_cycle_id, p_task_id, p_type, p_status,
    p_planned_minutes, p_active_seconds, p_rest_completed
  ) returning started_at into saved_started_at;
  return saved_started_at;
end;
$$;

create function public.update_focus_session(
  p_id uuid, p_status text default null, p_active_seconds integer default null,
  p_rest_completed boolean default null
) returns timestamptz language plpgsql security invoker set search_path = pg_catalog, public as $$
declare saved_ended_at timestamptz;
begin
  update public.focus_sessions
     set status = coalesce(p_status, status),
         active_seconds = coalesce(p_active_seconds, active_seconds),
         rest_completed = coalesce(p_rest_completed, rest_completed),
         ended_at = case
           when p_status in ('completed', 'interrupted') and status not in ('completed', 'interrupted') and ended_at is null then now()
           else ended_at
         end
   where id = p_id and user_id = (select auth.uid())
   returning ended_at into saved_ended_at;
  if not found then raise exception 'FOCUS_SESSION_NOT_FOUND' using errcode = 'P0002'; end if;
  return saved_ended_at;
end;
$$;

create function public.interrupt_open_focus_sessions()
returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  update public.focus_sessions
     set status = 'interrupted', ended_at = now()
   where user_id = (select auth.uid()) and status in ('running', 'paused') and ended_at is null;
end;
$$;

do $$
declare fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'save_time_management_task', 'save_knowledge_base_folder', 'save_folder_note_group',
      'save_note', 'soft_delete_note', 'soft_delete_folder_note_group',
      'soft_delete_knowledge_base_template', 'soft_delete_time_management_task',
      'create_focus_session', 'update_focus_session', 'interrupt_open_focus_sessions'
    )
  loop
    execute format('revoke execute on function %s from public, anon', fn.signature);
    execute format('grant execute on function %s to authenticated', fn.signature);
  end loop;
end;
$$;
