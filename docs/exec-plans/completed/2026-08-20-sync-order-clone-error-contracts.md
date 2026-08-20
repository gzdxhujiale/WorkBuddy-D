# Synchronization, task ordering, atomic folder clone, and visible errors

Status: completed on 2026-08-20.

## Objective

Implement the agreed sequence: make optimistic-write pending state entity-owned, persist quadrant ordering in PostgreSQL, clone knowledge folders atomically, and surface failures instead of masking them.

## Constraints

- Migrations are append-only and RPCs run as `security invoker` under existing user-owned RLS policies.
- A Broadcast is only an invalidation hint; it must not replace authoritative refetches.
- Task creation timestamps remain audit facts and are never used as a manual sort mechanism.
- Clone results come from one committed database transaction; the client never reconstructs the clone from a partial cache.
- A failed write must reconcile cached optimistic state by refetching and give the user a visible error.

## Steps

1. Replace query-wide pending counters with stable per-hook/per-entity pending tokens; retain one dirty payload per SyncKey and release the token only after its final write settles.
2. Add `time_management_tasks.sort_order`, backfill it, assign it transactionally on task creation, and add a versioned atomic reorder RPC. Update task reads and drag-and-drop to use it.
3. Add an authenticated `security invoker` clone RPC that copies one folder, all groups, and full note bodies in one transaction. Replace the client loop with that RPC result.
4. Add a global render Error Boundary and visible error feedback for failed asynchronous persistence and exports.
5. Verify migration grants/security, database behavior, TypeScript/Vite build, and the relevant documentation build.

## Rollout and verification

- Existing tasks receive deterministic order derived from their historical `created_at`; new tasks receive a database-assigned trailing order.
- The reorder RPC validates every supplied lock version before changing any order, so a conflict changes no rows.
- The clone RPC verifies source ownership through RLS and returns only the newly inserted folder.
- Manual checks: repeated typing while another window is open, reorder within a date group, clone a folder with grouped and ungrouped full-content notes, simulate a failed write/export.

## Completion evidence

- Applied migrations `20260820030000_task_sort_order` and `20260820040000_atomic_knowledge_folder_clone` to Supabase project `cdrdmkojduynctaoymjl`.
- Verified both new RPCs are `security invoker`, executable by `authenticated`, and not executable by `anon`.
- `pnpm build` and `pnpm docs:build` completed successfully after the implementation.
