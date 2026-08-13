-- A daily review is a stable per-user/per-date record. Clearing it is an
-- ordinary update so the row id and optimistic-sync version are preserved.
drop function if exists public.delete_daily_review(uuid);
