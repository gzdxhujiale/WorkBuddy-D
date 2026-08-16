-- New stages receive their position inside the same transaction, so concurrent
-- clients cannot reuse a stale stage-count value.
create or replace function public.save_project_stage(
  p_id uuid, p_project_id uuid, p_name text, p_default_assignee_name text,
  p_sort_order integer, p_template_key text
) returns uuid language plpgsql security invoker set search_path = pg_catalog, public as $$
declare assigned_sort_order integer;
begin
  if not exists (select 1 from public.projects p where p.id = p_project_id and p.user_id = (select auth.uid())) then
    raise exception 'PROJECT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.project_stages s where s.id = p_id and s.user_id = (select auth.uid())) then
    update public.project_stages
       set name = p_name, default_assignee_name = p_default_assignee_name,
           sort_order = p_sort_order, template_key = p_template_key
     where id = p_id and user_id = (select auth.uid());
  else
    perform pg_advisory_xact_lock(hashtextextended(p_project_id::text, 0));
    select coalesce(max(s.sort_order), -1) + 1 into assigned_sort_order
      from public.project_stages s where s.project_id = p_project_id;
    insert into public.project_stages (id, project_id, user_id, name, default_assignee_name, sort_order, template_key)
    values (p_id, p_project_id, (select auth.uid()), p_name, p_default_assignee_name, assigned_sort_order, p_template_key);
  end if;
  return p_id;
end;
$$;

revoke execute on function public.save_project_stage(uuid, uuid, text, text, integer, text) from public, anon;
grant execute on function public.save_project_stage(uuid, uuid, text, text, integer, text) to authenticated;
