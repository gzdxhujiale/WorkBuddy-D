-- Habit check-ins are saved without a client-supplied user_id. The RPC derives
-- ownership from the authenticated JWT and is safe to replay from the offline queue.
create or replace function public.save_habit_checkin(
  p_habit_id uuid,
  p_date date,
  p_completed boolean,
  p_updated_at timestamptz default now()
) returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if not exists (
    select 1 from public.habits h
     where h.id = p_habit_id
       and h.user_id = (select auth.uid())
       and h.deleted_at is null
  ) then
    raise exception 'HABIT_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.habit_checkins (user_id, habit_id, date, completed, updated_at)
  values ((select auth.uid()), p_habit_id, p_date, p_completed, p_updated_at)
  on conflict (user_id, habit_id, date) do update
    set completed = excluded.completed,
        updated_at = excluded.updated_at,
        deleted_at = null;
end;
$$;

revoke execute on function public.save_habit_checkin(uuid, date, boolean, timestamptz)
  from public, anon;
grant execute on function public.save_habit_checkin(uuid, date, boolean, timestamptz)
  to authenticated;
