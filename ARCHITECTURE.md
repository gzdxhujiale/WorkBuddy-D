# Architecture

## Purpose

This is the system map for WorkBuddy-D. It describes stable boundaries and runtime flows; product behavior belongs in `docs/product-specs/`, implementation detail in the owning code, and database state in `docs/generated/db-schema.md` plus `supabase/migrations/`.

## System overview

WorkBuddy-D is a Tauri 2 desktop application with React webviews and a Supabase backend.

```text
Main / secondary Tauri webviews
  -> React pages and feature components
  -> hooks, services, and shared runtime
  -> Supabase Auth + PostgREST/RPC + private Broadcast

Tauri Rust runtime
  -> windows, tray, notifications, capabilities

Supabase migrations
  -> PostgreSQL tables, RLS, RPCs, indexes, and triggers
```

The frontend is the client of the database API. There is no repository-owned HTTP server, worker, queue, or deployment configuration.

## Repository topology

| Location | Responsibility |
| --- | --- |
| `src/pages/`, `src/components/` | Routes, feature UI, layout, dialogs, and Tauri-window UI. |
| `src/hooks/` | Query reads, optimistic cache updates, and debounced mutation orchestration. |
| `src/services/` | Domain mapping and Supabase reads/RPC writes. |
| `src/lib/` | Auth context, Supabase client, query keys, Realtime, offline queue, and synchronization utilities. |
| `src/stores/` | Zustand state for UI-only preferences and selection. |
| `src-tauri/` | Rust entry point, bundle/window configuration, tray, and capabilities. |
| `supabase/migrations/` | Append-only schema and database behavior history. |
| `docs/` | Product, design, engineering contracts, plans, and generated database reference. |

## Product domains

The shipped application surface is organized around these domains:

| Domain | Main locations |
| --- | --- |
| Daily action and tasks | `src/components/today/`, `src/components/time-management/`, `src/services/timeManagementService.ts` |
| Habits | `src/components/habit/`, `src/services/habitService.ts` |
| Knowledge bases, folders, groups, notes, templates | `src/components/knowledge/`, `src/hooks/useKnowledgeQuery.ts`, `src/services/knowledgeService.ts` |
| Daily review | `src/components/daily-review/`, `src/services/dailyReviewService.ts` |
| Focus assistant and sessions | `src/components/focus/`, `src/services/focusAssistantService.ts` |
| Authentication and app shell | `src/App.tsx`, `src/components/LoginPage.tsx`, `src/components/layout/` |

Exact feature behavior is the responsibility of [product specifications](docs/product-specs/index.md).

## Runtime boundaries and flows

### Authentication and windows

`src/App.tsx` owns the main webview session, clears query/UI state on account changes, and mounts `RealtimeProvider` only for an authenticated main window. `quick-edit.html` is intentionally a lightweight task editor. `focus-assistant.html` uses `WindowSessionGate` to require the same Supabase session, but the main window remains the owner of the shared Supabase Broadcast subscription.

### Reads and writes

TanStack Query holds remote state; Zustand holds UI-only state. Feature hooks and services form the normal data seam. Reads use RLS-protected PostgREST queries and writes commonly use constrained RPCs. Optimistic cache updates may be debounced, but successful RPC results or later refetches replace client assumptions with database values.

### Realtime and cross-window synchronization

The main window subscribes to the private `user:<id>:sync` channel in `src/lib/realtimeManager.ts`. Database triggers emit a minimal committed-change hint; the client invalidates the narrow matching query key and refetches through RLS.

`src/hooks/useKnowledgeQuery.ts` also contains a localized Tauri-event fast path that patches knowledge-folder note cache state between windows. This differs from the accepted rule in [sync-and-editor consistency](docs/design-docs/sync-and-editor-consistency.md), which says Tauri events should not become row-replication. Treat this as a documented implementation divergence: do not extend it before reconciling the code and design decision.

### Database ownership

Migrations define tables, policies, triggers, RPCs, and database-owned facts. The live snapshot is [docs/generated/db-schema.md](docs/generated/db-schema.md). User-owned rows are isolated by `user_id` and RLS. Versioned writes supply a previously observed `updated_at`; the database returns the new version or reports `VERSION_CONFLICT`. Timestamps, soft deletion, completion, focus-session boundaries, and initial ordering are database decisions, not client-clock values.

## Architectural invariants

| Invariant | Why | Primary enforcement / evidence |
| --- | --- | --- |
| UI data access follows existing hook/service seams; do not create a new direct Supabase path in feature UI. | Keeps cache, retries, error handling, and domain mapping coherent. | `src/hooks/`, `src/services/`, strict TypeScript build. |
| Query state and UI-only state remain separate. | Prevents local selections from masquerading as server truth. | TanStack Query usage, `src/stores/`. |
| RLS, `user_id`, and authenticated RPC grants protect user data. | The browser is not an authorization boundary. | Migrations and [Security](docs/SECURITY.md). |
| Broadcast payloads are invalidation hints, not authoritative row data. | Missed messages and stale local values must not overwrite the source of truth. | `src/lib/realtimeManager.ts`, latest Broadcast migration. |
| Knowledge content is loaded on demand. | Avoids loading note bodies and knowledge-folder contents outside the active surface. | `src/hooks/useKnowledgeQuery.ts`, [Frontend](docs/FRONTEND.md). |
| Applied database history is append-only. | Migrations are the durable record of deployed behavior. | `supabase/migrations/`. |
| Native permissions are scoped deliberately. | Tauri capabilities grant desktop APIs to webviews. | `src-tauri/capabilities/`, [Security](docs/SECURITY.md). |

## Where to look next

- UI engineering, state, data, and styling: [docs/FRONTEND.md](docs/FRONTEND.md)
- Interaction and visual principles: [docs/DESIGN.md](docs/DESIGN.md)
- Product trade-offs: [docs/PRODUCT_SENSE.md](docs/PRODUCT_SENSE.md)
- Failure and recovery behavior: [docs/RELIABILITY.md](docs/RELIABILITY.md)
- Trust boundaries and security changes: [docs/SECURITY.md](docs/SECURITY.md)
- Specific synchronization decision: [docs/design-docs/sync-and-editor-consistency.md](docs/design-docs/sync-and-editor-consistency.md)
