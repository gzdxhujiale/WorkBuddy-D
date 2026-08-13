# Architecture

WorkBuddy-D separates React presentation, data orchestration, Supabase persistence, and Tauri desktop integration.

```text
Routes/pages -> feature components/hooks -> services/lib
                                      -> Supabase Auth + PostgREST/RPC + Broadcast
                                      -> Tauri window/notification/tray APIs
Migrations -> PostgreSQL schema + RLS + indexes + triggers + RPCs
```

## Data model and loading

TanStack Query owns server state, Zustand owns UI-only state. The knowledge module deliberately loads `knowledge_bases` and `knowledge_base_folders` as its shell, then loads groups/note metadata per selected list and note bodies only on demand. Writes are optimistic, debounced where appropriate, and queue retryable network failures. Audit timestamps, soft-delete times, task-completion times, and focus-session start/end times are server-owned. Clients submit only the previously-read `updated_at` for optimistic locking, then replace their cache version with the timestamp returned by the database. New lists, groups, and notes receive their initial `sort_order` atomically inside database RPCs.

## Realtime

The main window owns one private `user:<id>:sync` Broadcast channel. Database `AFTER` triggers emit only table, operation, entity id, and folder context after committed writes. The client translates those hints into precise Query Key invalidations and refetches the RLS-protected source of truth.
