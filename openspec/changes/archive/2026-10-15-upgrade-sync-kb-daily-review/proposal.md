# Proposal: Upgrade Sync Protocol, Knowledge Base Search/Buffer, and Daily Review Architecture

## Why

Following the transition from Supabase BaaS to a Go backend with Neon Serverless Postgres, the system currently operates on primitive broadcast-based synchronization and unindexed data fetching:
1. Reconnecting desktop Webviews must perform full query refreshes because WebSocket delta events lack sequential ordering and historical catch-up capabilities.
2. The knowledge base lacks server-side full-text and semantic search, and frequent rich-text auto-saves write directly to Postgres, causing high write amplification and frequent lock-version conflicts.
3. Daily reviews fetch years of full Tiptap JSON documents in a single query (`SELECT * FROM daily_reviews`), bloating memory and network payloads solely to render calendar dots and streak counts.

Upgrading these core paths with ordered revision logs, hybrid knowledge search with write-behind buffering, and decoupled daily review summaries with server-side compound stats creates a high-performance, resilient, and responsive desktop experience.

## What Changes

- **Ordered Increment Log & Reconnect Reconciliation (`ordered-sync-protocol`)**:
  - Introduce an `entity_change_logs` sequence table in Neon Postgres.
  - Deliver monotonically increasing `seq_id` values in WebSocket `ENTITY_DELTA` messages.
  - Implement a `GET /api/v1/sync?since_seq=` endpoint allowing desktop clients to replay missed deltas after sleep or network drops without full refetches.
- **Knowledge Base Hybrid Search & Write-Behind Cache (`knowledge-search-and-buffer`)**:
  - Add PostgreSQL `pg_trgm` GIN indices on notes `(title, content)` for sub-millisecond full-text and substring matching.
  - Provide a dedicated `GET /api/v1/notes/search` endpoint supporting query matching and content snippets.
  - Add a Go in-memory write-behind buffer (`NoteBufferManager`) for debounced auto-saves, flushing dirty states to Neon every 2-3 seconds and on graceful shutdown.
- **Daily Review Metadata Decoupling & Server-Side Stats (`daily-review-intelligence`)**:
  - Decouple daily review listing: `GET /api/v1/daily-reviews/summaries` returns lightweight metadata, word counts, and plain-text previews; `GET /api/v1/daily-reviews/:date` loads full Tiptap JSON content on demand.
  - Add `GET /api/v1/daily-reviews/stats` (current streak, longest streak, total reviews, compound value) and `GET /api/v1/daily-reviews/heatmap?year=` for fast pixel rendering.
  - Update desktop frontend hooks and UI (`DailyReviewPanel.tsx`, `TodayReviewSection.tsx`) to consume summaries and fetch details lazily.
- **Tiered Startup Prefetching Strategy**:
  - Prioritize immediate fetching for L1 Today workbench data, followed by background idle prefetching for knowledge base metadata and review summaries.

## Capabilities

### New Capabilities
- `ordered-sync-protocol`: Sequential revision-based delta logging, ordered WebSocket event emission, and catch-up synchronization endpoint.
- `knowledge-search-and-buffer`: Server-side trigram full-text search, vector search structure, and in-memory debounced write-behind caching for high-frequency note updates.
- `daily-review-intelligence`: Decoupled daily review metadata summaries, lazy loading of Tiptap JSON documents, server-side streak/compound stats, and yearly heatmap matrix.

### Modified Capabilities
<!-- None of the existing high-level specs (today-workbench, task-management-center, project-management-center, task-quick-edit) requirements change. -->

## Impact

- **Database (`db/migrations/`, `server/internal/database/`)**:
  - New migration adding `entity_change_logs` table, `pg_trgm` extension, and trigram index on `notes`.
  - Updated SQL queries in `daily_reviews.sql`, `notes.sql`, and new `sync.sql`.
- **Backend Service (`server/internal/`)**:
  - `ws/hub.go`: Append to sequence log on write operations and emit ordered `seq_id`.
  - `handler/sync_handler.go`: Expose `/api/v1/sync`.
  - `handler/note_handler.go`: Add `/api/v1/notes/search` and integrate `NoteBufferManager`.
  - `handler/daily_review_handler.go`: Add `/summaries`, `/:date`, `/stats`, and `/heatmap`.
- **Frontend Code (`src/features/`, `src/lib/`)**:
  - `src/lib/wsClient.ts`: Maintain `last_seq_id` and request delta sync on reconnection.
  - `src/features/daily-review/`: Split `useDailyReviewData` into summary and detail queries.
  - `src/features/knowledge/`: Add search UI integration and connect auto-save to buffered endpoint.
