create table if not exists public.focus_sessions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cycle_id uuid not null,
  task_id uuid references public.time_management_tasks(id) on delete set null,
  type text not null check (type in ('focus', 'rest')),
  status text not null check (status in ('running', 'paused', 'completed', 'interrupted')),
  planned_minutes smallint not null check (planned_minutes between 1 and 180),
  active_seconds integer not null default 0 check (active_seconds >= 0),
  rest_completed boolean not null default false,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.focus_sessions enable row level security;
create policy "Users can read their focus sessions" on public.focus_sessions for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create their focus sessions" on public.focus_sessions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their focus sessions" on public.focus_sessions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create index if not exists focus_sessions_user_started_idx on public.focus_sessions(user_id, started_at desc);
create index if not exists focus_sessions_cycle_idx on public.focus_sessions(cycle_id);
