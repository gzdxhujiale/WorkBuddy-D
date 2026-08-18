-- Deleted stages remain as audit history, so ordering must be unique only
-- among active stages. The allocator in save_project_stage deliberately
-- ignores deleted rows; the original table-wide constraint disagreed with
-- that behavior and rejected a newly allocated reused position.

alter table public.project_stages
  drop constraint if exists project_stages_project_id_sort_order_key;

create unique index project_stages_active_project_sort_order_key
  on public.project_stages (project_id, sort_order)
  where deleted_at is null;
