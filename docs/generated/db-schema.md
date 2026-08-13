# Live database snapshot

Verified against Supabase project `workbuddy` (`cdrdmkojduynctaoymjl`) on 2026-08-14. PostgreSQL 17, `ap-northeast-1`.

## Application tables

`knowledge_bases`, `knowledge_base_folders`, `folder_note_groups`, `notes`, `knowledge_base_templates`, `habits`, `habit_checkins`, `daily_reviews`, `time_management_tasks`, and `focus_sessions` are user-owned public tables with RLS enabled.

## Realtime model

Migration `20260814010000_replace_postgres_changes_with_private_broadcast.sql` removes application tables from `supabase_realtime`. Each application table uses an `AFTER INSERT OR UPDATE OR DELETE` trigger to call `realtime.send` on `user:<user_id>:sync`. The private-channel `realtime.messages` policy limits receipt to the matching authenticated user.

The payload is `{ table, operation, id, folder_id, previous_folder_id }`; it deliberately excludes note bodies. The application refetches using normal RLS-protected queries.

## Timestamp ownership and optimistic concurrency

`created_at` defaults to `now()` and `updated_at` is maintained by the database's `BEFORE UPDATE` trigger. Client write payloads never set either field. Versioned write RPCs accept only the last database `updated_at` as `p_expected_updated_at`; successful writes return the database-generated `updated_at`, while stale writes raise `VERSION_CONFLICT`.

`deleted_at` is assigned inside soft-delete RPCs. `completed_at` is assigned or cleared by the task RPC as `completed` transitions. Focus-session `started_at` and terminal `ended_at` are assigned by focus RPCs. New lists, note groups, and notes receive an initial `sort_order` from their save RPC; PostgreSQL transaction advisory locks serialize concurrent creation within the relevant parent scope.
