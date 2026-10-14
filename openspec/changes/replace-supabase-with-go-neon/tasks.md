# Tasks

## 1. Database Schema & Migration Setup

- [x] 1.1 Extract and clean PostgreSQL migrations from `supabase/migrations/` into `db/migrations/`, removing Supabase-specific `auth.uid()` triggers and policies
- [x] 1.2 Create `deploy/docker-compose.dev.yml` for local development PostgreSQL and verify with `docker compose -f deploy/docker-compose.dev.yml up -d`

## 2. Go Backend Scaffolding & Core Services

- [x] 2.1 Initialize Go module under `server/` (`go.mod`), configuration loader, and `pgxpool` connection manager
- [x] 2.2 Configure `server/sqlc.yaml` and generate type-safe Go query code for notes, tasks, habits, focus sessions, and projects
- [x] 2.3 Implement JWT authentication middleware in `server/internal/middleware/` to validate tokens and inject `user_id` into request context

## 3. WebSocket Realtime Sync Hub

- [x] 3.1 Implement WebSocket connection Hub in `server/internal/ws/` to track and group active client sessions by `user_id`
- [x] 3.2 Implement delta event broadcasting logic, pushing typed mutation updates (`ENTITY_DELTA`) to active clients upon database writes

## 4. REST Handlers & Domain APIs

- [x] 4.1 Implement Notes REST handlers in `server/internal/handler/note_handler.go` with lock version checks and broadcast triggers
- [x] 4.2 Implement Tasks, Focus Sessions, Habits, and Projects REST handlers in `server/internal/handler/`
- [x] 4.3 Verify the Go backend compiles cleanly with `go build ./server/cmd/server` and handler tests pass

## 5. Desktop Frontend Migration

- [x] 5.1 Create HTTP client `src/lib/apiClient.ts` and WebSocket client `src/lib/wsClient.ts`
- [x] 5.2 Migrate feature API layers in `src/features/*/api/` to use `apiClient.ts` instead of `supabase-js`
- [x] 5.3 Wire `src/lib/syncEngine.ts` to update TanStack Query cache directly upon receiving WebSocket deltas
- [x] 5.4 Remove `@supabase/supabase-js` dependency and verify frontend builds cleanly with `pnpm build`

## 6. Deployment & End-to-End Verification

- [x] 6.1 Create production multi-stage `deploy/Dockerfile` and `deploy/docker-compose.yml`
- [x] 6.2 Verify end-to-end multi-window synchronization across Tauri Webviews using the Go backend
