-- Realtime is limited to the user-owned tables that back active React Query
-- views. Every client subscription also filters by user_id.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'habits',
    'habit_checkins',
    'daily_reviews',
    'mission_roles',
    'time_management_tasks',
    'knowledge_base_templates'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    exception
      when duplicate_object then null;
    end;
  end loop;
end $$;
