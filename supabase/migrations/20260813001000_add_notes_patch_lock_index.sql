-- Add index to support the patchNote optimistic-lock WHERE clause:
--   WHERE id = $1 AND updated_at = $2
-- Without this, the UPDATE falls back to a sequential scan on the notes table.
create index if not exists notes_id_updated_at_idx
  on public.notes (id, updated_at)
  where deleted_at is null;
