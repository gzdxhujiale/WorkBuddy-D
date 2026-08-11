-- Transactional ordering and controlled hard deletion.  Functions keep RLS.
create or replace function public.reorder_notes(p_items jsonb)
returns void language plpgsql security invoker set search_path = public as $$
begin
  update public.notes n set sort_order = x.sort_order, updated_at = now()
  from jsonb_to_recordset(p_items) as x(id uuid, sort_order integer)
  where n.id = x.id and n.user_id = auth.uid() and n.deleted_at is null;
end; $$;

create or replace function public.reorder_knowledge_base_folders(p_items jsonb)
returns void language plpgsql security invoker set search_path = public as $$
begin
  update public.knowledge_base_folders f set sort_order = x.sort_order, updated_at = now()
  from jsonb_to_recordset(p_items) as x(id uuid, sort_order integer)
  where f.id = x.id and f.user_id = auth.uid() and f.deleted_at is null;
end; $$;

create or replace function public.reorder_knowledge_bases(p_items jsonb)
returns void language plpgsql security invoker set search_path = public as $$
begin
  update public.knowledge_bases b set sort_order = x.sort_order, updated_at = now()
  from jsonb_to_recordset(p_items) as x(id uuid, sort_order integer)
  where b.id = x.id and b.user_id = auth.uid() and b.deleted_at is null;
end; $$;

create or replace function public.delete_daily_review(p_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
begin
  delete from public.daily_reviews where id = p_id and user_id = auth.uid();
end; $$;

do $$ begin
  alter publication supabase_realtime add table public.knowledge_bases;
  alter publication supabase_realtime add table public.knowledge_base_folders;
  alter publication supabase_realtime add table public.folder_note_groups;
  alter publication supabase_realtime add table public.notes;
exception when duplicate_object then null;
end $$;
