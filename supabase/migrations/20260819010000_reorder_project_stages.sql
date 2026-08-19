-- Atomic stage reordering function
-- Handles uniqueness constraint on (project_id, sort_order) by applying a two-phase positive offset.
-- Note: project_stages has check (sort_order >= 0), so temporary slots must be positive (e.g. 100000 + pos).

create or replace function public.reorder_project_stages(
  p_project_id uuid,
  p_stage_ids uuid[]
) returns void
language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if not exists (
    select 1 from public.projects p
    where p.id = p_project_id and p.user_id = (select auth.uid()) and p.deleted_at is null
  ) then
    raise exception 'PROJECT_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Phase 1: assign temporary positive high sort_orders to clear normal slots and avoid unique index collision
  update public.project_stages s
     set sort_order = 100000 + ord.pos
    from unnest(p_stage_ids) with ordinality as ord(stage_id, pos)
   where s.id = ord.stage_id
     and s.project_id = p_project_id
     and s.user_id = (select auth.uid())
     and s.deleted_at is null;

  -- Phase 2: assign final 0-indexed sort_orders
  update public.project_stages s
     set sort_order = ord.pos - 1
    from unnest(p_stage_ids) with ordinality as ord(stage_id, pos)
   where s.id = ord.stage_id
     and s.project_id = p_project_id
     and s.user_id = (select auth.uid())
     and s.deleted_at is null;
end;
$$;

revoke execute on function public.reorder_project_stages(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_project_stages(uuid, uuid[]) to authenticated;
