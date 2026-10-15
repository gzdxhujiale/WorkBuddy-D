# Proposal: Stabilize Architecture Data Sync & UI Foundations

## Why

WorkBuddy-D's hybrid desktop architecture (Tauri 2, React 19, Go 1.26 independent backend) currently exhibits several critical stability, data integrity, and engineering hygiene issues:
1. **Critical Synchronization & Data Loss Bugs**: Gorilla WebSocket flushes queued events as newline-separated strings within single text frames, which crashes the frontend `JSON.parse` and silently drops all batched real-time events. `NoteBufferManager` resets its dirty flag before database writes and ignores flush errors, permanently dropping high-frequency note edits on transient database failures.
2. **Broken Client Isolation & Concurrency**: The local delta synchronization sequence ID (`workbuddy_last_seq_id`) is stored globally without user scoping, corrupting delta sync across multi-user sign-ins. Reconnection delta catch-up bypasses pagination when `hasMore` is true. `apiClient` throws non-`Error` plain objects, which breaks version conflict detection (`hasVersionConflict`).
3. **Fragile UI Inventions & Architectural Smells**: Hand-rolled, 1,200+ line components (e.g. `date-picker.tsx`, `Select.tsx` without Portals, `DropdownMenu.tsx` with dimension guessing) lack ARIA accessibility and collision handling, causing layout shifts and clipping in nested surfaces. Server-side log statements bypass `log/slog`, and database mutations lack transaction wrappers.

Standardizing on Radix UI headless primitives for floating popovers/selects and hardening the Go backend data pipelines establishes a robust, defect-free foundation for all personal planning workflows.

## What Changes

### Data Safety & Real-Time Sync (Priority 1)
- **WebSocket Frame Splitting**: Update frontend `wsClient.ts` to split incoming WebSocket text frames by newline (`\n`) and parse each JSON payload independently, ensuring batched server events are never dropped with `SyntaxError`.
- **NoteBufferManager Resilience & Eviction**:
  - In `NoteBufferManager.FlushDirty()`, keep `item.IsDirty = true` until the database patch succeeds. On error, preserve the dirty state for the next flush cycle with exponential backoff logging.
  - Implement memory eviction for flushed, clean notes after an idle TTL to prevent unbounded memory growth in `m.items`.
  - Reorder graceful shutdown in `main.go` so `http.Server.Shutdown()` drains in-flight requests *before* `noteBufferMgr.Stop()` executes its final forced flush.
- **Strict Error Typing & Conflict Detection**:
  - Update `apiClient.ts` to throw custom `ApiHttpError` inheriting from native `Error` with `status`, `message`, and response payload.
  - Fix `toDataSyncError()` and `hasVersionConflict()` so optimistic concurrency HTTP 409 responses correctly trigger cache rollbacks and user alerts.
- **User-Scoped Sequence Tracking & Catch-Up Pagination**:
  - Scope `workbuddy_last_seq_id:${userId}` to the authenticated user ID and clear/reinitialize it on sign-in/sign-out.
  - In `wsClient.syncMissedDeltas()`, loop while `res.has_more` is true to pull all pending pages before jumping `lastSeqId` to `latest_seq`.
- **Transparent Service Error Propagation**:
  - Remove silent `catch { return { tasks: [] } }` and `catch { return { habits: [], checkIns: [] } }` fallbacks in `timeManagementService.ts`, `habitService.ts`, and `projectService.ts`. Errors must propagate to TanStack Query so error boundaries, retry buttons, and toast banners function as specified.

### UI Foundations & Design System Convergence (Priority 2)
- **Radix UI Headless Integration**:
  - Introduce `@radix-ui/react-select` and `@radix-ui/react-dropdown-menu` (or Radix Popover primitives) to replace the fragile non-Portal custom `Select.tsx` and dimension-guessing `DropdownMenu.tsx`.
  - Ensure all popups render into React Portals (`z-index: 1100`) with collision detection, keyboard navigation, and full ARIA compliance while preserving dual themes (Modern Minimal & 8-Bit Pixel).
- **Timezone Consistency & Date Helpers**:
  - Unify date formatting across `dateUtils.ts` and `habitService.ts` to use local timezone calculations (`formatDateYMD`) instead of naive UTC string truncation (`toISOString().slice(0, 10)`), preventing single-day shifts near midnight.
- **Canonical Daily Review Content Schema**:
  - Enforce that `daily_reviews.content` is always a canonical Tiptap Doc JSON structure (`{ "type": "doc", "content": [...] }`).
  - Strip ad-hoc Base64 decoding (`atob`), HTML tag stripping loops, and `{ text: "..." }` wrappers from both frontend `dailyReviewService.ts` and backend `daily_review_handler.go`.

### Cleanliness & Engineering Invariants (Priority 3)
- **Go Logging Convergence**: Replace remaining `log.Printf` in `auth_handler.go` and `client.go` with structured `slog.Info`, `slog.Warn`, and `slog.Error`.
- **Tauri Window Capabilities Hardening**: Narrow `src-tauri/capabilities/default.json` from generic `"windows": ["*"]` to explicit window identifiers, and remove unused template commands (`greet`) and dead capabilities (`desktop.json`).

## Capabilities

### Modified Capabilities
- `client-preferences-sync`: Strengthens WebSocket delta frame handling for batched newline-separated payloads, scopes sequence IDs per authenticated user, and enforces pagination loops during catch-up sync.
- `knowledge-base`: Guarantees write-behind buffer persistence without data loss on transient database errors, bounded cache retention, and transactional folder duplication.
- `daily-review`: Formalizes canonical Tiptap JSON document storage for review bodies, eliminating defensive multi-format decoding.
- `task-management`: Restores optimistic concurrency conflict detection and eliminates silent query error suppression on remote task retrieval.

## Non-goals

- Rewriting the Tiptap rich-text editor engine or replacing ProseMirror extensions.
- Modifying PostgreSQL database table columns or primary DDL structures (all changes conform to existing Goose migration schemas).
- Introducing third-party CSS frameworks or changing Tailwind CSS v4 design tokens.
- Re-architecting Tauri window management into a single-webview multi-tab layout.

## Impact

- **Frontend**: `@radix-ui/react-select`, `@radix-ui/react-dropdown-menu`, `src/lib/wsClient.ts`, `src/lib/apiClient.ts`, `src/lib/sync.ts`, `src/components/ui/select.tsx`, `src/components/ui/dropdown-menu.tsx`, `src/features/daily-review/`, `src/features/time-management/`, `src/features/habit/`.
- **Backend**: `server/internal/ws/client.go`, `server/internal/buffer/note_buffer.go`, `server/internal/handler/auth_handler.go`, `server/internal/handler/daily_review_handler.go`, `server/cmd/server/main.go`.
- **Desktop**: `src-tauri/capabilities/default.json`, `src-tauri/src/lib.rs`.
