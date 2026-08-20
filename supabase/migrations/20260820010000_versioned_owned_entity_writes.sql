-- Use a database-owned, monotonic version for every independently editable
-- user entity. `updated_at` remains an audit field, not a concurrency token.

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'daily_reviews', 'project_templates', 'time_management_tasks', 'habits',
    'projects', 'project_stages', 'knowledge_bases',
    'knowledge_base_folders', 'folder_note_groups', 'knowledge_base_templates'
  ] loop
    execute format(
      'alter table public.%I add column if not exists lock_version bigint not null default 1 check (lock_version > 0)',
      table_name
    );
  end loop;
end;
$$;

create or replace function public.bump_owned_entity_lock_version()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  new.lock_version := old.lock_version + 1;
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'daily_reviews', 'project_templates', 'time_management_tasks', 'habits',
    'projects', 'project_stages', 'knowledge_bases',
    'knowledge_base_folders', 'folder_note_groups', 'knowledge_base_templates'
  ] loop
    execute format('drop trigger if exists aaa_bump_lock_version on public.%I', table_name);
    execute format(
      'create trigger aaa_bump_lock_version before update on public.%I for each row execute function public.bump_owned_entity_lock_version()',
      table_name
    );
  end loop;
end;
$$;

create or replace function public.save_daily_review_v2(
  p_id uuid, p_date date, p_content jsonb, p_expected_lock_version bigint
) returns table(updated_at timestamptz, lock_version bigint)
language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if p_expected_lock_version is null then
    return query insert into public.daily_reviews (id, user_id, date, content)
      values (p_id, (select auth.uid()), p_date, p_content)
      on conflict (user_id, date) do nothing
      returning daily_reviews.updated_at, daily_reviews.lock_version;
  else
    return query update public.daily_reviews r set content = p_content
      where r.id = p_id and r.user_id = (select auth.uid())
        and r.lock_version = p_expected_lock_version
      returning r.updated_at, r.lock_version;
  end if;
  if not found then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
end;
$$;

create or replace function public.save_habit_v2(
  p_id uuid, p_name text, p_frequency_type text, p_goal text, p_start_date date,
  p_duration text, p_category text, p_reminder text, p_auto_popup_log boolean,
  p_sort_order integer, p_expected_lock_version bigint
) returns table(updated_at timestamptz, lock_version bigint)
language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if p_expected_lock_version is null then
    return query insert into public.habits (
      id, user_id, name, frequency_type, goal, start_date, duration, category,
      reminder, auto_popup_log, sort_order
    ) values (
      p_id, (select auth.uid()), p_name, p_frequency_type, p_goal, p_start_date,
      p_duration, p_category, p_reminder, p_auto_popup_log, p_sort_order
    ) on conflict (id) do nothing returning habits.updated_at, habits.lock_version;
  else
    return query update public.habits h set
      name = p_name, frequency_type = p_frequency_type, goal = p_goal,
      start_date = p_start_date, duration = p_duration, category = p_category,
      reminder = p_reminder, auto_popup_log = p_auto_popup_log, sort_order = p_sort_order
      where h.id = p_id and h.user_id = (select auth.uid()) and h.deleted_at is null
        and h.lock_version = p_expected_lock_version
      returning h.updated_at, h.lock_version;
  end if;
  if not found then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
end;
$$;

create or replace function public.save_time_management_task_v2(
  p_id uuid, p_title text, p_quadrant text, p_schedule_mode text,
  p_scheduled_start_at timestamptz, p_scheduled_end_at timestamptz,
  p_completed boolean, p_description text, p_reminder jsonb, p_project_id uuid,
  p_project_stage_id uuid, p_priority text, p_assignee_name text,
  p_expected_lock_version bigint
) returns table(updated_at timestamptz, lock_version bigint)
language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if p_expected_lock_version is null then
    return query insert into public.time_management_tasks (
      id, user_id, title, quadrant, schedule_mode, scheduled_start_at,
      scheduled_end_at, completed, completed_at, description, reminder, project_id,
      project_stage_id, priority, assignee_name
    ) values (
      p_id, (select auth.uid()), p_title, p_quadrant, p_schedule_mode,
      p_scheduled_start_at, p_scheduled_end_at, p_completed,
      case when p_completed then now() else null end, p_description, p_reminder,
      p_project_id, p_project_stage_id, coalesce(p_priority, 'medium'), p_assignee_name
    ) on conflict (id) do nothing
      returning time_management_tasks.updated_at, time_management_tasks.lock_version;
  else
    return query update public.time_management_tasks t set
      title = p_title, quadrant = p_quadrant, schedule_mode = p_schedule_mode,
      scheduled_start_at = p_scheduled_start_at, scheduled_end_at = p_scheduled_end_at,
      completed = p_completed,
      completed_at = case when p_completed and not t.completed then now()
                          when not p_completed then null else t.completed_at end,
      description = p_description, reminder = p_reminder, project_id = p_project_id,
      project_stage_id = p_project_stage_id, priority = coalesce(p_priority, 'medium'),
      assignee_name = p_assignee_name
      where t.id = p_id and t.user_id = (select auth.uid()) and t.deleted_at is null
        and t.lock_version = p_expected_lock_version
      returning t.updated_at, t.lock_version;
  end if;
  if not found then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
end;
$$;

create or replace function public.save_project_v2(
  p_id uuid, p_name text, p_description text, p_status text, p_start_date date,
  p_end_date date, p_priority text, p_tags text[], p_owner_name text,
  p_expected_lock_version bigint
) returns table(updated_at timestamptz, lock_version bigint)
language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if p_start_date is not null and p_end_date is not null and p_start_date > p_end_date then
    raise exception 'INVALID_PROJECT_DATE_RANGE' using errcode = '22023';
  end if;
  if p_expected_lock_version is null then
    return query insert into public.projects (
      id, user_id, name, description, status, start_date, end_date, priority, tags, owner_name
    ) values (
      p_id, (select auth.uid()), p_name, p_description, 'not_started', p_start_date,
      p_end_date, coalesce(p_priority, 'medium'), coalesce(p_tags, '{}'), p_owner_name
    ) on conflict (id) do nothing returning projects.updated_at, projects.lock_version;
  else
    if p_status = 'completed' and exists (
      select 1 from public.time_management_tasks t
      where t.project_id = p_id and t.user_id = (select auth.uid())
        and t.deleted_at is null and not t.completed
    ) then raise exception 'PROJECT_HAS_INCOMPLETE_TASKS' using errcode = '23514'; end if;
    return query update public.projects p set
      name = p_name, description = p_description, status = p_status,
      start_date = p_start_date, end_date = p_end_date,
      priority = coalesce(p_priority, 'medium'), tags = coalesce(p_tags, '{}'), owner_name = p_owner_name
      where p.id = p_id and p.user_id = (select auth.uid()) and p.deleted_at is null
        and p.lock_version = p_expected_lock_version
      returning p.updated_at, p.lock_version;
  end if;
  if not found then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
end;
$$;

create or replace function public.save_project_stage_v2(
  p_id uuid, p_project_id uuid, p_name text, p_default_assignee_name text,
  p_sort_order integer, p_template_key text, p_start_date date, p_end_date date,
  p_expected_lock_version bigint
) returns table(updated_at timestamptz, lock_version bigint, sort_order integer)
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare assigned_sort_order integer;
begin
  if p_start_date is not null and p_end_date is not null and p_start_date > p_end_date then
    raise exception 'INVALID_STAGE_DATE_RANGE' using errcode = '22023';
  end if;
  if not exists (select 1 from public.projects p where p.id = p_project_id
    and p.user_id = (select auth.uid()) and p.deleted_at is null) then
    raise exception 'PROJECT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_expected_lock_version is null then
    perform pg_advisory_xact_lock(hashtextextended(p_project_id::text, 0));
    select coalesce(max(s.sort_order), -1) + 1 into assigned_sort_order
      from public.project_stages s where s.project_id = p_project_id and s.deleted_at is null;
    return query insert into public.project_stages (
      id, project_id, user_id, name, default_assignee_name, sort_order, template_key, start_date, end_date
    ) values (
      p_id, p_project_id, (select auth.uid()), p_name, p_default_assignee_name,
      assigned_sort_order, p_template_key, p_start_date, p_end_date
    ) on conflict (id) do nothing
      returning project_stages.updated_at, project_stages.lock_version, project_stages.sort_order;
  else
    return query update public.project_stages s set
      name = p_name, default_assignee_name = p_default_assignee_name,
      sort_order = p_sort_order, template_key = p_template_key,
      start_date = p_start_date, end_date = p_end_date
      where s.id = p_id and s.project_id = p_project_id and s.user_id = (select auth.uid())
        and s.deleted_at is null and s.lock_version = p_expected_lock_version
      returning s.updated_at, s.lock_version, s.sort_order;
  end if;
  if not found then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
end;
$$;

create or replace function public.save_project_template_v2(
  p_id uuid, p_name text, p_description text, p_definition jsonb, p_expected_lock_version bigint
) returns table(updated_at timestamptz, lock_version bigint)
language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if jsonb_typeof(p_definition->'stages') is distinct from 'array'
     or jsonb_typeof(p_definition->'tasks') is distinct from 'array' then
    raise exception 'INVALID_TEMPLATE_DEFINITION' using errcode = '22023';
  end if;
  if p_expected_lock_version is null then
    return query insert into public.project_templates (id, user_id, name, description, definition)
      values (p_id, (select auth.uid()), p_name, p_description, p_definition)
      on conflict (id) do nothing returning project_templates.updated_at, project_templates.lock_version;
  else
    return query update public.project_templates t set
      name = p_name, description = p_description, definition = p_definition
      where t.id = p_id and t.user_id = (select auth.uid()) and t.deleted_at is null
        and t.lock_version = p_expected_lock_version
      returning t.updated_at, t.lock_version;
  end if;
  if not found then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
end;
$$;

create or replace function public.save_knowledge_base_v2(
  p_id uuid, p_name text, p_sort_order integer, p_expected_lock_version bigint
) returns table(updated_at timestamptz, lock_version bigint, sort_order integer)
language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if p_expected_lock_version is null then
    return query insert into public.knowledge_bases (id, user_id, name, sort_order)
      values (p_id, (select auth.uid()), p_name, p_sort_order)
      on conflict (id) do nothing
      returning knowledge_bases.updated_at, knowledge_bases.lock_version, knowledge_bases.sort_order;
  else
    return query update public.knowledge_bases b set name = p_name, sort_order = p_sort_order
      where b.id = p_id and b.user_id = (select auth.uid()) and b.deleted_at is null
        and b.lock_version = p_expected_lock_version
      returning b.updated_at, b.lock_version, b.sort_order;
  end if;
  if not found then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
end;
$$;

create or replace function public.save_knowledge_base_folder_v2(
  p_id uuid, p_knowledge_base_id uuid, p_name text, p_sort_order integer,
  p_expected_lock_version bigint
) returns table(updated_at timestamptz, lock_version bigint, sort_order integer)
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare assigned_sort_order integer;
begin
  if p_knowledge_base_id is not null and not exists (
    select 1 from public.knowledge_bases b where b.id = p_knowledge_base_id
      and b.user_id = (select auth.uid()) and b.deleted_at is null
  ) then raise exception 'KNOWLEDGE_BASE_NOT_FOUND' using errcode = 'P0002'; end if;
  if p_expected_lock_version is null then
    perform pg_advisory_xact_lock(hashtextextended(coalesce(p_knowledge_base_id::text, 'root'), 0));
    select coalesce(max(f.sort_order), -1) + 1 into assigned_sort_order
      from public.knowledge_base_folders f where f.user_id = (select auth.uid())
        and f.deleted_at is null and f.knowledge_base_id is not distinct from p_knowledge_base_id;
    return query insert into public.knowledge_base_folders (id, user_id, knowledge_base_id, name, sort_order)
      values (p_id, (select auth.uid()), p_knowledge_base_id, p_name, assigned_sort_order)
      on conflict (id) do nothing
      returning knowledge_base_folders.updated_at, knowledge_base_folders.lock_version, knowledge_base_folders.sort_order;
  else
    return query update public.knowledge_base_folders f set
      knowledge_base_id = p_knowledge_base_id, name = p_name, sort_order = p_sort_order
      where f.id = p_id and f.user_id = (select auth.uid()) and f.deleted_at is null
        and f.lock_version = p_expected_lock_version
      returning f.updated_at, f.lock_version, f.sort_order;
  end if;
  if not found then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
end;
$$;

create or replace function public.save_folder_note_group_v2(
  p_id uuid, p_folder_id uuid, p_name text, p_sort_order integer, p_expected_lock_version bigint
) returns table(updated_at timestamptz, lock_version bigint, sort_order integer)
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare assigned_sort_order integer;
begin
  if not exists (select 1 from public.knowledge_base_folders f where f.id = p_folder_id
    and f.user_id = (select auth.uid()) and f.deleted_at is null) then
    raise exception 'FOLDER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_expected_lock_version is null then
    perform pg_advisory_xact_lock(hashtextextended(p_folder_id::text, 0));
    select coalesce(max(g.sort_order), -1) + 1 into assigned_sort_order
      from public.folder_note_groups g where g.user_id = (select auth.uid())
        and g.deleted_at is null and g.folder_id = p_folder_id;
    return query insert into public.folder_note_groups (id, user_id, folder_id, name, sort_order)
      values (p_id, (select auth.uid()), p_folder_id, p_name, assigned_sort_order)
      on conflict (id) do nothing
      returning folder_note_groups.updated_at, folder_note_groups.lock_version, folder_note_groups.sort_order;
  else
    return query update public.folder_note_groups g set
      folder_id = p_folder_id, name = p_name, sort_order = p_sort_order
      where g.id = p_id and g.user_id = (select auth.uid()) and g.deleted_at is null
        and g.lock_version = p_expected_lock_version
      returning g.updated_at, g.lock_version, g.sort_order;
  end if;
  if not found then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
end;
$$;

create or replace function public.save_knowledge_base_template_v2(
  p_id uuid, p_name text, p_content jsonb, p_expected_lock_version bigint
) returns table(updated_at timestamptz, lock_version bigint)
language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if p_expected_lock_version is null then
    return query insert into public.knowledge_base_templates (id, user_id, name, content)
      values (p_id, (select auth.uid()), p_name, p_content)
      on conflict (id) do nothing
      returning knowledge_base_templates.updated_at, knowledge_base_templates.lock_version;
  else
    return query update public.knowledge_base_templates t set name = p_name, content = p_content
      where t.id = p_id and t.user_id = (select auth.uid()) and t.deleted_at is null
        and t.lock_version = p_expected_lock_version
      returning t.updated_at, t.lock_version;
  end if;
  if not found then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
end;
$$;

revoke all on function public.bump_owned_entity_lock_version() from public, anon, authenticated;
revoke all on function public.save_daily_review_v2(uuid, date, jsonb, bigint) from public, anon;
revoke all on function public.save_habit_v2(uuid, text, text, text, date, text, text, text, boolean, integer, bigint) from public, anon;
revoke all on function public.save_time_management_task_v2(uuid, text, text, text, timestamptz, timestamptz, boolean, text, jsonb, uuid, uuid, text, text, bigint) from public, anon;
revoke all on function public.save_project_v2(uuid, text, text, text, date, date, text, text[], text, bigint) from public, anon;
revoke all on function public.save_project_stage_v2(uuid, uuid, text, text, integer, text, date, date, bigint) from public, anon;
revoke all on function public.save_project_template_v2(uuid, text, text, jsonb, bigint) from public, anon;
revoke all on function public.save_knowledge_base_v2(uuid, text, integer, bigint) from public, anon;
revoke all on function public.save_knowledge_base_folder_v2(uuid, uuid, text, integer, bigint) from public, anon;
revoke all on function public.save_folder_note_group_v2(uuid, uuid, text, integer, bigint) from public, anon;
revoke all on function public.save_knowledge_base_template_v2(uuid, text, jsonb, bigint) from public, anon;
grant execute on function public.save_daily_review_v2(uuid, date, jsonb, bigint) to authenticated;
grant execute on function public.save_habit_v2(uuid, text, text, text, date, text, text, text, boolean, integer, bigint) to authenticated;
grant execute on function public.save_time_management_task_v2(uuid, text, text, text, timestamptz, timestamptz, boolean, text, jsonb, uuid, uuid, text, text, bigint) to authenticated;
grant execute on function public.save_project_v2(uuid, text, text, text, date, date, text, text[], text, bigint) to authenticated;
grant execute on function public.save_project_stage_v2(uuid, uuid, text, text, integer, text, date, date, bigint) to authenticated;
grant execute on function public.save_project_template_v2(uuid, text, text, jsonb, bigint) to authenticated;
grant execute on function public.save_knowledge_base_v2(uuid, text, integer, bigint) to authenticated;
grant execute on function public.save_knowledge_base_folder_v2(uuid, uuid, text, integer, bigint) to authenticated;
grant execute on function public.save_folder_note_group_v2(uuid, uuid, text, integer, bigint) to authenticated;
grant execute on function public.save_knowledge_base_template_v2(uuid, text, jsonb, bigint) to authenticated;
