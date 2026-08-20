-- Keep both the source and destination scopes contiguous when a structural move
-- crosses containers. This replaces the just-added V3 implementations without
-- changing their RPC signatures.

create or replace function public.move_and_reorder_notes_v3(
  p_id uuid, p_folder_id uuid, p_group_id uuid, p_title text, p_content text,
  p_content_loaded boolean, p_expected_lock_version bigint, p_items jsonb default null
) returns table(id uuid, updated_at timestamptz, lock_version bigint, sort_order integer)
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare
  source_folder_id uuid; source_group_id uuid; source_scope text; target_scope text;
  assigned_sort_order integer; item_count integer; distinct_sort_count integer;
  min_sort_order integer; max_sort_order integer; updated_item_count integer;
begin
  select note.folder_id, note.group_id into source_folder_id, source_group_id
  from public.notes note
  where note.id = p_id and note.user_id = (select auth.uid())
    and note.deleted_at is null and note.lock_version = p_expected_lock_version;
  if not found then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;

  if not exists (
    select 1 from public.knowledge_base_folders folder
    where folder.id = p_folder_id and folder.user_id = (select auth.uid())
      and folder.deleted_at is null
  ) then raise exception 'FOLDER_NOT_FOUND' using errcode = 'P0002'; end if;
  if p_group_id is not null and not exists (
    select 1 from public.folder_note_groups group_row
    where group_row.id = p_group_id and group_row.folder_id = p_folder_id
      and group_row.user_id = (select auth.uid()) and group_row.deleted_at is null
  ) then raise exception 'GROUP_NOT_FOUND' using errcode = 'P0002'; end if;

  source_scope := source_folder_id::text || ':' || coalesce(source_group_id::text, 'root');
  target_scope := p_folder_id::text || ':' || coalesce(p_group_id::text, 'root');
  if source_scope <= target_scope then
    perform pg_advisory_xact_lock(hashtextextended(source_scope, 0));
    if source_scope <> target_scope then perform pg_advisory_xact_lock(hashtextextended(target_scope, 0)); end if;
  else
    perform pg_advisory_xact_lock(hashtextextended(target_scope, 0));
    perform pg_advisory_xact_lock(hashtextextended(source_scope, 0));
  end if;

  if p_items is null then
    if source_scope = target_scope then
      raise exception 'INVALID_NOTE_ORDER' using errcode = '22023';
    end if;
    select coalesce(max(note.sort_order), -1) + 1 into assigned_sort_order
    from public.notes note
    where note.user_id = (select auth.uid()) and note.deleted_at is null
      and note.folder_id = p_folder_id and note.group_id is not distinct from p_group_id
      and note.id <> p_id;
    return query
    update public.notes note set folder_id = p_folder_id, group_id = p_group_id,
      title = p_title, content = case when p_content_loaded then p_content else note.content end,
      sort_order = assigned_sort_order
    where note.id = p_id and note.user_id = (select auth.uid()) and note.deleted_at is null
      and note.lock_version = p_expected_lock_version
    returning note.id, note.updated_at, note.lock_version, note.sort_order;
    if not found then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
  else
    if jsonb_typeof(p_items) <> 'array' then raise exception 'INVALID_NOTE_ORDER' using errcode = '22023'; end if;
    select count(*), count(distinct item.sort_order), min(item.sort_order), max(item.sort_order)
      into item_count, distinct_sort_count, min_sort_order, max_sort_order
    from jsonb_to_recordset(p_items) as item(id uuid, sort_order integer, lock_version bigint);
    if item_count = 0 or distinct_sort_count <> item_count or min_sort_order <> 0
       or max_sort_order <> item_count - 1 then raise exception 'INVALID_NOTE_ORDER' using errcode = '22023'; end if;
    if exists (
      select 1 from jsonb_to_recordset(p_items) as item(id uuid, sort_order integer, lock_version bigint)
      group by item.id having count(*) > 1
    ) then raise exception 'DUPLICATE_NOTE_ORDER_ITEM' using errcode = '22023'; end if;
    if exists (
      select 1 from jsonb_to_recordset(p_items) as item(id uuid, sort_order integer, lock_version bigint)
      left join public.notes note on note.id = item.id
      where item.lock_version is null or item.sort_order is null or note.id is null
        or note.user_id <> (select auth.uid()) or note.deleted_at is not null
        or note.lock_version <> item.lock_version
    ) then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
    if exists (
      with supplied as (
        select item.id from jsonb_to_recordset(p_items) as item(id uuid, sort_order integer, lock_version bigint)
      ), target as (
        select note.id from public.notes note
        where note.user_id = (select auth.uid()) and note.deleted_at is null
          and note.folder_id = p_folder_id and note.group_id is not distinct from p_group_id and note.id <> p_id
        union all select p_id
      )
      select 1 where (select count(*) from supplied) <> (select count(*) from target)
        or exists (select 1 from target left join supplied using (id) where supplied.id is null)
        or exists (select 1 from supplied left join target using (id) where target.id is null)
    ) then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
    if not exists (
      select 1 from jsonb_to_recordset(p_items) as item(id uuid, sort_order integer, lock_version bigint)
      where item.id = p_id and item.lock_version = p_expected_lock_version
    ) then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
    return query
    update public.notes note set
      folder_id = case when note.id = p_id then p_folder_id else note.folder_id end,
      group_id = case when note.id = p_id then p_group_id else note.group_id end,
      title = case when note.id = p_id then p_title else note.title end,
      content = case when note.id = p_id and p_content_loaded then p_content else note.content end,
      sort_order = item.sort_order
    from jsonb_to_recordset(p_items) as item(id uuid, sort_order integer, lock_version bigint)
    where note.id = item.id and note.lock_version = item.lock_version
    returning note.id, note.updated_at, note.lock_version, note.sort_order;
    get diagnostics updated_item_count = row_count;
    if updated_item_count <> item_count then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
  end if;

  if source_scope <> target_scope then
    return query
    with source_order as (
      select note.id, row_number() over (order by note.sort_order, note.id) - 1 as sort_order
      from public.notes note
      where note.user_id = (select auth.uid()) and note.deleted_at is null
        and note.folder_id = source_folder_id and note.group_id is not distinct from source_group_id
    )
    update public.notes note set sort_order = source_order.sort_order
    from source_order
    where note.id = source_order.id and note.sort_order is distinct from source_order.sort_order
    returning note.id, note.updated_at, note.lock_version, note.sort_order;
  end if;
end;
$$;

create or replace function public.move_and_reorder_knowledge_base_folders_v3(
  p_id uuid, p_knowledge_base_id uuid, p_name text, p_expected_lock_version bigint,
  p_items jsonb default null
) returns table(id uuid, updated_at timestamptz, lock_version bigint, sort_order integer)
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare
  source_knowledge_base_id uuid; source_scope text; target_scope text;
  assigned_sort_order integer; item_count integer; distinct_sort_count integer;
  min_sort_order integer; max_sort_order integer; updated_item_count integer;
begin
  select folder.knowledge_base_id into source_knowledge_base_id
  from public.knowledge_base_folders folder
  where folder.id = p_id and folder.user_id = (select auth.uid())
    and folder.deleted_at is null and folder.lock_version = p_expected_lock_version;
  if not found then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
  if p_knowledge_base_id is not null and not exists (
    select 1 from public.knowledge_bases base
    where base.id = p_knowledge_base_id and base.user_id = (select auth.uid()) and base.deleted_at is null
  ) then raise exception 'KNOWLEDGE_BASE_NOT_FOUND' using errcode = 'P0002'; end if;

  source_scope := coalesce(source_knowledge_base_id::text, 'root');
  target_scope := coalesce(p_knowledge_base_id::text, 'root');
  if source_scope <= target_scope then
    perform pg_advisory_xact_lock(hashtextextended(source_scope, 0));
    if source_scope <> target_scope then perform pg_advisory_xact_lock(hashtextextended(target_scope, 0)); end if;
  else
    perform pg_advisory_xact_lock(hashtextextended(target_scope, 0));
    perform pg_advisory_xact_lock(hashtextextended(source_scope, 0));
  end if;

  if p_items is null then
    if source_scope = target_scope then raise exception 'INVALID_FOLDER_ORDER' using errcode = '22023'; end if;
    select coalesce(max(folder.sort_order), -1) + 1 into assigned_sort_order
    from public.knowledge_base_folders folder
    where folder.user_id = (select auth.uid()) and folder.deleted_at is null
      and folder.knowledge_base_id is not distinct from p_knowledge_base_id and folder.id <> p_id;
    return query
    update public.knowledge_base_folders folder set knowledge_base_id = p_knowledge_base_id,
      name = p_name, sort_order = assigned_sort_order
    where folder.id = p_id and folder.user_id = (select auth.uid()) and folder.deleted_at is null
      and folder.lock_version = p_expected_lock_version
    returning folder.id, folder.updated_at, folder.lock_version, folder.sort_order;
    if not found then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
  else
    if jsonb_typeof(p_items) <> 'array' then raise exception 'INVALID_FOLDER_ORDER' using errcode = '22023'; end if;
    select count(*), count(distinct item.sort_order), min(item.sort_order), max(item.sort_order)
      into item_count, distinct_sort_count, min_sort_order, max_sort_order
    from jsonb_to_recordset(p_items) as item(id uuid, sort_order integer, lock_version bigint);
    if item_count = 0 or distinct_sort_count <> item_count or min_sort_order <> 0
       or max_sort_order <> item_count - 1 then raise exception 'INVALID_FOLDER_ORDER' using errcode = '22023'; end if;
    if exists (
      select 1 from jsonb_to_recordset(p_items) as item(id uuid, sort_order integer, lock_version bigint)
      group by item.id having count(*) > 1
    ) then raise exception 'DUPLICATE_FOLDER_ORDER_ITEM' using errcode = '22023'; end if;
    if exists (
      select 1 from jsonb_to_recordset(p_items) as item(id uuid, sort_order integer, lock_version bigint)
      left join public.knowledge_base_folders folder on folder.id = item.id
      where item.lock_version is null or item.sort_order is null or folder.id is null
        or folder.user_id <> (select auth.uid()) or folder.deleted_at is not null
        or folder.lock_version <> item.lock_version
    ) then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
    if exists (
      with supplied as (
        select item.id from jsonb_to_recordset(p_items) as item(id uuid, sort_order integer, lock_version bigint)
      ), target as (
        select folder.id from public.knowledge_base_folders folder
        where folder.user_id = (select auth.uid()) and folder.deleted_at is null
          and folder.knowledge_base_id is not distinct from p_knowledge_base_id and folder.id <> p_id
        union all select p_id
      )
      select 1 where (select count(*) from supplied) <> (select count(*) from target)
        or exists (select 1 from target left join supplied using (id) where supplied.id is null)
        or exists (select 1 from supplied left join target using (id) where target.id is null)
    ) then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
    if not exists (
      select 1 from jsonb_to_recordset(p_items) as item(id uuid, sort_order integer, lock_version bigint)
      where item.id = p_id and item.lock_version = p_expected_lock_version
    ) then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
    return query
    update public.knowledge_base_folders folder set
      knowledge_base_id = case when folder.id = p_id then p_knowledge_base_id else folder.knowledge_base_id end,
      name = case when folder.id = p_id then p_name else folder.name end,
      sort_order = item.sort_order
    from jsonb_to_recordset(p_items) as item(id uuid, sort_order integer, lock_version bigint)
    where folder.id = item.id and folder.lock_version = item.lock_version
    returning folder.id, folder.updated_at, folder.lock_version, folder.sort_order;
    get diagnostics updated_item_count = row_count;
    if updated_item_count <> item_count then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
  end if;

  if source_scope <> target_scope then
    return query
    with source_order as (
      select folder.id, row_number() over (order by folder.sort_order, folder.id) - 1 as sort_order
      from public.knowledge_base_folders folder
      where folder.user_id = (select auth.uid()) and folder.deleted_at is null
        and folder.knowledge_base_id is not distinct from source_knowledge_base_id
    )
    update public.knowledge_base_folders folder set sort_order = source_order.sort_order
    from source_order
    where folder.id = source_order.id and folder.sort_order is distinct from source_order.sort_order
    returning folder.id, folder.updated_at, folder.lock_version, folder.sort_order;
  end if;
end;
$$;

revoke all on function public.move_and_reorder_notes_v3(uuid, uuid, uuid, text, text, boolean, bigint, jsonb) from public, anon;
revoke all on function public.move_and_reorder_knowledge_base_folders_v3(uuid, uuid, text, bigint, jsonb) from public, anon;
grant execute on function public.move_and_reorder_notes_v3(uuid, uuid, uuid, text, text, boolean, bigint, jsonb) to authenticated;
grant execute on function public.move_and_reorder_knowledge_base_folders_v3(uuid, uuid, text, bigint, jsonb) to authenticated;
