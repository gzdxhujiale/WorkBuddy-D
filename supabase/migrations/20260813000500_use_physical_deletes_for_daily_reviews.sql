-- Daily reviews are unique per user/date and are edited in place. Do not use
-- soft deletion here: physical deletion allows a fresh review for the same day.
create or replace function public.delete_daily_review(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  delete from public.daily_reviews
  where id = p_id and user_id = (select auth.uid());
end;
$$;

revoke execute on function public.delete_daily_review(uuid) from public, anon;
grant execute on function public.delete_daily_review(uuid) to authenticated;
