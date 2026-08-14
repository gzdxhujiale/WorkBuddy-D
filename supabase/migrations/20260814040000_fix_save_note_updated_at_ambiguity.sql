-- Qualify notes.updated_at because the return table also exposes updated_at.
create or replace function public.save_note(
  p_id uuid, p_folder_id uuid, p_group_id uuid, p_title text, p_content text,
  p_is_pinned boolean, p_sort_order integer, p_expected_updated_at timestamptz
) returns table(updated_at timestamptz, sort_order integer)
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare saved_at timestamptz;
declare saved_sort_order integer;
begin
  if not exists (
    select 1 from public.knowledge_base_folders f
     where f.id = p_folder_id and f.user_id = (select auth.uid()) and f.deleted_at is null
  ) then raise exception 'FOLDER_NOT_FOUND' using errcode = 'P0002'; end if;
  if p_group_id is not null and not exists (
    select 1 from public.folder_note_groups g
     where g.id = p_group_id and g.folder_id = p_folder_id
       and g.user_id = (select auth.uid()) and g.deleted_at is null
  ) then raise exception 'GROUP_NOT_FOUND' using errcode = 'P0002'; end if;
  if p_expected_updated_at is null then
    perform pg_advisory_xact_lock(hashtextextended(p_folder_id::text || ':' || coalesce(p_group_id::text, 'root'), 0));
    select coalesce(max(n.sort_order), -1) + 1 into saved_sort_order
      from public.notes n
     where n.user_id = (select auth.uid()) and n.deleted_at is null
       and n.folder_id = p_folder_id and n.group_id is not distinct from p_group_id;
    insert into public.notes (id, user_id, folder_id, group_id, title, content, is_pinned, sort_order)
    values (p_id, (select auth.uid()), p_folder_id, p_group_id, p_title, p_content, p_is_pinned, saved_sort_order)
    on conflict (id) do nothing returning public.notes.updated_at, public.notes.sort_order
      into saved_at, saved_sort_order;
  else
    update public.notes as n
       set folder_id = p_folder_id, group_id = p_group_id, title = p_title,
           content = p_content, is_pinned = p_is_pinned, sort_order = p_sort_order
     where n.id = p_id and n.user_id = (select auth.uid()) and n.deleted_at is null
       and date_trunc('milliseconds', n.updated_at) = date_trunc('milliseconds', p_expected_updated_at)
     returning n.updated_at, n.sort_order into saved_at, saved_sort_order;
  end if;
  if saved_at is null then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
  return query select saved_at, saved_sort_order;
end;
$$;

