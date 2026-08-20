# Live database snapshot

**Verified against:** Supabase project `workbuddy` (`cdrdmkojduynctaoymjl`)

**Verified on:** 2026-08-16
**Platform:** PostgreSQL 17, `ap-northeast-1`

This is a compact live-state reference, not a replacement for migration SQL. Read [generated-artifact rules](index.md) before refreshing it.

## Scope and authority

| Question | Source to trust |
| --- | --- |
| What was installed and observed on the verification date? | This snapshot. |
| What database behavior is proposed and versioned in the repository? | `supabase/migrations/`. |
| Exact current columns, policies, functions, grants, indexes, and triggers after later work? | A new verified live inspection plus the applied migration history. |
| Frontend mapping and loading behavior? | `src/services/`, `src/hooks/`, and [Frontend](/FRONTEND). |

This snapshot does not prove Supabase Dashboard-only settings, such as the global public-channel toggle, or whether every subsequently committed migration has already been applied.

## Application tables

All listed tables are user-owned `public` tables with RLS enabled.

| Domain | Tables | Lifecycle notes |
| --- | --- | --- |
| Knowledge | `knowledge_bases`, `knowledge_base_folders`, `folder_note_groups`, `notes`, `knowledge_base_templates` | Knowledge bases/folders/groups/notes/templates use `deleted_at` soft deletion. Note bodies are intentionally excluded from Realtime payloads. |
| Habits | `habits`, `habit_checkins` | Habit definitions and dated check-ins are user-scoped. |
| Daily review | `daily_reviews` | One review is keyed by user/date; deletion is physical through `delete_daily_review`, allowing a fresh record for that date. |
| Tasks | `time_management_tasks` | Completion state is coupled to database-owned `completed_at`. |
| Project center | `projects`, `project_stages`, `project_templates` | Projects are lifecycle containers; their tasks remain rows in `time_management_tasks`. |
| Focus | `focus_sessions` | Session start and terminal end timestamps are assigned by focus RPCs. |

## Field reference

The tables below reproduce the verified application contract. `src/types/database.ts` is a frontend mapping aid, not a fully generated Supabase schema type; use a live schema inspection and the applied migration history to refresh this section.

### Common fields

| Fields | Present on | Meaning |
| --- | --- | --- |
| `id uuid` | All application tables | Application record identifier. |
| `user_id uuid` | All application tables | Authenticated owner; the RLS ownership key. |
| `created_at timestamptz`, `updated_at timestamptz` | All application tables | Database-owned audit timestamps. |
| `deleted_at timestamptz nullable` | Knowledge tables, `habits`, `habit_checkins`, `time_management_tasks` | Soft-deletion marker. It is absent from `daily_reviews` and `focus_sessions`. |

### Knowledge

#### `knowledge_bases`

| Field | Type | Meaning |
| --- | --- | --- |
| `name` | `text` | User-visible knowledge-base name. |
| `sort_order` | `integer` | Display order among active bases. |

#### `knowledge_base_folders`

These rows are the lists/containers displayed inside a knowledge base; older code and documents may call them “lists”.

| Field | Type | Meaning |
| --- | --- | --- |
| `knowledge_base_id` | `uuid nullable` | Optional parent `knowledge_bases.id`; `null` represents the root scope. |
| `name` | `text` | Container name. |
| `sort_order` | `integer` | Display order within the parent scope. |

#### `folder_note_groups`

| Field | Type | Meaning |
| --- | --- | --- |
| `folder_id` | `uuid` | Owning `knowledge_base_folders.id`. |
| `name` | `text` | Group name inside the container. |
| `sort_order` | `integer` | Group display order. |

#### `notes`

| Field | Type | Meaning |
| --- | --- | --- |
| `folder_id` | `uuid` | Owning `knowledge_base_folders.id`. |
| `group_id` | `uuid nullable` | Optional `folder_note_groups.id`. |
| `title` | `text` | Note title. |
| `content` | `text` | Tiptap JSON content. The application deliberately fetches it on demand. |
| `sort_order` | `integer` | Display order within the group/root scope. |
| `lock_version` | `bigint` | Monotonic optimistic-concurrency token on notes and every independently editable user entity. |

#### `knowledge_base_templates`

| Field | Type | Meaning |
| --- | --- | --- |
| `name` | `text` | Template name. |
| `content` | `jsonb` | Template payload. The frontend stores/loads structured content. |

### Habits

#### `habits`

| Field | Type | Meaning |
| --- | --- | --- |
| `name` | `text` | Habit name. |
| `frequency_type` | `text` | Schedule mode: `daily`, `weekly_days`, or `custom`. |
| `goal` | `text nullable` | Optional goal text. |
| `start_date` | `date nullable` | Optional start date. |
| `duration` | `text nullable` | Optional duration description. |
| `category` | `text nullable` | Optional category. |
| `reminder` | `text nullable` | Optional reminder value. |
| `auto_popup_log` | `boolean` | Whether the logging UI opens automatically. |
| `sort_order` | `integer` | Display order. |

#### `habit_checkins`

| Field | Type | Meaning |
| --- | --- | --- |
| `habit_id` | `uuid` | Owning `habits.id`. |
| `date` | `date` | Check-in date. |
| `completed` | `boolean` | Check-in state. |

The supported save RPC uses `(user_id, habit_id, date)` as the upsert identity, so one user has one check-in state per habit/date.

### Daily review

#### `daily_reviews`

| Field | Type | Meaning |
| --- | --- | --- |
| `date` | `date` | Review date. |
| `content` | `jsonb` | Structured review payload; the frontend maps its text field for editing. |

`(user_id, date)` is the review identity. Reviews are physically deleted through `delete_daily_review`; a new review for that user/date can then be created.

### Tasks

#### `time_management_tasks`

| Field | Type | Meaning |
| --- | --- | --- |
| `title` | `text` | Task title. |
| `quadrant` | `text` | Eisenhower quadrant: `Q1_URGENT_IMPORTANT`, `Q2_NOT_URGENT_IMPORTANT`, `Q3_URGENT_NOT_IMPORTANT`, or `Q4_NOT_URGENT_NOT_IMPORTANT`. |
| `schedule_mode` | `text nullable` | `point`, `range`, or no schedule. |
| `scheduled_start_at` | `timestamptz nullable` | Range start time. |
| `scheduled_end_at` | `timestamptz nullable` | Point deadline or range end time. |
| `completed` | `boolean` | Completion state. |
| `completed_at` | `timestamptz nullable` | Database-owned completion transition time. |
| `description` | `text nullable` | Optional task detail. |
| `reminder` | `jsonb nullable` | Structured reminder configuration. |
| `project_id` | `uuid nullable` | Optional single owning `projects.id`; a task cannot belong to more than one project. |
| `project_stage_id` | `uuid nullable` | Optional stage inside its owning project. |
| `priority` | `text` | `low`, `medium`, `high`, or `urgent`. |
| `assignee_name` | `text nullable` | Task-level responsible person, which may override the stage default. |
| `sort_order` | `integer` | Explicit display order within a quadrant. Creation and manual reordering are database-owned; it is never derived from or written through `created_at`. |

### Project center

#### `projects`

| Field | Type | Meaning |
| --- | --- | --- |
| `name`, `description` | `text`, `text nullable` | Project identity and optional explanation. |
| `status` | `text` | Lifecycle state: `not_started`, `in_progress`, `completed`, or `archived`; creation begins at `not_started`. |
| `start_date`, `end_date` | `date nullable`, `date nullable` | Optional project time range; when both are present, the start cannot be after the end. |
| `priority` | `text` | `low`, `medium`, `high`, or `urgent`. |
| `tags` | `text[]` | User-defined project labels. |
| `owner_name` | `text nullable` | Project-level responsible person. |

The database refuses a transition to `completed` while an active project task remains incomplete.

#### `project_stages`

| Field | Type | Meaning |
| --- | --- | --- |
| `project_id` | `uuid` | Owning project. |
| `name` | `text` | Ordered workflow stage, such as requirement review or testing. |
| `default_assignee_name` | `text nullable` | Default owner used when adding a task to the stage. |
| `sort_order` | `integer` | Stage ordering within the project. |
| `template_key` | `text nullable` | Stable template-stage key used while generating a project. |
| `start_date`, `end_date` | `date nullable`, `date nullable` | Optional stage time range; when both are present, the start cannot be after the end. |

#### `project_templates`

| Field | Type | Meaning |
| --- | --- | --- |
| `name`, `description` | `text`, `text nullable` | Reusable template identity and explanation. |
| `definition` | `jsonb` | Stages, stage-owner rules, and task blueprints to generate. |
| `deleted_at` | `timestamptz nullable` | Soft-deletion marker; active template reads exclude it. |

Template-generated tasks always start incomplete and do not copy concrete task dates.

### Focus

#### `focus_sessions`

| Field | Type | Meaning |
| --- | --- | --- |
| `cycle_id` | `uuid` | Client-provided cycle identifier. |
| `task_id` | `uuid nullable` | Optional `time_management_tasks.id`; clearing/deleting a task sets this relation to `null`. |
| `type` | `text` | `focus` or `rest`. |
| `status` | `text` | `running`, `paused`, `completed`, or `interrupted`. |
| `planned_minutes` | `smallint` | Planned session duration, constrained from 1 through 180. |
| `active_seconds` | `integer` | Recorded active duration; non-negative. |
| `rest_completed` | `boolean` | Whether associated rest was completed. |
| `started_at` | `timestamptz` | Database-assigned session start. |
| `ended_at` | `timestamptz nullable` | Database-assigned terminal end for completed/interrupted sessions. |

## Access and mutation model

RLS scopes rows to the authenticated `user_id`. Application RPCs are granted to `authenticated`; client roles do not execute application trigger functions directly. Database writes use constrained RPCs for stateful operations such as saving, soft deleting, ordering, moving, and session transitions.

The exact policy and function signatures should be read from the latest applied migrations. In particular, do not treat `TO authenticated` by itself as an ownership policy; access must remain tied to the row owner.

## Realtime model

Migration `20260814010000_replace_postgres_changes_with_private_broadcast.sql` removes application tables from `supabase_realtime`. Each application table, including Project Center tables, uses an `AFTER INSERT OR UPDATE OR DELETE` trigger to call `realtime.send` on the private topic `user:<user_id>:sync`. The `realtime.messages` receive policy limits the topic to the matching authenticated user.

The payload is:

```text
{ table, operation, id, folder_id, previous_folder_id }
```

It deliberately excludes note bodies and complete row values. The main client converts the hint into a narrow Query-key invalidation and refetches with ordinary RLS-protected queries. See [the synchronization decision](/design-docs/sync-and-editor-consistency) for constraints.

## Timestamp ownership, locking, and ordering

`created_at` defaults to `now()` and `updated_at` is maintained by a database `BEFORE UPDATE` trigger. Client write payloads never set either field. Notes and all independently editable user entities maintain a monotonic `lock_version` in a `BEFORE UPDATE` trigger; V2 save RPCs and V3 structural-mutation RPCs pass it as `p_expected_lock_version` (or per-row order items), return the new value where applicable, and raise `VERSION_CONFLICT` for stale writes. `habit_checkins` remain idempotent state facts and focus sessions remain state-machine operations.

`deleted_at` is assigned by soft-delete RPCs. `completed_at` is assigned or cleared as task completion changes. Focus-session `started_at` and terminal `ended_at` are assigned by focus RPCs. New list/group/note ordering is assigned by save RPCs using transaction advisory locks within the relevant parent scope. Tasks likewise receive an initial `sort_order` from `save_time_management_task_v2`; `reorder_time_management_tasks_v3` validates all supplied versions and commits a drag order atomically. `move_and_reorder_notes_v3` and `move_and_reorder_knowledge_base_folders_v3` lock source and destination scopes, validate the complete versioned destination order, then compact the source scope in the same transaction. `duplicate_knowledge_base_folder_v3` atomically copies an owned folder, its groups, and full note bodies under `security invoker` + RLS.

The checked-in migration `20260814040000_fix_save_note_updated_at_ambiguity.sql` clarifies the `save_note` return-column reference. Verify applied migration history before asserting that this repository fix is present in a live environment.

## Refresh checklist

When the database changes or this snapshot is refreshed:

1. Inspect the connected project’s installed schema, policies, functions, grants, triggers, and relevant Realtime configuration.
2. Compare live migration history with `supabase/migrations/`; record any drift rather than rewriting history.
3. Update the verification metadata and only the facts confirmed by that inspection.
4. Check whether architecture, security, reliability, or a design decision needs a separate durable update.
5. Verify frontend queries/RPC mappings against the refreshed facts and run the applicable build.
