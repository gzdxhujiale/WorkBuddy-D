-- Notes use an integer lock version rather than a timestamp rounded for a
-- JavaScript Date. `updated_at` remains an audit field; `lock_version` is the
-- authoritative optimistic-concurrency token returned to clients.

alter table public.notes
  add column if not exists lock_version bigint not null default 1
  check (lock_version > 0);

create or replace function public.bump_note_lock_version()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  new.lock_version := old.lock_version + 1;
  return new;
end;
$$;

drop trigger if exists notes_bump_lock_version on public.notes;
create trigger notes_bump_lock_version
before update on public.notes
for each row execute function public.bump_note_lock_version();

create or replace function public.save_note_v2(
  p_id uuid,
  p_folder_id uuid,
  p_group_id uuid,
  p_title text,
  p_content text,
  p_sort_order integer,
  p_expected_lock_version bigint
)
returns table(updated_at timestamptz, lock_version bigint, sort_order integer)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  saved_at timestamptz;
  saved_version bigint;
  saved_sort_order integer;
begin
  if not exists (
    select 1 from public.knowledge_base_folders f
    where f.id = p_folder_id
      and f.user_id = (select auth.uid())
      and f.deleted_at is null
  ) then
    raise exception 'FOLDER_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_group_id is not null and not exists (
    select 1 from public.folder_note_groups g
    where g.id = p_group_id
      and g.folder_id = p_folder_id
      and g.user_id = (select auth.uid())
      and g.deleted_at is null
  ) then
    raise exception 'GROUP_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_expected_lock_version is null then
    perform pg_advisory_xact_lock(
      hashtextextended(p_folder_id::text || ':' || coalesce(p_group_id::text, 'root'), 0)
    );
    select coalesce(max(n.sort_order), -1) + 1
      into saved_sort_order
      from public.notes n
     where n.user_id = (select auth.uid())
       and n.deleted_at is null
       and n.folder_id = p_folder_id
       and n.group_id is not distinct from p_group_id;

    insert into public.notes (id, user_id, folder_id, group_id, title, content, sort_order)
    values (p_id, (select auth.uid()), p_folder_id, p_group_id, p_title, p_content, saved_sort_order)
    on conflict (id) do nothing
    returning public.notes.updated_at, public.notes.lock_version, public.notes.sort_order
      into saved_at, saved_version, saved_sort_order;
  else
    update public.notes n
       set folder_id = p_folder_id,
           group_id = p_group_id,
           title = p_title,
           content = p_content,
           sort_order = p_sort_order
     where n.id = p_id
       and n.user_id = (select auth.uid())
       and n.deleted_at is null
       and n.lock_version = p_expected_lock_version
    returning n.updated_at, n.lock_version, n.sort_order
      into saved_at, saved_version, saved_sort_order;
  end if;

  if saved_at is null then
    raise exception 'VERSION_CONFLICT' using errcode = '40001';
  end if;

  return query select saved_at, saved_version, saved_sort_order;
end;
$$;

create or replace function public.patch_note_v2(
  p_id uuid,
  p_expected_lock_version bigint,
  p_title text default null,
  p_content text default null,
  p_sort_order integer default null,
  p_folder_id uuid default null,
  p_group_id uuid default null,
  p_set_group boolean default false
)
returns table(updated_at timestamptz, lock_version bigint)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  saved_at timestamptz;
  saved_version bigint;
begin
  update public.notes n
     set title = coalesce(p_title, n.title),
         content = coalesce(p_content, n.content),
         sort_order = coalesce(p_sort_order, n.sort_order),
         folder_id = coalesce(p_folder_id, n.folder_id),
         group_id = case when p_set_group then p_group_id else n.group_id end
   where n.id = p_id
     and n.user_id = (select auth.uid())
     and n.deleted_at is null
     and n.lock_version = p_expected_lock_version
  returning n.updated_at, n.lock_version into saved_at, saved_version;

  if saved_at is null then
    raise exception 'VERSION_CONFLICT' using errcode = '40001';
  end if;

  return query select saved_at, saved_version;
end;
$$;

create or replace function public.move_note_v2(
  p_id uuid,
  p_folder_id uuid,
  p_group_id uuid,
  p_sort_order integer,
  p_expected_lock_version bigint
)
returns table(updated_at timestamptz, lock_version bigint)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  saved_at timestamptz;
  saved_version bigint;
begin
  if not exists (
    select 1 from public.knowledge_base_folders f
    where f.id = p_folder_id
      and f.user_id = (select auth.uid())
      and f.deleted_at is null
  ) then
    raise exception 'FOLDER_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_group_id is not null and not exists (
    select 1 from public.folder_note_groups g
    where g.id = p_group_id
      and g.folder_id = p_folder_id
      and g.user_id = (select auth.uid())
      and g.deleted_at is null
  ) then
    raise exception 'GROUP_NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.notes n
     set folder_id = p_folder_id,
         group_id = p_group_id,
         sort_order = p_sort_order
   where n.id = p_id
     and n.user_id = (select auth.uid())
     and n.deleted_at is null
     and n.lock_version = p_expected_lock_version
  returning n.updated_at, n.lock_version into saved_at, saved_version;

  if saved_at is null then
    raise exception 'VERSION_CONFLICT' using errcode = '40001';
  end if;

  return query select saved_at, saved_version;
end;
$$;

create or replace function public.reorder_notes_v2(p_items jsonb)
returns table(id uuid, updated_at timestamptz, lock_version bigint)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  return query
    update public.notes n
       set sort_order = item.sort_order
      from jsonb_to_recordset(p_items) as item(id uuid, sort_order integer)
     where n.id = item.id
       and n.user_id = (select auth.uid())
       and n.deleted_at is null
    returning n.id, n.updated_at, n.lock_version;
end;
$$;

revoke all on function public.bump_note_lock_version() from public, anon, authenticated;
revoke all on function public.save_note_v2(uuid, uuid, uuid, text, text, integer, bigint) from public, anon;
revoke all on function public.patch_note_v2(uuid, bigint, text, text, integer, uuid, uuid, boolean) from public, anon;
revoke all on function public.move_note_v2(uuid, uuid, uuid, integer, bigint) from public, anon;
revoke all on function public.reorder_notes_v2(jsonb) from public, anon;

grant execute on function public.save_note_v2(uuid, uuid, uuid, text, text, integer, bigint) to authenticated;
grant execute on function public.patch_note_v2(uuid, bigint, text, text, integer, uuid, uuid, boolean) to authenticated;
grant execute on function public.move_note_v2(uuid, uuid, uuid, integer, bigint) to authenticated;
grant execute on function public.reorder_notes_v2(jsonb) to authenticated;
