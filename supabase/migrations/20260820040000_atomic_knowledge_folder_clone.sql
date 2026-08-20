-- Clone a knowledge folder from authoritative rows in one transaction.  The
-- client must never rebuild a clone from a partially loaded shell cache.

create function public.duplicate_knowledge_base_folder_v3(
  p_source_id uuid,
  p_new_name text
) returns table(
  id uuid,
  knowledge_base_id uuid,
  name text,
  sort_order integer,
  lock_version bigint
)
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare
  source_folder public.knowledge_base_folders%rowtype;
  source_group public.folder_note_groups%rowtype;
  cloned_folder_id uuid;
  cloned_group_id uuid;
  assigned_sort_order integer;
begin
  if nullif(btrim(p_new_name), '') is null then
    raise exception 'INVALID_FOLDER_NAME' using errcode = '22023';
  end if;

  select * into source_folder
  from public.knowledge_base_folders folder
  where folder.id = p_source_id
    and folder.user_id = (select auth.uid())
    and folder.deleted_at is null;
  if not found then
    raise exception 'FOLDER_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(coalesce(source_folder.knowledge_base_id::text, 'root'), 0)
  );
  select coalesce(max(folder.sort_order), -1) + 1 into assigned_sort_order
  from public.knowledge_base_folders folder
  where folder.user_id = (select auth.uid())
    and folder.deleted_at is null
    and folder.knowledge_base_id is not distinct from source_folder.knowledge_base_id;

  insert into public.knowledge_base_folders (
    id, user_id, knowledge_base_id, name, sort_order
  ) values (
    gen_random_uuid(), (select auth.uid()), source_folder.knowledge_base_id,
    btrim(p_new_name), assigned_sort_order
  ) returning knowledge_base_folders.id into cloned_folder_id;

  for source_group in
    select * from public.folder_note_groups group_row
    where group_row.folder_id = source_folder.id
      and group_row.user_id = (select auth.uid())
      and group_row.deleted_at is null
    order by group_row.sort_order asc, group_row.id asc
  loop
    cloned_group_id := gen_random_uuid();
    insert into public.folder_note_groups (
      id, user_id, folder_id, name, sort_order
    ) values (
      cloned_group_id, (select auth.uid()), cloned_folder_id,
      source_group.name, source_group.sort_order
    );

    insert into public.notes (
      id, user_id, folder_id, group_id, title, content, sort_order
    )
    select
      gen_random_uuid(), (select auth.uid()), cloned_folder_id, cloned_group_id,
      note.title, note.content, note.sort_order
    from public.notes note
    where note.folder_id = source_folder.id
      and note.group_id = source_group.id
      and note.user_id = (select auth.uid())
      and note.deleted_at is null
    order by note.sort_order asc, note.id asc;
  end loop;

  insert into public.notes (
    id, user_id, folder_id, group_id, title, content, sort_order
  )
  select
    gen_random_uuid(), (select auth.uid()), cloned_folder_id, null,
    note.title, note.content, note.sort_order
  from public.notes note
  where note.folder_id = source_folder.id
    and note.group_id is null
    and note.user_id = (select auth.uid())
    and note.deleted_at is null
  order by note.sort_order asc, note.id asc;

  return query
  select folder.id, folder.knowledge_base_id, folder.name, folder.sort_order, folder.lock_version
  from public.knowledge_base_folders folder
  where folder.id = cloned_folder_id;
end;
$$;

revoke all on function public.duplicate_knowledge_base_folder_v3(uuid, text) from public, anon;
grant execute on function public.duplicate_knowledge_base_folder_v3(uuid, text) to authenticated;
