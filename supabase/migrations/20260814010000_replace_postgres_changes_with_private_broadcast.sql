-- Scalable, user-scoped sync: replace Postgres Changes row replication with
-- minimal Broadcast invalidation hints. The client refetches through its normal
-- RLS-protected queries and never treats a Broadcast payload as authoritative.

drop policy if exists "workbuddy users receive own sync broadcasts" on realtime.messages;
create policy "workbuddy users receive own sync broadcasts"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and realtime.topic() = ('user:' || (select auth.uid())::text || ':sync')
);

create or replace function public.broadcast_user_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
  entity_id uuid;
  current_folder_id uuid;
  old_folder_id uuid;
begin
  if TG_OP = 'DELETE' then
    target_user_id := old.user_id;
    entity_id := old.id;
    current_folder_id := nullif(to_jsonb(old)->>'folder_id', '')::uuid;
    old_folder_id := current_folder_id;
  else
    target_user_id := new.user_id;
    entity_id := new.id;
    current_folder_id := nullif(to_jsonb(new)->>'folder_id', '')::uuid;
    if TG_OP = 'UPDATE' then
      old_folder_id := nullif(to_jsonb(old)->>'folder_id', '')::uuid;
    end if;
  end if;

  if target_user_id is not null then
    perform realtime.send(
      jsonb_build_object(
        'table', TG_TABLE_NAME,
        'operation', TG_OP,
        'id', entity_id,
        'folder_id', current_folder_id,
        'previous_folder_id', old_folder_id
      ),
      'entity_changed',
      'user:' || target_user_id::text || ':sync',
      true
    );
  end if;

  if TG_OP = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.broadcast_user_sync() from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'knowledge_bases',
    'knowledge_base_folders',
    'folder_note_groups',
    'notes',
    'knowledge_base_templates',
    'habits',
    'habit_checkins',
    'daily_reviews',
    'time_management_tasks',
    'focus_sessions'
  ] loop
    execute format('drop trigger if exists %I_broadcast_user_sync on public.%I', table_name, table_name);
    execute format(
      'create trigger %I_broadcast_user_sync after insert or update or delete on public.%I '
      'for each row execute function public.broadcast_user_sync()',
      table_name, table_name
    );
    begin
      execute format('alter publication supabase_realtime drop table public.%I', table_name);
    exception
      when undefined_object then null;
    end;
  end loop;
end
$$;
