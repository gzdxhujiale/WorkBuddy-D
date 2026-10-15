# Tasks

## 1. Real-Time WebSocket Frame Parsing & Client Sequence Catch-Up

- [x] 1.1 Update `src/lib/wsClient.ts` to split incoming WebSocket text frames on `\n` and parse each non-empty line as JSON, verifying that batched messages parse and emit without throwing `SyntaxError` via unit tests.
- [x] 1.2 Implement user-scoped sequence ID storage (`workbuddy_last_seq_id:${userId}`) in `src/lib/wsClient.ts` and ensure sign-out clears the sequence ID, verifying state transitions with unit tests.
- [x] 1.3 Add multi-page catch-up pagination loop in `wsClient.syncMissedDeltas()` when `res.has_more` is true, verifying with mock delta catch-up tests.

## 2. NoteBufferManager Resilience & Graceful Shutdown

- [x] 2.1 Refactor `server/internal/buffer/note_buffer.go` `FlushDirty()` to retain `item.IsDirty = true` when database patch fails, verifying with a unit test that failed notes retry on subsequent cycles.
- [x] 2.2 Implement idle memory eviction in `note_buffer.go` for clean notes untouched for over 5 minutes, verifying with an eviction unit test.
- [x] 2.3 Reorder server shutdown in `server/cmd/server/main.go` so `srv.Shutdown()` drains connections before `noteBufferMgr.Stop()` executes final flush, verifying Go server test suite.

## 3. API Client Error Hierarchy & Optimistic Lock Conflict Handling

- [x] 3.1 Define `ApiHttpError` inheriting from native `Error` in `src/lib/apiClient.ts` containing HTTP status, message, and response data, verifying with unit tests.
- [x] 3.2 Update `toDataSyncError()` and `hasVersionConflict()` in `src/lib/sync.ts` and `src/hooks/useOptimisticSync.ts` to inspect `ApiHttpError` and HTTP 409 status code, verifying conflict detection tests.
- [x] 3.3 Remove silent `catch` error-swallowing fallbacks that return empty arrays in `timeManagementService.ts`, `habitService.ts`, and `projectService.ts`, verifying that query error boundaries catch service rejections.

## 4. Radix UI Primitives Integration & Component Cleanup

- [x] 4.1 Install `@radix-ui/react-select` and `@radix-ui/react-dropdown-menu` using `pnpm add`, verifying `package.json` updates and lockfile integrity.
- [x] 4.2 Reimplement `src/components/ui/select.tsx` using `@radix-ui/react-select` with Portal mounting (`z-index: 1100`), collision detection, and dual-theme styles (Modern Minimal & 8-Bit Pixel), verifying rendering and keyboard navigation.
- [x] 4.3 Reimplement `src/components/ui/dropdown-menu.tsx` using `@radix-ui/react-dropdown-menu` with Portal mounting, collision avoidance, and full keyboard accessibility, verifying dropdown rendering without overflow clipping.

## 5. Daily Review Schema Normalization & Date Alignment

- [x] 5.1 Standardize `daily_reviews.content` handling in `src/features/daily-review/services/dailyReviewService.ts` and `server/internal/handler/daily_review_handler.go` as canonical Tiptap Doc JSON, removing ad-hoc Base64 and HTML regex sniffing, verifying review serialization unit tests.
- [x] 5.2 Unify date calculations in `src/lib/dateUtils.ts` and `src/features/habit/api/habitService.ts` to local timezone YYYY-MM-DD formatting, verifying date utility tests.

## 6. Server Slog Modernization & Tauri Capabilities Hardening

- [x] 6.1 Replace remaining `log.Printf` in `server/internal/handler/auth_handler.go` and `server/internal/ws/client.go` with structured `slog`, verifying with `go -C server vet ./...`.
- [x] 6.2 Narrow window selectors in `src-tauri/capabilities/default.json` from `"*"` to explicit window IDs and remove unused `greet` command and `desktop.json`, verifying with `cargo check` in `src-tauri`.

## 7. System Integration & Verification

- [x] 7.1 Run full frontend checks with `pnpm build` and `pnpm lint:boundaries`, verifying zero compilation or boundary errors.
- [x] 7.2 Run full backend verification with `go -C server test ./...` and `go -C server build ./cmd/server`, verifying all tests pass and binary builds cleanly.
- [x] 7.3 Run Tauri Rust compilation check with `cargo check` in `src-tauri`, verifying host configuration is valid.

## Workflow follow-up

- Archive the change after implementation and validation are completed.
- Verify the archived result and update managed docs as needed.
