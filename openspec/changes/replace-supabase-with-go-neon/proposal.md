# Proposal: Replace Supabase with Go Backend and PostgreSQL (Neon)

## Why

WorkBuddy-D currently relies on Supabase BaaS (PostgREST, Auth, and Realtime Broadcast triggers). Because the desktop app operates across multiple Tauri Webviews (main window, quick-edit, focus-assistant, notification toasts), every write operation causes high-frequency database triggers, realtime broadcasts, and cascading query invalidations that overwhelm database connection limits and compute quotas for a single user.

Replacing Supabase with a dedicated, lightweight Go backend service paired with PostgreSQL (hosted on Neon / local Docker) introduces a proper application buffering layer, connection pool management via `pgxpool`, and granular delta-based WebSocket synchronization. This permanently eliminates the query invalidation storm while drastically reducing server memory and hosting overhead.

## What Changes

- **Add Go Backend Service (`server/`)**: A modular Go application (Gin/Fiber + sqlc + pgxpool) providing JWT authentication, RESTful APIs for all application domains (notes, tasks, focus sessions, habits, projects), and a WebSocket sync hub.
- **Implement Granular Delta Synchronization**: Replace Supabase Realtime broadcast table invalidation with targeted WebSocket delta payloads. Modifying an entity updates connected Webview caches directly without triggering full database refetches.
- **Migrate Database to PostgreSQL on Neon / Local Docker (`db/`)**: Transition database schemas from `supabase/migrations/` into clean, standard PostgreSQL migrations hosted on Neon in production and local Docker during development. Remove Supabase-specific `auth.uid()` RLS dependencies in favor of application-level tenant isolation.
- **Update Desktop Frontend Data Access Layer**: **BREAKING** Remove `@supabase/supabase-js`. Introduce an HTTP API client (`apiClient.ts`) and a WebSocket sync client (`wsClient.ts`), updating feature API adapters while preserving TanStack Query hooks and UI components.
- **Docker & Container Orchestration (`deploy/`)**: Provide a `docker-compose.dev.yml` for local database development and a multi-stage `Dockerfile` / `docker-compose.yml` for production deployment.

## Capabilities

### New Capabilities
- `backend-data-sync`: Covers authenticated RESTful entity management, connection pooling, and real-time WebSocket delta synchronization between multiple desktop windows and devices.

### Modified Capabilities
<!-- None of the existing high-level functional specs (task-quick-edit, today-workbench) requirements change; their underlying persistence provider is swapped transparently. -->

## Impact

- **Frontend Code**: `src/lib/supabase.ts`, `src/lib/realtimeManager.ts`, and `src/features/*/api/*.ts` are replaced by standard REST and WebSocket clients. UI components and TanStack Query hooks remain stable.
- **Backend Infrastructure**: Introduction of a standalone Go module under `server/` with independent build and dependency lifecycles.
- **Database & Hosting**: Transition from Supabase managed services to Neon PostgreSQL, configured with `neon.ts` and managed via the Neon CLI.
