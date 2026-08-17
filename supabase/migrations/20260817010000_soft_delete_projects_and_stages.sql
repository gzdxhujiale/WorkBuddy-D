-- Project-center lifecycle deletion is a database-owned, atomic transition.
-- A deleted parent and every active descendant share one committed timestamp.

alter table public.projects add column deleted_at timestamptz;
alter table public.project_stages add column deleted_at timestamptz;

create index projects_active_updated_idx
  on public.projects (user_id, updated_at desc)
  where deleted_at is null;

create index project_stages_active_project_idx
  on public.project_stages (project_id, sort_order)
  where deleted_at is null;

create or replace function public.validate_project_task_relation()
returns trigger language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if new.project_id is null and new.project_stage_id is not null then
    raise exception 'PROJECT_STAGE_REQUIRES_PROJECT' using errcode = '23514';
  end if;
  if new.project_id is not null and not exists (
    select 1 from public.projects p
    where p.id = new.project_id and p.user_id = new.user_id and p.deleted_at is null
  ) then
    raise exception 'PROJECT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if new.project_stage_id is not null and not exists (
    select 1 from public.project_stages s
    where s.id = new.project_stage_id and s.project_id = new.project_id
      and s.user_id = new.user_id and s.deleted_at is null
  ) then
    raise exception 'PROJECT_STAGE_NOT_FOUND' using errcode = 'P0002';
  end if;
  return new;
end;
$$;

create or replace function public.save_project_stage(
  p_id uuid, p_project_id uuid, p_name text, p_default_assignee_name text,
  p_sort_order integer, p_template_key text, p_start_date date, p_end_date date
) returns uuid language plpgsql security invoker set search_path = pg_catalog, public as $$
declare assigned_sort_order integer;
begin
  if p_start_date is not null and p_end_date is not null and p_start_date > p_end_date then
    raise exception 'INVALID_STAGE_DATE_RANGE' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.projects p
    where p.id = p_project_id and p.user_id = (select auth.uid()) and p.deleted_at is null
  ) then
    raise exception 'PROJECT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.project_stages s
    where s.id = p_id and s.user_id = (select auth.uid()) and s.deleted_at is null
  ) then
    update public.project_stages
       set name = p_name, default_assignee_name = p_default_assignee_name,
           sort_order = p_sort_order, template_key = p_template_key,
           start_date = p_start_date, end_date = p_end_date
     where id = p_id and project_id = p_project_id
       and user_id = (select auth.uid()) and deleted_at is null;
    if not found then raise exception 'PROJECT_STAGE_NOT_FOUND' using errcode = 'P0002'; end if;
  else
    perform pg_advisory_xact_lock(hashtextextended(p_project_id::text, 0));
    select coalesce(max(s.sort_order), -1) + 1 into assigned_sort_order
      from public.project_stages s
      where s.project_id = p_project_id and s.deleted_at is null;
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

create or replace function public.soft_delete_project_stage(p_id uuid)
returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
declare deleted_at_value timestamptz := now();
begin
  update public.project_stages
     set deleted_at = deleted_at_value
     where id = p_id and user_id = (select auth.uid()) and deleted_at is null;

  if found then
    update public.time_management_tasks
       set deleted_at = deleted_at_value
     where project_stage_id = p_id and user_id = (select auth.uid()) and deleted_at is null;
  end if;
end;
$$;

create or replace function public.save_project(
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
     where id = p_id and user_id = (select auth.uid()) and deleted_at is null
       and date_trunc('milliseconds', updated_at) = date_trunc('milliseconds', p_expected_updated_at)
     returning updated_at into saved_at;
  end if;
  if saved_at is null then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
  return saved_at;
end;
$$;

create or replace function public.soft_delete_project(p_id uuid)
returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
declare deleted_at_value timestamptz := now();
begin
  update public.projects
     set deleted_at = deleted_at_value
   where id = p_id and user_id = (select auth.uid()) and deleted_at is null;

  if found then
    update public.project_stages
       set deleted_at = deleted_at_value
     where project_id = p_id and user_id = (select auth.uid()) and deleted_at is null;

    update public.time_management_tasks
       set deleted_at = deleted_at_value
     where project_id = p_id and user_id = (select auth.uid()) and deleted_at is null;
  end if;
end;
$$;

revoke execute on function public.soft_delete_project_stage(uuid) from public, anon;
grant execute on function public.soft_delete_project_stage(uuid) to authenticated;
revoke execute on function public.soft_delete_project(uuid) from public, anon;
grant execute on function public.soft_delete_project(uuid) to authenticated;
