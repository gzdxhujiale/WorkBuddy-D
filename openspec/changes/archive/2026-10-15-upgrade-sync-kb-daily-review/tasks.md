# Tasks: Upgrade Sync Protocol, Knowledge Base Search/Buffer, and Daily Review Architecture

## 1. Database Schema & Migration

- [x] 1.1 Create migration `db/migrations/000002_upgrade_sync_kb_review.sql` adding `entity_change_logs`, enabling `pg_trgm`, adding notes trigram index, and verify SQL syntax
- [x] 1.2 Update SQL query definitions in `server/internal/database/queries/` (`sync.sql`, `notes.sql`, `daily_reviews.sql`) and regenerate sqlc Go code

## 2. Ordered Sync Protocol & Reconnect Engine

- [x] 2.1 Implement `entity_change_logs` insertion and sequence generation utilities in Go backend
- [x] 2.2 Update `ws.Hub` to propagate `seq_id` inside `DeltaMessage` broadcasts to connected Webviews
- [x] 2.3 Implement `GET /api/v1/sync` handler in `handler/sync_handler.go` and register route in `main.go`
- [x] 2.4 Update frontend `src/lib/wsClient.ts` to record `lastSeqId` and invoke `/api/v1/sync` upon reconnection

## 3. Knowledge Base Full-Text Search & Write-Behind Buffer

- [x] 3.1 Implement `NoteBufferManager` in `server/internal/buffer/` with 2.5s background flush ticker and graceful shutdown flush
- [x] 3.2 Add `PATCH /api/v1/notes/:id/buffer` route and handler wiring to `NoteBufferManager`
- [x] 3.3 Implement `GET /api/v1/notes/search` endpoint in `note_handler.go` with trigram ranking and text snippets
- [x] 3.4 Connect frontend knowledge auto-save to buffered endpoint and add search integration in `src/features/knowledge/`

## 4. Daily Review Decoupling, Stats & Heatmap

- [x] 4.1 Update `daily_review_handler.go` to expose `GET /api/v1/daily-reviews/summaries` and `GET /api/v1/daily-reviews/:date`
- [x] 4.2 Implement `GET /api/v1/daily-reviews/stats` and `GET /api/v1/daily-reviews/heatmap` endpoints in `daily_review_handler.go`
- [x] 4.3 Refactor frontend `useDailyReview.ts` and `DailyReviewPanel.tsx` to consume decoupled summaries and fetch date details on-demand

## 5. Tiered Startup Prefetching & End-to-End Verification

- [x] 5.1 Implement tiered startup prefetching in frontend (`L1` immediate workbench items, `L2` idle prefetching for KB tree and review summaries)
- [x] 5.2 Verify Go backend builds with `go build ./...` and frontend passes `pnpm build`
