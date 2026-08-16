-- Templates now persist the task table's canonical quadrant values directly.
-- Keep server validation, but do not translate legacy Q1–Q4 shorthand.
create or replace function public.create_project_from_template(
  p_project_id uuid, p_template_id uuid, p_name text, p_description text,
  p_due_date date, p_priority text, p_tags text[], p_owner_name text
) returns uuid language plpgsql security invoker set search_path = pg_catalog, public as $$
declare definition_value jsonb;
declare stage_value jsonb;
declare task_value jsonb;
declare stage_id uuid;
declare task_quadrant text;
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
    task_quadrant := coalesce(task_value->>'quadrant', 'Q2_NOT_URGENT_IMPORTANT');
    if task_quadrant not in (
      'Q1_URGENT_IMPORTANT', 'Q2_NOT_URGENT_IMPORTANT',
      'Q3_URGENT_NOT_IMPORTANT', 'Q4_NOT_URGENT_NOT_IMPORTANT'
    ) then raise exception 'INVALID_TEMPLATE_TASK_QUADRANT' using errcode = '22023'; end if;
    select id into stage_id from public.project_stages
      where project_id = p_project_id and template_key = nullif(task_value->>'stageKey', '') order by sort_order limit 1;
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
