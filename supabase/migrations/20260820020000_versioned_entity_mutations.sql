-- Versioned structural mutations.  The v2 save RPCs protect field edits; these
-- v3 functions close the remaining mutation paths (reorder, move, soft delete).
-- Every function is SECURITY INVOKER so the caller's RLS policies remain in force.

create or replace function public.reorder_project_stages_v3(
  p_project_id uuid,
  p_items jsonb
)
returns table(id uuid, updated_at timestamptz, lock_version bigint, sort_order integer)
language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if not exists (
    select 1 from public.projects p
    where p.id = p_project_id and p.user_id = (select auth.uid()) and p.deleted_at is null
  ) then
    raise exception 'VERSION_CONFLICT' using errcode = '40001';
  end if;

  if jsonb_typeof(coalesce(p_items, 'null'::jsonb)) <> 'array'
     or jsonb_array_length(p_items) = 0
     or exists (select 1 from jsonb_to_recordset(p_items) x(id uuid, sort_order integer, lock_version bigint) group by x.id having count(*) <> 1)
     or exists (select 1 from jsonb_to_recordset(p_items) x(id uuid, sort_order integer, lock_version bigint) group by x.sort_order having count(*) <> 1) then
    raise exception 'INVALID_REORDER_PAYLOAD' using errcode = '22023';
  end if;

  -- A full stage ordering is required: partial permutations can collide with
  -- untouched rows under the per-project unique sort-order constraint.
  if exists (
    select 1
    from jsonb_to_recordset(p_items) x(id uuid, sort_order integer, lock_version bigint)
    full join public.project_stages s
      on s.id = x.id and s.project_id = p_project_id and s.user_id = (select auth.uid()) and s.deleted_at is null
    where x.id is null or s.id is null or s.lock_version <> x.lock_version
  ) then
    raise exception 'VERSION_CONFLICT' using errcode = '40001';
  end if;

  -- Release the constrained slots first, then assign the final permutation.
  update public.project_stages s
     set sort_order = 100000 + x.sort_order
    from jsonb_to_recordset(p_items) x(id uuid, sort_order integer, lock_version bigint)
   where s.id = x.id and s.project_id = p_project_id and s.user_id = (select auth.uid()) and s.deleted_at is null;

  return query
    update public.project_stages s
       set sort_order = x.sort_order
      from jsonb_to_recordset(p_items) x(id uuid, sort_order integer, lock_version bigint)
     where s.id = x.id and s.project_id = p_project_id and s.user_id = (select auth.uid()) and s.deleted_at is null
    returning s.id, s.updated_at, s.lock_version, s.sort_order;
end;
$$;

create or replace function public.reorder_knowledge_bases_v3(p_items jsonb)
returns table(id uuid, updated_at timestamptz, lock_version bigint, sort_order integer)
language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if jsonb_typeof(coalesce(p_items, 'null'::jsonb)) <> 'array'
     or exists (select 1 from jsonb_to_recordset(p_items) x(id uuid, sort_order integer, lock_version bigint) group by x.id having count(*) <> 1)
     or exists (select 1 from jsonb_to_recordset(p_items) x(id uuid, sort_order integer, lock_version bigint) group by x.sort_order having count(*) <> 1)
     or exists (select 1 from jsonb_to_recordset(p_items) x(id uuid, sort_order integer, lock_version bigint) left join public.knowledge_bases b on b.id = x.id and b.user_id = (select auth.uid()) and b.deleted_at is null where b.id is null or b.lock_version <> x.lock_version) then
    raise exception 'VERSION_CONFLICT' using errcode = '40001';
  end if;
  return query update public.knowledge_bases b set sort_order = x.sort_order
    from jsonb_to_recordset(p_items) x(id uuid, sort_order integer, lock_version bigint)
   where b.id = x.id and b.user_id = (select auth.uid()) and b.deleted_at is null
    returning b.id, b.updated_at, b.lock_version, b.sort_order;
end;
$$;

create or replace function public.reorder_knowledge_base_folders_v3(p_items jsonb)
returns table(id uuid, updated_at timestamptz, lock_version bigint, sort_order integer)
language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if jsonb_typeof(coalesce(p_items, 'null'::jsonb)) <> 'array'
     or exists (select 1 from jsonb_to_recordset(p_items) x(id uuid, sort_order integer, lock_version bigint) group by x.id having count(*) <> 1)
     or exists (select 1 from jsonb_to_recordset(p_items) x(id uuid, sort_order integer, lock_version bigint) left join public.knowledge_base_folders f on f.id = x.id and f.user_id = (select auth.uid()) and f.deleted_at is null where f.id is null or f.lock_version <> x.lock_version) then
    raise exception 'VERSION_CONFLICT' using errcode = '40001';
  end if;
  return query update public.knowledge_base_folders f set sort_order = x.sort_order
    from jsonb_to_recordset(p_items) x(id uuid, sort_order integer, lock_version bigint)
   where f.id = x.id and f.user_id = (select auth.uid()) and f.deleted_at is null
    returning f.id, f.updated_at, f.lock_version, f.sort_order;
end;
$$;

create or replace function public.move_knowledge_base_folder_v3(
  p_id uuid,
  p_knowledge_base_id uuid,
  p_expected_lock_version bigint
)
returns table(id uuid, updated_at timestamptz, lock_version bigint, sort_order integer)
language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if p_knowledge_base_id is not null and not exists (
    select 1 from public.knowledge_bases b
    where b.id = p_knowledge_base_id and b.user_id = (select auth.uid()) and b.deleted_at is null
  ) then
    raise exception 'VERSION_CONFLICT' using errcode = '40001';
  end if;
  return query update public.knowledge_base_folders f
     set knowledge_base_id = p_knowledge_base_id
   where f.id = p_id and f.user_id = (select auth.uid()) and f.deleted_at is null
     and f.lock_version = p_expected_lock_version
  returning f.id, f.updated_at, f.lock_version, f.sort_order;
  if not found then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
end;
$$;

create or replace function public.reorder_notes_v3(p_items jsonb)
returns table(id uuid, updated_at timestamptz, lock_version bigint, sort_order integer)
language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if jsonb_typeof(coalesce(p_items, 'null'::jsonb)) <> 'array'
     or exists (select 1 from jsonb_to_recordset(p_items) x(id uuid, sort_order integer, lock_version bigint) group by x.id having count(*) <> 1)
     or exists (select 1 from jsonb_to_recordset(p_items) x(id uuid, sort_order integer, lock_version bigint) left join public.notes n on n.id = x.id and n.user_id = (select auth.uid()) and n.deleted_at is null where n.id is null or n.lock_version <> x.lock_version) then
    raise exception 'VERSION_CONFLICT' using errcode = '40001';
  end if;
  return query update public.notes n set sort_order = x.sort_order
    from jsonb_to_recordset(p_items) x(id uuid, sort_order integer, lock_version bigint)
   where n.id = x.id and n.user_id = (select auth.uid()) and n.deleted_at is null
    returning n.id, n.updated_at, n.lock_version, n.sort_order;
end;
$$;

create or replace function public.soft_delete_note_v3(p_id uuid, p_expected_lock_version bigint)
returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  update public.notes set deleted_at = now()
   where id = p_id and user_id = (select auth.uid()) and deleted_at is null and lock_version = p_expected_lock_version;
  if not found then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
end;
$$;

create or replace function public.soft_delete_folder_note_group_v3(p_id uuid, p_expected_lock_version bigint)
returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  update public.folder_note_groups set deleted_at = now()
   where id = p_id and user_id = (select auth.uid()) and deleted_at is null and lock_version = p_expected_lock_version;
  if not found then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
  update public.notes set group_id = null where group_id = p_id and user_id = (select auth.uid()) and deleted_at is null;
end;
$$;

create or replace function public.soft_delete_knowledge_base_folder_v3(p_id uuid, p_expected_lock_version bigint)
returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
declare deleted_at_value timestamptz := now();
begin
  update public.knowledge_base_folders set deleted_at = deleted_at_value
   where id = p_id and user_id = (select auth.uid()) and deleted_at is null and lock_version = p_expected_lock_version;
  if not found then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
  update public.notes set deleted_at = deleted_at_value where folder_id = p_id and user_id = (select auth.uid()) and deleted_at is null;
  update public.folder_note_groups set deleted_at = deleted_at_value where folder_id = p_id and user_id = (select auth.uid()) and deleted_at is null;
end;
$$;

create or replace function public.soft_delete_knowledge_base_v3(p_id uuid, p_expected_lock_version bigint)
returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
declare deleted_at_value timestamptz := now();
begin
  update public.knowledge_bases set deleted_at = deleted_at_value
   where id = p_id and user_id = (select auth.uid()) and deleted_at is null and lock_version = p_expected_lock_version;
  if not found then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
  update public.notes n set deleted_at = deleted_at_value
   from public.knowledge_base_folders f where n.folder_id = f.id and f.knowledge_base_id = p_id and n.user_id = (select auth.uid()) and n.deleted_at is null;
  update public.folder_note_groups g set deleted_at = deleted_at_value
   from public.knowledge_base_folders f where g.folder_id = f.id and f.knowledge_base_id = p_id and g.user_id = (select auth.uid()) and g.deleted_at is null;
  update public.knowledge_base_folders set deleted_at = deleted_at_value where knowledge_base_id = p_id and user_id = (select auth.uid()) and deleted_at is null;
end;
$$;

create or replace function public.soft_delete_knowledge_base_template_v3(p_id uuid, p_expected_lock_version bigint)
returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  update public.knowledge_base_templates set deleted_at = now()
   where id = p_id and user_id = (select auth.uid()) and deleted_at is null and lock_version = p_expected_lock_version;
  if not found then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
end;
$$;

create or replace function public.soft_delete_time_management_task_v3(p_id uuid, p_expected_lock_version bigint)
returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  update public.time_management_tasks set deleted_at = now()
   where id = p_id and user_id = (select auth.uid()) and deleted_at is null and lock_version = p_expected_lock_version;
  if not found then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
end;
$$;

create or replace function public.soft_delete_habit_v3(p_id uuid, p_expected_lock_version bigint)
returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
declare deleted_at_value timestamptz := now();
begin
  update public.habits set deleted_at = deleted_at_value
   where id = p_id and user_id = (select auth.uid()) and deleted_at is null and lock_version = p_expected_lock_version;
  if not found then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
  update public.habit_checkins set deleted_at = deleted_at_value where habit_id = p_id and user_id = (select auth.uid()) and deleted_at is null;
end;
$$;

create or replace function public.soft_delete_project_template_v3(p_id uuid, p_expected_lock_version bigint)
returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  update public.project_templates set deleted_at = now()
   where id = p_id and user_id = (select auth.uid()) and deleted_at is null and lock_version = p_expected_lock_version;
  if not found then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
end;
$$;

create or replace function public.soft_delete_project_stage_v3(p_id uuid, p_expected_lock_version bigint)
returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
declare deleted_at_value timestamptz := now();
begin
  update public.project_stages set deleted_at = deleted_at_value
   where id = p_id and user_id = (select auth.uid()) and deleted_at is null and lock_version = p_expected_lock_version;
  if not found then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
  update public.time_management_tasks set deleted_at = deleted_at_value where project_stage_id = p_id and user_id = (select auth.uid()) and deleted_at is null;
end;
$$;

create or replace function public.soft_delete_project_v3(p_id uuid, p_expected_lock_version bigint)
returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
declare deleted_at_value timestamptz := now();
begin
  update public.projects set deleted_at = deleted_at_value
   where id = p_id and user_id = (select auth.uid()) and deleted_at is null and lock_version = p_expected_lock_version;
  if not found then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
  update public.time_management_tasks set deleted_at = deleted_at_value where project_id = p_id and user_id = (select auth.uid()) and deleted_at is null;
  update public.project_stages set deleted_at = deleted_at_value where project_id = p_id and user_id = (select auth.uid()) and deleted_at is null;
end;
$$;

do $$
declare fn regprocedure;
begin
  foreach fn in array array[
    'public.reorder_project_stages_v3(uuid,jsonb)'::regprocedure,
    'public.reorder_knowledge_bases_v3(jsonb)'::regprocedure,
    'public.reorder_knowledge_base_folders_v3(jsonb)'::regprocedure,
    'public.move_knowledge_base_folder_v3(uuid,uuid,bigint)'::regprocedure,
    'public.reorder_notes_v3(jsonb)'::regprocedure,
    'public.soft_delete_note_v3(uuid,bigint)'::regprocedure,
    'public.soft_delete_folder_note_group_v3(uuid,bigint)'::regprocedure,
    'public.soft_delete_knowledge_base_folder_v3(uuid,bigint)'::regprocedure,
    'public.soft_delete_knowledge_base_v3(uuid,bigint)'::regprocedure,
    'public.soft_delete_knowledge_base_template_v3(uuid,bigint)'::regprocedure,
    'public.soft_delete_time_management_task_v3(uuid,bigint)'::regprocedure,
    'public.soft_delete_habit_v3(uuid,bigint)'::regprocedure,
    'public.soft_delete_project_template_v3(uuid,bigint)'::regprocedure,
    'public.soft_delete_project_stage_v3(uuid,bigint)'::regprocedure,
    'public.soft_delete_project_v3(uuid,bigint)'::regprocedure
  ] loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;
