-- Foreign-key maintenance needs non-partial covering indexes; the active-row
-- indexes in the project-center migration intentionally do not satisfy this.
create index project_stages_user_id_idx on public.project_stages (user_id);
create index time_management_tasks_project_id_idx on public.time_management_tasks (project_id);
