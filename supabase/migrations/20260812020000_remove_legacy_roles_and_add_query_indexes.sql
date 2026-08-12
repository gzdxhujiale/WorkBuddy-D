-- The roles feature and mission_roles table are retired. This migration is
-- safe for databases where the table/index/column was already removed.

drop index if exists public.mission_roles_user_id_deleted_at_sort_order_idx;

-- Remove the previously deployed RPC signature that still accepted a legacy
-- role argument.
drop function if exists public.save_time_management_task(
  uuid, text, text, uuid, text, timestamptz, timestamptz, boolean,
  timestamptz, text, jsonb, timestamptz, timestamptz, timestamptz
);

-- Keep the final RPC definition aligned with the current client payload.
create or replace function public.save_time_management_task(
  p_id uuid, p_title text, p_quadrant text, p_schedule_mode text,
  p_scheduled_start_at timestamptz, p_scheduled_end_at timestamptz,
  p_completed boolean, p_completed_at timestamptz, p_description text,
  p_reminder jsonb, p_created_at timestamptz,
  p_expected_updated_at timestamptz, p_next_updated_at timestamptz
) returns timestamptz language plpgsql security invoker set search_path = public as $$
declare saved_at timestamptz;
begin
  if p_expected_updated_at is null then
    insert into public.time_management_tasks
      (id, title, quadrant, schedule_mode, scheduled_start_at, scheduled_end_at,
       completed, completed_at, description, reminder, created_at, updated_at)
    values
      (p_id, p_title, p_quadrant, p_schedule_mode, p_scheduled_start_at,
       p_scheduled_end_at, p_completed, p_completed_at, p_description,
       p_reminder, p_created_at, p_next_updated_at)
    on conflict (id) do nothing
    returning updated_at into saved_at;
  else
    update public.time_management_tasks
    set title = p_title,
        quadrant = p_quadrant,
        schedule_mode = p_schedule_mode,
        scheduled_start_at = p_scheduled_start_at,
        scheduled_end_at = p_scheduled_end_at,
        completed = p_completed,
        completed_at = p_completed_at,
        description = p_description,
        reminder = p_reminder,
        updated_at = p_next_updated_at
    where id = p_id
      and user_id = auth.uid()
      and deleted_at is null
      and date_trunc('milliseconds', updated_at) = date_trunc('milliseconds', p_expected_updated_at)
    returning updated_at into saved_at;
  end if;

  if saved_at is null then
    raise exception 'VERSION_CONFLICT' using errcode = '40001';
  end if;
  return saved_at;
end;
$$;

-- These match the actual Data API predicates and ordering. Some older
-- installations do not have deleted_at on every knowledge-base table, so
-- create each index only when its table and all required columns exist.
do $$
declare
  index_spec record;
  missing_columns boolean;
begin
  for index_spec in
    select * from (values
      ('time_management_tasks_user_deleted_created_idx', 'time_management_tasks', array['user_id', 'deleted_at', 'created_at']::text[], '(user_id, deleted_at, created_at desc)'),
      ('habits_user_deleted_sort_created_idx', 'habits', array['user_id', 'deleted_at', 'sort_order', 'created_at']::text[], '(user_id, deleted_at, sort_order, created_at)'),
      ('habit_checkins_user_deleted_date_idx', 'habit_checkins', array['user_id', 'deleted_at', 'date']::text[], '(user_id, deleted_at, date desc)'),
      ('daily_reviews_user_deleted_date_idx', 'daily_reviews', array['user_id', 'deleted_at', 'date']::text[], '(user_id, deleted_at, date desc)'),
      ('knowledge_bases_user_deleted_sort_created_idx', 'knowledge_bases', array['user_id', 'deleted_at', 'sort_order', 'created_at']::text[], '(user_id, deleted_at, sort_order, created_at)'),
      ('knowledge_base_folders_user_deleted_sort_created_idx', 'knowledge_base_folders', array['user_id', 'deleted_at', 'sort_order', 'created_at']::text[], '(user_id, deleted_at, sort_order, created_at)')
    ) as specs(index_name, table_name, required_columns, index_columns)
  loop
    if to_regclass(format('public.%I', index_spec.table_name)) is null then
      raise notice 'Skipping index %, table public.% does not exist', index_spec.index_name, index_spec.table_name;
      continue;
    end if;

    select exists (
      select 1
      from unnest(index_spec.required_columns) as required(column_name)
      where not exists (
        select 1
        from information_schema.columns columns
        where columns.table_schema = 'public'
          and columns.table_name = index_spec.table_name
          and columns.column_name = required.column_name
      )
    ) into missing_columns;

    if missing_columns then
      raise notice 'Skipping index %, required column is missing', index_spec.index_name;
      continue;
    end if;

    execute format(
      'create index if not exists %I on public.%I %s',
      index_spec.index_name,
      index_spec.table_name,
      index_spec.index_columns
    );
  end loop;
end
$$;
