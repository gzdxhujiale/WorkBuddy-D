-- Assign ownership inside every create RPC. Clients never provide user_id;
-- the database derives it from the authenticated JWT so RLS remains effective.

create or replace function public.save_time_management_task(
  p_id uuid, p_title text, p_quadrant text, p_schedule_mode text,
  p_scheduled_start_at timestamptz, p_scheduled_end_at timestamptz,
  p_completed boolean, p_completed_at timestamptz, p_description text,
  p_reminder jsonb, p_created_at timestamptz,
  p_expected_updated_at timestamptz, p_next_updated_at timestamptz
) returns timestamptz language plpgsql security invoker set search_path=pg_catalog,public as $$
declare saved_at timestamptz;
begin
  if p_expected_updated_at is null then
    insert into public.time_management_tasks
      (id,user_id,title,quadrant,schedule_mode,scheduled_start_at,scheduled_end_at,completed,completed_at,description,reminder,created_at,updated_at)
    values
      (p_id,(select auth.uid()),p_title,p_quadrant,p_schedule_mode,p_scheduled_start_at,p_scheduled_end_at,p_completed,p_completed_at,p_description,p_reminder,p_created_at,p_next_updated_at)
    on conflict (id) do nothing returning updated_at into saved_at;
  else
    update public.time_management_tasks
       set title=p_title,quadrant=p_quadrant,schedule_mode=p_schedule_mode,
           scheduled_start_at=p_scheduled_start_at,scheduled_end_at=p_scheduled_end_at,
           completed=p_completed,completed_at=p_completed_at,description=p_description,
           reminder=p_reminder,updated_at=p_next_updated_at
     where id=p_id and user_id=(select auth.uid()) and deleted_at is null
       and date_trunc('milliseconds',updated_at)=date_trunc('milliseconds',p_expected_updated_at)
     returning updated_at into saved_at;
  end if;
  if saved_at is null then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
  return saved_at;
end; $$;

create or replace function public.save_daily_review(
  p_id uuid,p_date date,p_content jsonb,p_created_at timestamptz,
  p_expected_updated_at timestamptz,p_next_updated_at timestamptz
) returns timestamptz language plpgsql security invoker set search_path=pg_catalog,public as $$
declare saved_at timestamptz;
begin
  if p_expected_updated_at is null then
    insert into public.daily_reviews(id,user_id,date,content,created_at,updated_at)
    values(p_id,(select auth.uid()),p_date,p_content,p_created_at,p_next_updated_at)
    on conflict(user_id,date) do nothing returning updated_at into saved_at;
  else
    update public.daily_reviews set content=p_content,updated_at=p_next_updated_at
     where id=p_id and user_id=(select auth.uid())
       and date_trunc('milliseconds',updated_at)=date_trunc('milliseconds',p_expected_updated_at)
     returning updated_at into saved_at;
  end if;
  if saved_at is null then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
  return saved_at;
end; $$;

create or replace function public.save_habit(
  p_id uuid,p_name text,p_frequency_type text,p_frequency_days integer[],p_goal text,
  p_start_date date,p_duration text,p_category text,p_reminder text,p_auto_popup_log boolean,
  p_sort_order integer,p_created_at timestamptz,p_expected_updated_at timestamptz,p_next_updated_at timestamptz
) returns timestamptz language plpgsql security invoker set search_path=pg_catalog,public as $$
declare saved_at timestamptz;
begin
  if p_expected_updated_at is null then
    insert into public.habits(id,user_id,name,frequency_type,frequency_days,goal,start_date,duration,category,reminder,auto_popup_log,sort_order,created_at,updated_at)
    values(p_id,(select auth.uid()),p_name,p_frequency_type,p_frequency_days,p_goal,p_start_date,p_duration,p_category,p_reminder,p_auto_popup_log,p_sort_order,p_created_at,p_next_updated_at)
    on conflict(id) do nothing returning updated_at into saved_at;
  else
    update public.habits set name=p_name,frequency_type=p_frequency_type,frequency_days=p_frequency_days,goal=p_goal,start_date=p_start_date,duration=p_duration,category=p_category,reminder=p_reminder,auto_popup_log=p_auto_popup_log,sort_order=p_sort_order,updated_at=p_next_updated_at
     where id=p_id and user_id=(select auth.uid()) and deleted_at is null and date_trunc('milliseconds',updated_at)=date_trunc('milliseconds',p_expected_updated_at)
     returning updated_at into saved_at;
  end if;
  if saved_at is null then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
  return saved_at;
end; $$;

create or replace function public.save_note(
  p_id uuid,p_folder_id uuid,p_group_id uuid,p_title text,p_content text,p_is_pinned boolean,
  p_sort_order integer,p_created_at timestamptz,p_expected_updated_at timestamptz,p_next_updated_at timestamptz
) returns timestamptz language plpgsql security invoker set search_path=pg_catalog,public as $$
declare saved_at timestamptz;
begin
  if not exists (
    select 1 from public.knowledge_base_folders f
     where f.id=p_folder_id and f.user_id=(select auth.uid()) and f.deleted_at is null
  ) then raise exception 'FOLDER_NOT_FOUND' using errcode='P0002'; end if;
  if p_group_id is not null and not exists (
    select 1 from public.folder_note_groups g
     where g.id=p_group_id and g.folder_id=p_folder_id and g.user_id=(select auth.uid()) and g.deleted_at is null
  ) then raise exception 'GROUP_NOT_FOUND' using errcode='P0002'; end if;

  if p_expected_updated_at is null then
    insert into public.notes(id,user_id,folder_id,group_id,title,content,is_pinned,sort_order,created_at,updated_at)
    values(p_id,(select auth.uid()),p_folder_id,p_group_id,p_title,p_content,p_is_pinned,p_sort_order,p_created_at,p_next_updated_at)
    on conflict(id) do nothing returning updated_at into saved_at;
  else
    update public.notes set folder_id=p_folder_id,group_id=p_group_id,title=p_title,content=p_content,is_pinned=p_is_pinned,sort_order=p_sort_order,updated_at=p_next_updated_at
     where id=p_id and user_id=(select auth.uid()) and deleted_at is null and date_trunc('milliseconds',updated_at)=date_trunc('milliseconds',p_expected_updated_at)
     returning updated_at into saved_at;
  end if;
  if saved_at is null then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
  return saved_at;
end; $$;

-- Required by the existing PostgREST upsert target in habitService.
alter table public.habit_checkins
  add constraint habit_checkins_user_habit_date_key unique (user_id, habit_id, date);
