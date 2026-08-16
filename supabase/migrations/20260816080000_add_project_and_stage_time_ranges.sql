-- Projects and stages use an optional time range.  due_date remains as a
-- legacy column so deployed databases can upgrade without losing data.
alter table public.projects
  add column start_date date,
  add column end_date date;

update public.projects
  set end_date = due_date
  where end_date is null and due_date is not null;

alter table public.project_stages
  add column start_date date,
  add column end_date date;

alter table public.projects
  add constraint projects_date_range_check
  check (start_date is null or end_date is null or start_date <= end_date);

alter table public.project_stages
  add constraint project_stages_date_range_check
  check (start_date is null or end_date is null or start_date <= end_date);

create index projects_active_date_range_idx
  on public.projects (user_id, start_date, end_date)
  where status <> 'archived';

drop function if exists public.save_project(uuid, text, text, text, date, text, text[], text, timestamptz);
create function public.save_project(
  p_id uuid, p_name text, p_description text, p_status text,
  p_start_date date, p_end_date date, p_priority text, p_tags text[],
  p_owner_name text, p_expected_updated_at timestamptz
) returns timestamptz language plpgsql security invoker set search_path = pg_catalog, public as $$
declare saved_at timestamptz;
begin
  if p_start_date is not null and p_end_date is not null and p_start_date > p_end_date then
    raise exception 'INVALID_PROJECT_DATE_RANGE' using errcode = '22023';
  end if;
  if p_expected_updated_at is null then
    insert into public.projects (id, user_id, name, description, status, start_date, end_date, priority, tags, owner_name)
    values (p_id, (select auth.uid()), p_name, p_description, 'not_started', p_start_date, p_end_date,
      coalesce(p_priority, 'medium'), coalesce(p_tags, '{}'), p_owner_name)
    on conflict (id) do nothing returning updated_at into saved_at;
  else
    if p_status = 'completed' and exists (
      select 1 from public.time_management_tasks t
      where t.project_id = p_id and t.user_id = (select auth.uid()) and t.deleted_at is null and not t.completed
    ) then raise exception 'PROJECT_HAS_INCOMPLETE_TASKS' using errcode = '23514'; end if;
    update public.projects
       set name = p_name, description = p_description, status = p_status,
           start_date = p_start_date, end_date = p_end_date,
           priority = coalesce(p_priority, 'medium'), tags = coalesce(p_tags, '{}'), owner_name = p_owner_name
     where id = p_id and user_id = (select auth.uid())
       and date_trunc('milliseconds', updated_at) = date_trunc('milliseconds', p_expected_updated_at)
     returning updated_at into saved_at;
  end if;
  if saved_at is null then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
  return saved_at;
end;
$$;

drop function if exists public.save_project_stage(uuid, uuid, text, text, integer, text);
create function public.save_project_stage(
  p_id uuid, p_project_id uuid, p_name text, p_default_assignee_name text,
  p_sort_order integer, p_template_key text, p_start_date date, p_end_date date
) returns uuid language plpgsql security invoker set search_path = pg_catalog, public as $$
declare assigned_sort_order integer;
begin
  if p_start_date is not null and p_end_date is not null and p_start_date > p_end_date then
    raise exception 'INVALID_STAGE_DATE_RANGE' using errcode = '22023';
  end if;
  if not exists (select 1 from public.projects p where p.id = p_project_id and p.user_id = (select auth.uid())) then
    raise exception 'PROJECT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.project_stages s where s.id = p_id and s.user_id = (select auth.uid())) then
    update public.project_stages
       set name = p_name, default_assignee_name = p_default_assignee_name,
           sort_order = p_sort_order, template_key = p_template_key,
           start_date = p_start_date, end_date = p_end_date
     where id = p_id and user_id = (select auth.uid());
  else
    perform pg_advisory_xact_lock(hashtextextended(p_project_id::text, 0));
    select coalesce(max(s.sort_order), -1) + 1 into assigned_sort_order
      from public.project_stages s where s.project_id = p_project_id;
    insert into public.project_stages (
      id, project_id, user_id, name, default_assignee_name, sort_order,
      template_key, start_date, end_date
    ) values (
      p_id, p_project_id, (select auth.uid()), p_name, p_default_assignee_name,
      assigned_sort_order, p_template_key, p_start_date, p_end_date
    );
  end if;
  return p_id;
end;
$$;

drop function if exists public.create_project_from_template(uuid, uuid, text, text, date, text, text[], text);
create function public.create_project_from_template(
  p_project_id uuid, p_template_id uuid, p_name text, p_description text,
  p_start_date date, p_end_date date, p_priority text, p_tags text[], p_owner_name text
) returns uuid language plpgsql security invoker set search_path = pg_catalog, public as $$
declare definition_value jsonb;
declare stage_value jsonb;
declare task_value jsonb;
declare stage_id uuid;
declare task_quadrant text;
declare ordinal integer := 0;
begin
  if p_start_date is not null and p_end_date is not null and p_start_date > p_end_date then
    raise exception 'INVALID_PROJECT_DATE_RANGE' using errcode = '22023';
  end if;
  select definition into definition_value from public.project_templates
   where id = p_template_id and user_id = (select auth.uid()) and deleted_at is null;
  if definition_value is null then raise exception 'TEMPLATE_NOT_FOUND' using errcode = 'P0002'; end if;

  insert into public.projects (id, user_id, name, description, status, start_date, end_date, priority, tags, owner_name)
  values (p_project_id, (select auth.uid()), p_name, coalesce(p_description, ''), 'not_started',
    p_start_date, p_end_date, coalesce(p_priority, 'medium'), coalesce(p_tags, '{}'), p_owner_name);

  for stage_value in select value from jsonb_array_elements(definition_value->'stages') loop
    insert into public.project_stages (project_id, user_id, name, default_assignee_name, sort_order, template_key)
    values (p_project_id, (select auth.uid()), coalesce(stage_value->>'name', '未命名阶段'),
      nullif(stage_value->>'defaultAssigneeName', ''), ordinal, coalesce(stage_value->>'key', stage_value->>'name'));
    ordinal := ordinal + 1;
  end loop;

  for task_value in select value from jsonb_array_elements(definition_value->'tasks') loop
    task_quadrant := coalesce(task_value->>'quadrant', 'Q2_NOT_URGENT_IMPORTANT');
    if task_quadrant not in (
      'Q1_URGENT_IMPORTANT', 'Q2_NOT_URGENT_IMPORTANT',
      'Q3_URGENT_NOT_IMPORTANT', 'Q4_NOT_URGENT_NOT_IMPORTANT'
    ) then raise exception 'INVALID_TEMPLATE_TASK_QUADRANT' using errcode = '22023'; end if;
    select id into stage_id from public.project_stages
      where project_id = p_project_id and template_key = nullif(task_value->>'stageKey', '')
      order by sort_order limit 1;
    insert into public.time_management_tasks (
      id, user_id, title, quadrant, completed, description, project_id, project_stage_id, priority, assignee_name
    ) values (
      gen_random_uuid(), (select auth.uid()), coalesce(task_value->>'title', '未命名任务'),
      task_quadrant, false, nullif(task_value->>'description', ''), p_project_id, stage_id,
      coalesce(task_value->>'priority', 'medium'),
      coalesce(nullif(task_value->>'assigneeName', ''), (select default_assignee_name from public.project_stages where id = stage_id))
    );
  end loop;
  return p_project_id;
end;
$$;

revoke execute on function public.save_project(uuid, text, text, text, date, date, text, text[], text, timestamptz) from public, anon;
grant execute on function public.save_project(uuid, text, text, text, date, date, text, text[], text, timestamptz) to authenticated;
revoke execute on function public.save_project_stage(uuid, uuid, text, text, integer, text, date, date) from public, anon;
grant execute on function public.save_project_stage(uuid, uuid, text, text, integer, text, date, date) to authenticated;
revoke execute on function public.create_project_from_template(uuid, uuid, text, text, date, date, text, text[], text) from public, anon;
grant execute on function public.create_project_from_template(uuid, uuid, text, text, date, date, text, text[], text) to authenticated;

