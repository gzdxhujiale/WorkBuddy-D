# Technical Design: Go Backend & PostgreSQL (Neon) Architecture

## Context

See `proposal.md` for background and problem motivation.
WorkBuddy-D currently relies on Supabase JS SDK calls across multiple Tauri Webviews. We are introducing a standalone Go service to act as the single authority for data mutation, caching, connection pooling, and real-time WebSocket delta broadcasting.

## Goals / Non-Goals

**Goals:**
- Provide a modular, high-performance Go backend under `server/` with minimal memory footprint (~20MB).
- Ensure zero database connection exhaustion by bounding PostgreSQL connections with `pgxpool`.
- Provide typed WebSocket delta synchronization so client windows update local TanStack Query cache without issuing redundant SQL queries.
- Cleanly decouple PostgreSQL migrations from Supabase-specific dependencies (`auth.uid()`, RLS triggers) into portable SQL files under `db/migrations/`.
- Provide Docker configurations for local development (`deploy/docker-compose.dev.yml`) and production (`deploy/docker-compose.yml`).

**Non-Goals:**
- Modifying UI components or presentation logic in the React frontend.
- Implementing a distributed multi-region sync mesh; a single centralized Go server is sufficient for the application's scale.
- Altering core business domains or domain entities.

## Decisions

### 1. Framework: Go (Fiber/Gin) + sqlc + pgxpool
- **Rationale**: Go provides minimal memory consumption (<30MB) and native goroutine multiplexing for thousands of concurrent WebSocket connections. `sqlc` generates type-safe Go code from plain SQL queries, avoiding ORM reflection overhead while ensuring compile-time query verification.
- **Alternatives considered**:
  - *Java (Spring Boot)*: Heavy memory footprint (~500MB+) and verbose ceremony for a 15-table desktop application.
  - *GORM*: Hides SQL nuances and introduces dynamic reflection overhead.

### 2. Synchronization Architecture: WebSocket Delta Broadcast
- **Rationale**: Instead of Supabase's coarse "table invalidation" which forces all client windows to execute full HTTP re-queries, Go tracks active client sessions and pushes `{ entity, action, id, delta }` payloads.
- **Alternatives considered**:
  - *Server-Sent Events (SSE)*: Unidirectional only; requires separate HTTP requests for every keep-alive/acknowledgment.
  - *Full CRDT engine*: Unnecessary complexity for single-user multi-window personal planning.

### 3. Database: PostgreSQL 17 on Neon & Local Docker
- **Rationale**: PostgreSQL 17 maintains 100% compatibility with existing table schemas, JSONB structures, partial indexes, and UUID primary keys. Neon provides instant branching, serverless autoscaling, and connection resilience.
- **Alternatives considered**:
  - *MySQL 8.0*: Poor JSONB/UUID support, lack of partial indexes, and high migration rewrite cost.

### 4. Authentication: Stateless JWT with Application-Level Scoping
- **Rationale**: Eliminates reliance on PostgreSQL Row Level Security (RLS) policies which run on every row at the database engine level. The Go API extracts the `user_id` from the JWT claims and injects it into all SQL queries.

## Risks / Trade-offs

- **[Risk] WebSocket Connection Drops on Sleep/Wake** → Mitigation: Client-side `wsClient.ts` implements automatic exponential backoff reconnection and fallback sequence version checks.
- **[Risk] Schema Drift between Local Docker and Neon** → Mitigation: Standardized migrations managed via `golang-migrate` or versioned SQL migration runner.
- **[Risk] Desktop Cold Start when Remote Server is Slow** → Mitigation: TanStack Query persister caches data locally in IndexedDB/localStorage; app renders instantly while syncing in the background.

## Migration Plan

1. **Step 1 - Database Schema Cleanse**: Export clean DDL from `supabase/migrations/` to `db/migrations/`, replacing `auth.uid()` references with direct `user_id` column parameters.
2. **Step 2 - Go Backend Core**: Scaffold `server/` with domain models, `sqlc` queries, authentication middleware, and WebSocket Sync Hub.
3. **Step 3 - Frontend Adapter Replacement**: Swap `@supabase/supabase-js` in `src/features/*/api` with `src/lib/apiClient.ts` and wire `wsClient.ts` to `syncEngine.ts`.
4. **Step 4 - Local & Cloud Validation**: Validate end-to-end functionality using local Docker Postgres, followed by staging on Neon.
