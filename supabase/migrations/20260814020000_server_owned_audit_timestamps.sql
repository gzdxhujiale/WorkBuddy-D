-- Audit timestamps are server-owned. Clients submit an optimistic-lock version
-- but never create the next version or creation timestamp themselves.

drop function if exists public.save_time_management_task(uuid, text, text, text, timestamptz, timestamptz, boolean, timestamptz, text, jsonb, timestamptz, timestamptz, timestamptz);
drop function if exists public.save_daily_review(uuid, date, jsonb, timestamptz, timestamptz, timestamptz);
drop function if exists public.save_habit(uuid, text, text, integer[], text, date, text, text, text, boolean, integer, timestamptz, timestamptz, timestamptz);
drop function if exists public.save_note(uuid, uuid, uuid, text, text, boolean, integer, timestamptz, timestamptz, timestamptz);
drop function if exists public.save_knowledge_base(uuid, text, boolean, integer, timestamptz);
drop function if exists public.save_knowledge_base_folder(uuid, uuid, text, text, text, text, boolean, integer, timestamptz);
drop function if exists public.save_folder_note_group(uuid, uuid, text, integer, timestamptz);
drop function if exists public.save_knowledge_base_template(uuid, text, jsonb, timestamptz);
drop function if exists public.save_habit_checkin(uuid, date, boolean, timestamptz);
drop function if exists public.reorder_notes(jsonb);

create function public.save_time_management_task(
  p_id uuid, p_title text, p_quadrant text, p_schedule_mode text,
  p_scheduled_start_at timestamptz, p_scheduled_end_at timestamptz,
  p_completed boolean, p_completed_at timestamptz, p_description text,
  p_reminder jsonb, p_expected_updated_at timestamptz
) returns timestamptz language plpgsql security invoker set search_path = pg_catalog, public as $$
declare saved_at timestamptz;
begin
  if p_expected_updated_at is null then
    insert into public.time_management_tasks (
      id, user_id, title, quadrant, schedule_mode, scheduled_start_at,
      scheduled_end_at, completed, completed_at, description, reminder
    ) values (
      p_id, (select auth.uid()), p_title, p_quadrant, p_schedule_mode,
      p_scheduled_start_at, p_scheduled_end_at, p_completed, p_completed_at,
      p_description, p_reminder
    ) on conflict (id) do nothing returning updated_at into saved_at;
  else
    update public.time_management_tasks
       set title = p_title, quadrant = p_quadrant, schedule_mode = p_schedule_mode,
           scheduled_start_at = p_scheduled_start_at, scheduled_end_at = p_scheduled_end_at,
           completed = p_completed, completed_at = p_completed_at,
           description = p_description, reminder = p_reminder
     where id = p_id and user_id = (select auth.uid()) and deleted_at is null
       and date_trunc('milliseconds', updated_at) = date_trunc('milliseconds', p_expected_updated_at)
     returning updated_at into saved_at;
  end if;
  if saved_at is null then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
  return saved_at;
end;
$$;

create function public.save_daily_review(
  p_id uuid, p_date date, p_content jsonb, p_expected_updated_at timestamptz
) returns timestamptz language plpgsql security invoker set search_path = pg_catalog, public as $$
declare saved_at timestamptz;
begin
  if p_expected_updated_at is null then
    insert into public.daily_reviews (id, user_id, date, content)
    values (p_id, (select auth.uid()), p_date, p_content)
    on conflict (user_id, date) do nothing returning updated_at into saved_at;
  else
    update public.daily_reviews set content = p_content
     where id = p_id and user_id = (select auth.uid())
       and date_trunc('milliseconds', updated_at) = date_trunc('milliseconds', p_expected_updated_at)
     returning updated_at into saved_at;
  end if;
  if saved_at is null then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
  return saved_at;
end;
$$;

create function public.save_habit(
  p_id uuid, p_name text, p_frequency_type text, p_frequency_days integer[],
  p_goal text, p_start_date date, p_duration text, p_category text,
  p_reminder text, p_auto_popup_log boolean, p_sort_order integer,
  p_expected_updated_at timestamptz
) returns timestamptz language plpgsql security invoker set search_path = pg_catalog, public as $$
declare saved_at timestamptz;
begin
  if p_expected_updated_at is null then
    insert into public.habits (
      id, user_id, name, frequency_type, frequency_days, goal, start_date,
      duration, category, reminder, auto_popup_log, sort_order
    ) values (
      p_id, (select auth.uid()), p_name, p_frequency_type, p_frequency_days,
      p_goal, p_start_date, p_duration, p_category, p_reminder,
      p_auto_popup_log, p_sort_order
    ) on conflict (id) do nothing returning updated_at into saved_at;
  else
    update public.habits
       set name = p_name, frequency_type = p_frequency_type,
           frequency_days = p_frequency_days, goal = p_goal,
           start_date = p_start_date, duration = p_duration, category = p_category,
           reminder = p_reminder, auto_popup_log = p_auto_popup_log,
           sort_order = p_sort_order
     where id = p_id and user_id = (select auth.uid()) and deleted_at is null
       and date_trunc('milliseconds', updated_at) = date_trunc('milliseconds', p_expected_updated_at)
     returning updated_at into saved_at;
  end if;
  if saved_at is null then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
  return saved_at;
end;
$$;

create function public.save_note(
  p_id uuid, p_folder_id uuid, p_group_id uuid, p_title text, p_content text,
  p_is_pinned boolean, p_sort_order integer, p_expected_updated_at timestamptz
) returns timestamptz language plpgsql security invoker set search_path = pg_catalog, public as $$
declare saved_at timestamptz;
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
    insert into public.notes (id, user_id, folder_id, group_id, title, content, is_pinned, sort_order)
    values (p_id, (select auth.uid()), p_folder_id, p_group_id, p_title, p_content, p_is_pinned, p_sort_order)
    on conflict (id) do nothing returning updated_at into saved_at;
  else
    update public.notes
       set folder_id = p_folder_id, group_id = p_group_id, title = p_title,
           content = p_content, is_pinned = p_is_pinned, sort_order = p_sort_order
     where id = p_id and user_id = (select auth.uid()) and deleted_at is null
       and date_trunc('milliseconds', updated_at) = date_trunc('milliseconds', p_expected_updated_at)
     returning updated_at into saved_at;
  end if;
  if saved_at is null then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
  return saved_at;
end;
$$;

create function public.patch_note(
  p_id uuid, p_expected_updated_at timestamptz, p_title text default null,
  p_content text default null, p_is_pinned boolean default null,
  p_sort_order integer default null, p_folder_id uuid default null,
  p_group_id uuid default null, p_set_group boolean default false
) returns timestamptz language plpgsql security invoker set search_path = pg_catalog, public as $$
declare saved_at timestamptz;
begin
  update public.notes
     set title = coalesce(p_title, title), content = coalesce(p_content, content),
         is_pinned = coalesce(p_is_pinned, is_pinned), sort_order = coalesce(p_sort_order, sort_order),
         folder_id = coalesce(p_folder_id, folder_id),
         group_id = case when p_set_group then p_group_id else group_id end
   where id = p_id and user_id = (select auth.uid()) and deleted_at is null
     and date_trunc('milliseconds', updated_at) = date_trunc('milliseconds', p_expected_updated_at)
   returning updated_at into saved_at;
  if saved_at is null then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
  return saved_at;
end;
$$;

create function public.move_note(
  p_id uuid, p_folder_id uuid, p_group_id uuid, p_sort_order integer,
  p_expected_updated_at timestamptz
) returns timestamptz language plpgsql security invoker set search_path = pg_catalog, public as $$
declare saved_at timestamptz;
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
  update public.notes
     set folder_id = p_folder_id, group_id = p_group_id, sort_order = p_sort_order
   where id = p_id and user_id = (select auth.uid()) and deleted_at is null
     and date_trunc('milliseconds', updated_at) = date_trunc('milliseconds', p_expected_updated_at)
   returning updated_at into saved_at;
  if saved_at is null then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
  return saved_at;
end;
$$;

create function public.reorder_notes(p_items jsonb)
returns table(id uuid, updated_at timestamptz)
language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  return query
    update public.notes n
       set sort_order = item.sort_order
      from jsonb_to_recordset(p_items) as item(id uuid, sort_order integer)
     where n.id = item.id and n.user_id = (select auth.uid()) and n.deleted_at is null
     returning n.id, n.updated_at;
end;
$$;

create function public.save_knowledge_base(
  p_id uuid, p_name text, p_is_pinned boolean, p_sort_order integer
) returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  insert into public.knowledge_bases (id, user_id, name, is_pinned, sort_order)
  values (p_id, (select auth.uid()), p_name, p_is_pinned, p_sort_order)
  on conflict (id) do update set name = excluded.name, is_pinned = excluded.is_pinned,
    sort_order = excluded.sort_order where public.knowledge_bases.user_id = (select auth.uid());
end;
$$;

create function public.save_knowledge_base_folder(
  p_id uuid, p_knowledge_base_id uuid, p_name text, p_icon text, p_color text,
  p_view_type text, p_is_pinned boolean, p_sort_order integer
) returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if p_knowledge_base_id is not null and not exists (
    select 1 from public.knowledge_bases b
     where b.id = p_knowledge_base_id and b.user_id = (select auth.uid()) and b.deleted_at is null
  ) then raise exception 'KNOWLEDGE_BASE_NOT_FOUND' using errcode = 'P0002'; end if;
  insert into public.knowledge_base_folders (
    id, user_id, knowledge_base_id, name, icon, color, view_type, is_pinned, sort_order
  ) values (
    p_id, (select auth.uid()), p_knowledge_base_id, p_name, coalesce(p_icon, ''),
    coalesce(p_color, '#000000'), coalesce(p_view_type, 'list'), p_is_pinned, p_sort_order
  ) on conflict (id) do update set knowledge_base_id = excluded.knowledge_base_id,
    name = excluded.name, icon = excluded.icon, color = excluded.color,
    view_type = excluded.view_type, is_pinned = excluded.is_pinned,
    sort_order = excluded.sort_order
  where public.knowledge_base_folders.user_id = (select auth.uid());
end;
$$;

create function public.save_folder_note_group(
  p_id uuid, p_folder_id uuid, p_name text, p_sort_order integer
) returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if not exists (
    select 1 from public.knowledge_base_folders f
     where f.id = p_folder_id and f.user_id = (select auth.uid()) and f.deleted_at is null
  ) then raise exception 'FOLDER_NOT_FOUND' using errcode = 'P0002'; end if;
  insert into public.folder_note_groups (id, user_id, folder_id, name, sort_order)
  values (p_id, (select auth.uid()), p_folder_id, p_name, p_sort_order)
  on conflict (id) do update set folder_id = excluded.folder_id, name = excluded.name,
    sort_order = excluded.sort_order
  where public.folder_note_groups.user_id = (select auth.uid());
end;
$$;

create function public.save_knowledge_base_template(
  p_id uuid, p_name text, p_content jsonb
) returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  insert into public.knowledge_base_templates (id, user_id, name, content)
  values (p_id, (select auth.uid()), p_name, p_content)
  on conflict (id) do update set name = excluded.name, content = excluded.content
  where public.knowledge_base_templates.user_id = (select auth.uid());
end;
$$;

create function public.save_habit_checkin(
  p_habit_id uuid, p_date date, p_completed boolean
) returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if not exists (
    select 1 from public.habits h
     where h.id = p_habit_id and h.user_id = (select auth.uid()) and h.deleted_at is null
  ) then raise exception 'HABIT_NOT_FOUND' using errcode = 'P0002'; end if;
  insert into public.habit_checkins (user_id, habit_id, date, completed)
  values ((select auth.uid()), p_habit_id, p_date, p_completed)
  on conflict (user_id, habit_id, date) do update
    set completed = excluded.completed, deleted_at = null;
end;
$$;

do $$
declare fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'save_time_management_task', 'save_daily_review', 'save_habit', 'save_note',
      'patch_note', 'move_note', 'reorder_notes', 'save_knowledge_base',
      'save_knowledge_base_folder', 'save_folder_note_group',
      'save_knowledge_base_template', 'save_habit_checkin'
    )
  loop
    execute format('revoke execute on function %s from public, anon', fn.signature);
    execute format('grant execute on function %s to authenticated', fn.signature);
  end loop;
end;
$$;
