-- Project Center: projects are lifecycle containers. Their tasks remain the
-- existing time_management_tasks rows, so every edit has one source of truth.

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  description text,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'completed', 'archived')),
  due_date date,
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent')),
  tags text[] not null default '{}',
  owner_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_stages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  default_assignee_name text,
  sort_order integer not null default 0 check (sort_order >= 0),
  template_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, sort_order)
);

-- A template is deliberately stored as a compact JSON definition. It keeps the
-- reusable workflow atomic and lets future UI versions add template fields
-- without duplicating a project task table.
create table public.project_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  description text,
  definition jsonb not null default '{"stages":[],"tasks":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.time_management_tasks
  add column if not exists project_id uuid references public.projects(id) on delete set null,
  add column if not exists project_stage_id uuid references public.project_stages(id) on delete set null,
  add column if not exists priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent')),
  add column if not exists assignee_name text;

create index projects_active_idx on public.projects (user_id, status, due_date) where status <> 'archived';
create index project_stages_project_idx on public.project_stages (project_id, sort_order);
create index project_templates_user_idx on public.project_templates (user_id, updated_at desc);
create index time_management_tasks_project_idx on public.time_management_tasks (user_id, project_id, created_at desc)
  where deleted_at is null and project_id is not null;
create index time_management_tasks_project_stage_idx on public.time_management_tasks (project_stage_id)
  where deleted_at is null and project_stage_id is not null;

alter table public.projects enable row level security;
alter table public.project_stages enable row level security;
alter table public.project_templates enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array['projects', 'project_stages', 'project_templates'] loop
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', table_name || '_select_own', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', table_name || '_insert_own', table_name);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name || '_update_own', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', table_name || '_delete_own', table_name);
  end loop;
end $$;

create or replace function public.validate_project_task_relation()
returns trigger language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if new.project_id is null and new.project_stage_id is not null then
    raise exception 'PROJECT_STAGE_REQUIRES_PROJECT' using errcode = '23514';
  end if;
  if new.project_id is not null and not exists (
    select 1 from public.projects p where p.id = new.project_id and p.user_id = new.user_id
  ) then
    raise exception 'PROJECT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if new.project_stage_id is not null and not exists (
    select 1 from public.project_stages s
    where s.id = new.project_stage_id and s.project_id = new.project_id and s.user_id = new.user_id
  ) then
    raise exception 'PROJECT_STAGE_NOT_FOUND' using errcode = 'P0002';
  end if;
  return new;
end;
$$;

create or replace function public.validate_project_completion()
returns trigger language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' and exists (
    select 1 from public.time_management_tasks t
    where t.project_id = new.id and t.user_id = new.user_id and t.deleted_at is null and not t.completed
  ) then
    raise exception 'PROJECT_HAS_INCOMPLETE_TASKS' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.validate_project_initial_status()
returns trigger language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if new.status <> 'not_started' then
    raise exception 'PROJECT_MUST_START_NOT_STARTED' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.validate_project_stage_relation()
returns trigger language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if not exists (
    select 1 from public.projects p where p.id = new.project_id and p.user_id = new.user_id
  ) then raise exception 'PROJECT_NOT_FOUND' using errcode = 'P0002'; end if;
  return new;
end;
$$;

drop trigger if exists time_management_tasks_validate_project_relation on public.time_management_tasks;
create trigger time_management_tasks_validate_project_relation
  before insert or update of project_id, project_stage_id, user_id on public.time_management_tasks
  for each row execute function public.validate_project_task_relation();

create trigger projects_validate_completion
  before update of status on public.projects
  for each row execute function public.validate_project_completion();

create trigger projects_validate_initial_status
  before insert on public.projects
  for each row execute function public.validate_project_initial_status();

create trigger project_stages_validate_project_relation
  before insert or update of project_id, user_id on public.project_stages
  for each row execute function public.validate_project_stage_relation();

create trigger projects_set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
create trigger project_stages_set_updated_at before update on public.project_stages
  for each row execute function public.set_updated_at();
create trigger project_templates_set_updated_at before update on public.project_templates
  for each row execute function public.set_updated_at();

drop function if exists public.save_time_management_task(uuid, text, text, text, timestamptz, timestamptz, boolean, text, jsonb, timestamptz);
create function public.save_time_management_task(
  p_id uuid, p_title text, p_quadrant text, p_schedule_mode text,
  p_scheduled_start_at timestamptz, p_scheduled_end_at timestamptz,
  p_completed boolean, p_description text, p_reminder jsonb,
  p_project_id uuid, p_project_stage_id uuid, p_priority text, p_assignee_name text,
  p_expected_updated_at timestamptz
) returns timestamptz language plpgsql security invoker set search_path = pg_catalog, public as $$
declare saved_at timestamptz;
begin
  if p_expected_updated_at is null then
    insert into public.time_management_tasks (
      id, user_id, title, quadrant, schedule_mode, scheduled_start_at,
      scheduled_end_at, completed, completed_at, description, reminder,
      project_id, project_stage_id, priority, assignee_name
    ) values (
      p_id, (select auth.uid()), p_title, p_quadrant, p_schedule_mode,
      p_scheduled_start_at, p_scheduled_end_at, p_completed,
      case when p_completed then now() else null end, p_description, p_reminder,
      p_project_id, p_project_stage_id, coalesce(p_priority, 'medium'), p_assignee_name
    ) on conflict (id) do nothing returning updated_at into saved_at;
  else
    update public.time_management_tasks
       set title = p_title, quadrant = p_quadrant, schedule_mode = p_schedule_mode,
           scheduled_start_at = p_scheduled_start_at, scheduled_end_at = p_scheduled_end_at,
           completed = p_completed,
           completed_at = case when p_completed and not completed then now() when not p_completed then null else completed_at end,
           description = p_description, reminder = p_reminder, project_id = p_project_id,
           project_stage_id = p_project_stage_id, priority = coalesce(p_priority, 'medium'),
           assignee_name = p_assignee_name
     where id = p_id and user_id = (select auth.uid()) and deleted_at is null
       and date_trunc('milliseconds', updated_at) = date_trunc('milliseconds', p_expected_updated_at)
     returning updated_at into saved_at;
  end if;
  if saved_at is null then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
  return saved_at;
end;
$$;

create function public.save_project(
  p_id uuid, p_name text, p_description text, p_status text, p_due_date date,
  p_priority text, p_tags text[], p_owner_name text, p_expected_updated_at timestamptz
) returns timestamptz language plpgsql security invoker set search_path = pg_catalog, public as $$
declare saved_at timestamptz;
begin
  if p_expected_updated_at is null then
    insert into public.projects (id, user_id, name, description, status, due_date, priority, tags, owner_name)
    values (p_id, (select auth.uid()), p_name, p_description, 'not_started', p_due_date,
      coalesce(p_priority, 'medium'), coalesce(p_tags, '{}'), p_owner_name)
    on conflict (id) do nothing returning updated_at into saved_at;
  else
    if p_status = 'completed' and exists (
      select 1 from public.time_management_tasks t
      where t.project_id = p_id and t.user_id = (select auth.uid()) and t.deleted_at is null and not t.completed
    ) then raise exception 'PROJECT_HAS_INCOMPLETE_TASKS' using errcode = '23514'; end if;
    update public.projects
       set name = p_name, description = p_description, status = p_status, due_date = p_due_date,
           priority = coalesce(p_priority, 'medium'), tags = coalesce(p_tags, '{}'), owner_name = p_owner_name
     where id = p_id and user_id = (select auth.uid())
       and date_trunc('milliseconds', updated_at) = date_trunc('milliseconds', p_expected_updated_at)
     returning updated_at into saved_at;
  end if;
  if saved_at is null then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
  return saved_at;
end;
$$;

create function public.save_project_stage(
  p_id uuid, p_project_id uuid, p_name text, p_default_assignee_name text,
  p_sort_order integer, p_template_key text
) returns uuid language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if not exists (select 1 from public.projects p where p.id = p_project_id and p.user_id = (select auth.uid())) then
    raise exception 'PROJECT_NOT_FOUND' using errcode = 'P0002';
  end if;
  insert into public.project_stages (id, project_id, user_id, name, default_assignee_name, sort_order, template_key)
  values (p_id, p_project_id, (select auth.uid()), p_name, p_default_assignee_name, p_sort_order, p_template_key)
  on conflict (id) do update set name = excluded.name, default_assignee_name = excluded.default_assignee_name,
    sort_order = excluded.sort_order, template_key = excluded.template_key
  where project_stages.user_id = (select auth.uid());
  return p_id;
end;
$$;

create function public.save_project_template(p_id uuid, p_name text, p_description text, p_definition jsonb)
returns timestamptz language plpgsql security invoker set search_path = pg_catalog, public as $$
declare saved_at timestamptz;
begin
  if jsonb_typeof(p_definition->'stages') is distinct from 'array'
     or jsonb_typeof(p_definition->'tasks') is distinct from 'array' then
    raise exception 'INVALID_TEMPLATE_DEFINITION' using errcode = '22023';
  end if;
  insert into public.project_templates (id, user_id, name, description, definition)
  values (p_id, (select auth.uid()), p_name, p_description, p_definition)
  on conflict (id) do update set name = excluded.name, description = excluded.description, definition = excluded.definition
  where project_templates.user_id = (select auth.uid())
  returning updated_at into saved_at;
  if saved_at is null then raise exception 'TEMPLATE_NOT_FOUND' using errcode = 'P0002'; end if;
  return saved_at;
end;
$$;

create function public.create_project_from_template(
  p_project_id uuid, p_template_id uuid, p_name text, p_description text,
  p_due_date date, p_priority text, p_tags text[], p_owner_name text
) returns uuid language plpgsql security invoker set search_path = pg_catalog, public as $$
declare definition_value jsonb;
declare stage_value jsonb;
declare task_value jsonb;
declare stage_id uuid;
declare ordinal integer := 0;
begin
  select definition into definition_value from public.project_templates
   where id = p_template_id and user_id = (select auth.uid());
  if definition_value is null then raise exception 'TEMPLATE_NOT_FOUND' using errcode = 'P0002'; end if;
  insert into public.projects (id, user_id, name, description, status, due_date, priority, tags, owner_name)
  values (p_project_id, (select auth.uid()), p_name, coalesce(p_description, ''), 'not_started', p_due_date,
    coalesce(p_priority, 'medium'), coalesce(p_tags, '{}'), p_owner_name);
  for stage_value in select value from jsonb_array_elements(definition_value->'stages') loop
    insert into public.project_stages (project_id, user_id, name, default_assignee_name, sort_order, template_key)
    values (p_project_id, (select auth.uid()), coalesce(stage_value->>'name', '未命名阶段'),
      nullif(stage_value->>'defaultAssigneeName', ''), ordinal, coalesce(stage_value->>'key', stage_value->>'name'));
    ordinal := ordinal + 1;
  end loop;
  for task_value in select value from jsonb_array_elements(definition_value->'tasks') loop
    select id into stage_id from public.project_stages
      where project_id = p_project_id and template_key = nullif(task_value->>'stageKey', '') order by sort_order limit 1;
    insert into public.time_management_tasks (
      id, user_id, title, quadrant, completed, description, project_id, project_stage_id, priority, assignee_name
    ) values (
      gen_random_uuid(), (select auth.uid()), coalesce(task_value->>'title', '未命名任务'),
      coalesce(task_value->>'quadrant', 'Q2_NOT_URGENT_IMPORTANT'), false,
      nullif(task_value->>'description', ''), p_project_id, stage_id,
      coalesce(task_value->>'priority', 'medium'),
      coalesce(nullif(task_value->>'assigneeName', ''), (select default_assignee_name from public.project_stages where id = stage_id))
    );
  end loop;
  return p_project_id;
end;
$$;

-- Realtime stays a small invalidation hint on the existing private user topic.
do $$
declare table_name text;
begin
  foreach table_name in array array['projects', 'project_stages', 'project_templates'] loop
    execute format('drop trigger if exists %I_broadcast_user_sync on public.%I', table_name, table_name);
    execute format('create trigger %I_broadcast_user_sync after insert or update or delete on public.%I for each row execute function public.broadcast_user_sync()', table_name, table_name);
  end loop;
end $$;

revoke all on function public.validate_project_task_relation() from public, anon, authenticated;
revoke all on function public.validate_project_completion() from public, anon, authenticated;
revoke all on function public.validate_project_initial_status() from public, anon, authenticated;
revoke all on function public.validate_project_stage_relation() from public, anon, authenticated;

do $$
declare fn record;
begin
  for fn in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('save_time_management_task', 'save_project', 'save_project_stage', 'save_project_template', 'create_project_from_template')
  loop
    execute format('revoke execute on function %s from public, anon', fn.signature);
    execute format('grant execute on function %s to authenticated', fn.signature);
  end loop;
end $$;
