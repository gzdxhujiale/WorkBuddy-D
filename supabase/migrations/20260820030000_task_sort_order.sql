-- Task ordering is an explicit user-owned fact.  created_at remains immutable
-- audit metadata and must never be rewritten to simulate drag-and-drop order.

alter table public.time_management_tasks
  add column if not exists sort_order integer not null default 0;

with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, quadrant
      order by created_at asc, id asc
    ) - 1 as assigned_sort_order
  from public.time_management_tasks
  where deleted_at is null
)
update public.time_management_tasks task
set sort_order = ranked.assigned_sort_order
from ranked
where task.id = ranked.id;

create index if not exists time_management_tasks_user_quadrant_sort_idx
  on public.time_management_tasks (user_id, quadrant, sort_order desc)
  where deleted_at is null;

-- Recreate the existing save RPC with database-assigned initial placement.
drop function if exists public.save_time_management_task_v2(
  uuid, text, text, text, timestamptz, timestamptz, boolean, text, jsonb,
  uuid, uuid, text, text, bigint
);

create function public.save_time_management_task_v2(
  p_id uuid, p_title text, p_quadrant text, p_schedule_mode text,
  p_scheduled_start_at timestamptz, p_scheduled_end_at timestamptz,
  p_completed boolean, p_description text, p_reminder jsonb, p_project_id uuid,
  p_project_stage_id uuid, p_priority text, p_assignee_name text,
  p_expected_lock_version bigint
) returns table(updated_at timestamptz, lock_version bigint, sort_order integer)
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare assigned_sort_order integer;
begin
  if p_expected_lock_version is null then
    perform pg_advisory_xact_lock(
      hashtextextended((select auth.uid())::text || ':' || p_quadrant, 0)
    );
    select coalesce(max(t.sort_order), -1) + 1 into assigned_sort_order
      from public.time_management_tasks t
      where t.user_id = (select auth.uid()) and t.quadrant = p_quadrant
        and t.deleted_at is null;

    return query insert into public.time_management_tasks (
      id, user_id, title, quadrant, schedule_mode, scheduled_start_at,
      scheduled_end_at, completed, completed_at, description, reminder, project_id,
      project_stage_id, priority, assignee_name, sort_order
    ) values (
      p_id, (select auth.uid()), p_title, p_quadrant, p_schedule_mode,
      p_scheduled_start_at, p_scheduled_end_at, p_completed,
      case when p_completed then now() else null end, p_description, p_reminder,
      p_project_id, p_project_stage_id, coalesce(p_priority, 'medium'),
      p_assignee_name, assigned_sort_order
    ) on conflict (id) do nothing
      returning time_management_tasks.updated_at, time_management_tasks.lock_version,
        time_management_tasks.sort_order;
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
      returning t.updated_at, t.lock_version, t.sort_order;
  end if;
  if not found then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
end;
$$;

-- The complete visual target order is committed atomically.  Every input row
-- must be a current, active task owned by the caller; a conflict changes none.
create function public.reorder_time_management_tasks_v3(
  p_moved_task_id uuid,
  p_target_quadrant text,
  p_target_schedule_mode text,
  p_target_scheduled_start_at timestamptz,
  p_target_scheduled_end_at timestamptz,
  p_items jsonb
) returns table(id uuid, updated_at timestamptz, lock_version bigint, sort_order integer)
language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if jsonb_typeof(p_items) is distinct from 'array'
     or coalesce(jsonb_array_length(p_items), 0) = 0 then
    raise exception 'INVALID_TASK_ORDER' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as item(id uuid, sort_order integer, lock_version bigint)
    group by item.id
    having count(*) > 1
  ) then
    raise exception 'DUPLICATE_TASK_ORDER_ITEM' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from jsonb_to_recordset(p_items) as item(id uuid, sort_order integer, lock_version bigint)
    where item.id = p_moved_task_id
  ) then
    raise exception 'MOVED_TASK_MISSING_FROM_ORDER' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as item(id uuid, sort_order integer, lock_version bigint)
    left join public.time_management_tasks task on task.id = item.id
    where item.sort_order is null or item.lock_version is null
      or task.id is null or task.user_id <> (select auth.uid())
      or task.deleted_at is not null or task.lock_version <> item.lock_version
  ) then
    raise exception 'VERSION_CONFLICT' using errcode = '40001';
  end if;

  return query
  with items as (
    select item.id, item.sort_order, item.lock_version
    from jsonb_to_recordset(p_items) as item(id uuid, sort_order integer, lock_version bigint)
  )
  update public.time_management_tasks task
  set
    sort_order = items.sort_order,
    quadrant = case when task.id = p_moved_task_id then p_target_quadrant else task.quadrant end,
    schedule_mode = case when task.id = p_moved_task_id then p_target_schedule_mode else task.schedule_mode end,
    scheduled_start_at = case when task.id = p_moved_task_id then p_target_scheduled_start_at else task.scheduled_start_at end,
    scheduled_end_at = case when task.id = p_moved_task_id then p_target_scheduled_end_at else task.scheduled_end_at end
  from items
  where task.id = items.id
  returning task.id, task.updated_at, task.lock_version, task.sort_order;
end;
$$;

revoke all on function public.save_time_management_task_v2(
  uuid, text, text, text, timestamptz, timestamptz, boolean, text, jsonb,
  uuid, uuid, text, text, bigint
) from public, anon;
revoke all on function public.reorder_time_management_tasks_v3(
  uuid, text, text, timestamptz, timestamptz, jsonb
) from public, anon;
grant execute on function public.save_time_management_task_v2(
  uuid, text, text, text, timestamptz, timestamptz, boolean, text, jsonb,
  uuid, uuid, text, text, bigint
) to authenticated;
grant execute on function public.reorder_time_management_tasks_v3(
  uuid, text, text, timestamptz, timestamptz, jsonb
) to authenticated;
