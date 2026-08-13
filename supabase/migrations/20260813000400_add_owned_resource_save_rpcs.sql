-- Every client-created row derives user_id from auth.uid(). This keeps RLS as
-- the authority and avoids repeating ownership fields in browser payloads.

create or replace function public.save_knowledge_base(
  p_id uuid, p_name text, p_is_pinned boolean, p_sort_order integer, p_updated_at timestamptz
) returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  insert into public.knowledge_bases (id, user_id, name, is_pinned, sort_order, updated_at)
  values (p_id, (select auth.uid()), p_name, p_is_pinned, p_sort_order, p_updated_at)
  on conflict (id) do update set
    name = excluded.name, is_pinned = excluded.is_pinned,
    sort_order = excluded.sort_order, updated_at = excluded.updated_at
  where public.knowledge_bases.user_id = (select auth.uid());
end;
$$;

create or replace function public.save_knowledge_base_folder(
  p_id uuid, p_knowledge_base_id uuid, p_name text, p_icon text, p_color text,
  p_view_type text, p_is_pinned boolean, p_sort_order integer, p_updated_at timestamptz
) returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if p_knowledge_base_id is not null and not exists (
    select 1 from public.knowledge_bases b
    where b.id = p_knowledge_base_id and b.user_id = (select auth.uid()) and b.deleted_at is null
  ) then raise exception 'KNOWLEDGE_BASE_NOT_FOUND' using errcode = 'P0002'; end if;

  insert into public.knowledge_base_folders
    (id, user_id, knowledge_base_id, name, icon, color, view_type, is_pinned, sort_order, updated_at)
  values
    (p_id, (select auth.uid()), p_knowledge_base_id, p_name, coalesce(p_icon, ''), coalesce(p_color, '#000000'), coalesce(p_view_type, 'list'), p_is_pinned, p_sort_order, p_updated_at)
  on conflict (id) do update set
    knowledge_base_id = excluded.knowledge_base_id, name = excluded.name,
    icon = excluded.icon, color = excluded.color, view_type = excluded.view_type,
    is_pinned = excluded.is_pinned, sort_order = excluded.sort_order, updated_at = excluded.updated_at
  where public.knowledge_base_folders.user_id = (select auth.uid());
end;
$$;

create or replace function public.save_folder_note_group(
  p_id uuid, p_folder_id uuid, p_name text, p_sort_order integer, p_updated_at timestamptz
) returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if not exists (
    select 1 from public.knowledge_base_folders f
    where f.id = p_folder_id and f.user_id = (select auth.uid()) and f.deleted_at is null
  ) then raise exception 'FOLDER_NOT_FOUND' using errcode = 'P0002'; end if;

  insert into public.folder_note_groups (id, user_id, folder_id, name, sort_order, updated_at)
  values (p_id, (select auth.uid()), p_folder_id, p_name, p_sort_order, p_updated_at)
  on conflict (id) do update set
    folder_id = excluded.folder_id, name = excluded.name,
    sort_order = excluded.sort_order, updated_at = excluded.updated_at
  where public.folder_note_groups.user_id = (select auth.uid());
end;
$$;

create or replace function public.save_knowledge_base_template(
  p_id uuid, p_name text, p_content jsonb, p_updated_at timestamptz
) returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  insert into public.knowledge_base_templates (id, user_id, name, content, updated_at)
  values (p_id, (select auth.uid()), p_name, p_content, p_updated_at)
  on conflict (id) do update set
    name = excluded.name, content = excluded.content, updated_at = excluded.updated_at
  where public.knowledge_base_templates.user_id = (select auth.uid());
end;
$$;

create or replace function public.create_focus_session(
  p_id uuid, p_cycle_id uuid, p_task_id uuid, p_type text, p_status text,
  p_planned_minutes integer, p_active_seconds integer, p_rest_completed boolean,
  p_started_at timestamptz
) returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if p_task_id is not null and not exists (
    select 1 from public.time_management_tasks t
    where t.id = p_task_id and t.user_id = (select auth.uid()) and t.deleted_at is null
  ) then raise exception 'TASK_NOT_FOUND' using errcode = 'P0002'; end if;

  insert into public.focus_sessions
    (id, user_id, cycle_id, task_id, type, status, planned_minutes, active_seconds, rest_completed, started_at)
  values
    (p_id, (select auth.uid()), p_cycle_id, p_task_id, p_type, p_status, p_planned_minutes, p_active_seconds, p_rest_completed, p_started_at);
end;
$$;

do $$
declare fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'save_knowledge_base', 'save_knowledge_base_folder', 'save_folder_note_group',
      'save_knowledge_base_template', 'create_focus_session'
    )
  loop
    execute format('revoke execute on function %s from public, anon', fn.signature);
    execute format('grant execute on function %s to authenticated', fn.signature);
  end loop;
end;
$$;
