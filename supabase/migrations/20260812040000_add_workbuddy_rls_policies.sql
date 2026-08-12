-- RLS policies for the authenticated application user.
-- Tables already have RLS enabled; without policies PostgREST returns empty
-- reads and rejects inserts/updates.

do $$
declare
  table_name text;
  policy_name text;
begin
  foreach table_name in array array[
    'daily_reviews', 'folder_note_groups', 'habit_checkins', 'habits',
    'knowledge_base_folders', 'knowledge_base_templates', 'knowledge_bases',
    'notes', 'time_management_tasks'
  ] loop
    foreach policy_name in array array['select', 'insert', 'update', 'delete'] loop
      execute format(
        'drop policy if exists %I on public.%I',
        table_name || '_' || policy_name || '_own', table_name
      );
    end loop;

    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', table_name || '_select_own', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', table_name || '_insert_own', table_name);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name || '_update_own', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', table_name || '_delete_own', table_name);
  end loop;

  -- Focus sessions intentionally have no client hard-delete policy.
  drop policy if exists focus_sessions_select_own on public.focus_sessions;
  drop policy if exists focus_sessions_insert_own on public.focus_sessions;
  drop policy if exists focus_sessions_update_own on public.focus_sessions;
  create policy focus_sessions_select_own on public.focus_sessions for select to authenticated using ((select auth.uid()) = user_id);
  create policy focus_sessions_insert_own on public.focus_sessions for insert to authenticated with check ((select auth.uid()) = user_id);
  create policy focus_sessions_update_own on public.focus_sessions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
end
$$;
