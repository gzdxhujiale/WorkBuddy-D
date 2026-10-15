# Design: Upgrade Sync Protocol, Knowledge Base Search/Buffer, and Daily Review Architecture

## Context

See `proposal.md` for motivation and system background.
WorkBuddy-D operates with a Tauri 2 desktop multi-webview frontend, a Go backend (Gin + pgxpool + sqlc), and a Neon Serverless PostgreSQL database. This design formalizes the technical strategy for sequence-based data synchronization, hybrid search, debounced in-memory write buffering, decoupled daily review loading, and startup prefetching.

## Goals / Non-Goals

**Goals:**
- Provide sequential ordering (`seq_id`) on all entity delta events to enable catch-up reconciliation after sleep or network drops.
- Implement server-side trigram search across notes with sub-50ms response times.
- Implement an in-memory write-behind cache for note auto-saves, reducing Postgres write volume by >80%.
- Decouple daily review summaries from full Tiptap JSONB documents, reducing initial review payload by >90%.
- Provide server-calculated streak metrics and compact yearly activity heatmaps.
- Implement a tiered prefetching pattern on desktop startup to balance cold-start mitigation with instant UI navigation.

**Non-Goals:**
- Multi-user collaborative real-time editing (CRDT / Operational Transformation).
- Deploying dedicated external search clusters (e.g., Elasticsearch / Meilisearch).
- Replacing Tiptap document format with another editor engine.

## Decisions

### Decision 1: Database Entity Change Log & Sequential Replay
- **Approach**: Create `entity_change_logs (seq_id BIGSERIAL PRIMARY KEY, user_id UUID, entity_type TEXT, entity_id UUID, action TEXT, payload JSONB, created_at TIMESTAMPTZ)`. Every mutating handler (`note_handler`, `task_handler`, `daily_review_handler`, `habit_handler`, `project_handler`) records the mutation into `entity_change_logs` in the same transaction or immediately upon commit, passing the assigned `seq_id` to `ws.Hub.BroadcastToUser`.
- **Replay API**: `GET /api/v1/sync?since_seq=` returns changes where `seq_id > since_seq`.
- **Alternatives Considered**:
  - *In-memory Ring Buffer*: Fast, but lost on server restart or redeploy.
  - *PostgreSQL Logical Replication / LISTEN/NOTIFY*: Adds connection overhead and complex listener management in serverless environments.

### Decision 2: Trigram Full-Text Search with `pg_trgm`
- **Approach**: Enable `pg_trgm` on Neon Postgres. Create GIN index on `notes ((title || ' ' || content) gin_trgm_ops)`. Go exposes `GET /api/v1/notes/search?q=` running similarity or substring ILIKE queries returning matched note summaries and highlighted snippets.
- **Alternatives Considered**:
  - *Client-side in-memory search*: Requires downloading all note contents to client, which degrades as notes accumulate.
  - *External search engine*: Unnecessary operational burden for single-user desktop deployment.

### Decision 3: In-Memory Write-Behind Buffer (`NoteBufferManager`)
- **Approach**:
  - Introduce `NoteBufferManager` in `server/internal/buffer/`.
  - Maintains `sync.Map` of pending note patches with `isDirty`, `lastModified`, and `timer`.
  - Frontend auto-save calls `PATCH /api/v1/notes/:id/buffer`. The server updates the in-memory cache and returns `200 OK` in <5ms.
  - A background ticker (every 2.5s) flushes all dirty notes to PostgreSQL via a batch transaction.
  - Server registers graceful shutdown hooks to flush all dirty notes before exiting.
- **Alternatives Considered**:
  - *Direct Database Write on Every Debounce*: High WAL volume, frequent lock conflicts, and Neon compute utilization spikes.

### Decision 4: Daily Review Metadata vs. Detail Decoupling
- **Approach**:
  - `GET /api/v1/daily-reviews/summaries`: Queries `id`, `date`, `lock_version`, `updated_at`, `jsonb_extract_path_text` for text preview and character count.
  - `GET /api/v1/daily-reviews/:date`: Queries the complete record including full `content JSONB`.
  - `GET /api/v1/daily-reviews/stats`: Computes consecutive streak, longest streak, and compound growth factor on server.
  - `GET /api/v1/daily-reviews/heatmap?year=YYYY`: Returns `{ [date: string]: { level: number, word_count: number, has_review: boolean } }`.
- **Alternatives Considered**:
  - *Continue using `SELECT *`*: Overwhelms network and TanStack Query cache as user journal accumulates.

### Decision 5: Tiered Frontend Prefetching
- **Approach**:
  - Main window startup executes **Tier 1 (L1)** query execution for active workbench items: `todayTasks`, `focusSession`, `todayHabits`, and `todayReviewStatus`.
  - When the main layout mounts and idle callback fires (`requestIdleCallback` or 200ms delay), trigger **Tier 2 (L2)** prefetching via `queryClient.prefetchQuery`: knowledge folders/metadata, daily review summaries, and active project metadata.

## Risks / Trade-offs

- **[Risk] Neon Cold Start during initial sync or prefetch** → **Mitigation**: Tier 1 requests trigger the compute wake-up. Go backend includes connection retry logic with exponential backoff on `driver.ErrBadConn`.
- **[Risk] Unflushed memory buffer loss on hard process crash (SIGKILL/power outage)** → **Mitigation**: Dirty buffer flush interval is kept short (2.5s), and standard `PUT /notes/:id` remains available for explicit manual user saves (Ctrl+S).
- **[Risk] Change log table unbounded growth** → **Mitigation**: `entity_change_logs` can be periodically pruned by a background job to retain only the most recent 30 days or 5,000 entries per user.

## Migration Plan

1. Apply database migration in `db/migrations/` creating `entity_change_logs`, enabling `pg_trgm`, and adding GIN indexes.
2. Update sqlc queries and regenerate Go query bindings.
3. Implement Go backend handlers and wire new routes.
4. Update frontend client adapters and TanStack Query hooks.
5. Verify end-to-end functionality using frontend production build and Go test suite.
