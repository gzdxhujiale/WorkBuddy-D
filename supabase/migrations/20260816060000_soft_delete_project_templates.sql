alter table public.project_templates add column deleted_at timestamptz;

create index project_templates_active_idx
  on public.project_templates (user_id, updated_at desc)
  where deleted_at is null;

create function public.soft_delete_project_template(p_id uuid)
returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  update public.project_templates set deleted_at = now()
   where id = p_id and user_id = (select auth.uid()) and deleted_at is null;
end;
$$;

revoke execute on function public.soft_delete_project_template(uuid) from public, anon;
grant execute on function public.soft_delete_project_template(uuid) to authenticated;
