# Design: Stabilize Architecture Data Sync & UI Foundations

## Context

See `proposal.md` for background and motivation.
WorkBuddy-D's architecture relies on:
1. Go backend HTTP REST API & WebSocket Hub (`/ws`, `/api/v1/*`)
2. In-memory write-behind buffer (`NoteBufferManager`) for debounced note autosaving
3. Monotonic sequence logging in PostgreSQL (`entity_change_logs`)
4. React 19 frontend with TanStack Query v5 for server state and Zustand for UI state
5. Tauri 2 desktop host with multi-webview windows (`main`, `quick-edit`, `focus-assistant`, `notification-toast`)

Current code exhibits concrete reliability vulnerabilities across the sync boundary, memory leaks in the buffer manager, hand-rolled UI primitives lacking Portals/ARIA, and ad-hoc defensive wrappers.

## Goals / Non-Goals

**Goals:**
- Eliminate all silent WebSocket delta drops by supporting newline-delimited JSON frames.
- Ensure zero data loss in `NoteBufferManager` across transient database errors and implement clean eviction.
- Enforce strict `Error` class hierarchy in `apiClient.ts` to restore optimistic lock conflict handling.
- Scope sequence synchronization to the authenticated user and support multi-page catch-up reconciliation.
- Replace fragile, non-portal custom `Select` and `DropdownMenu` with robust `@radix-ui/react-select` and `@radix-ui/react-dropdown-menu` primitives preserving both Modern and 8-Bit Pixel themes.
- Standardize `daily_reviews.content` storage to canonical Tiptap Doc JSON and unify date calculation timezones.
- Align all server logging with standard `log/slog` and tighten Tauri window capabilities.

**Non-Goals:**
- Altering core database schema or replacing sqlc query generation.
- Re-architecting multi-webview windows into a single-window router.
- Replacing Tiptap editor with a different rich-text framework.

## Decisions

### 1. WebSocket Frame Line Splitting (`wsClient.ts` & `client.go`)
- **Choice**: Frontend `wsClient.ts` splits incoming text frames on `\n` and parses each non-empty line as a distinct JSON `DeltaMessage`.
- **Rationale**: Gorilla WebSocket's `WritePump` coalesces queued channel messages into a single text frame separated by `\n` to minimize TCP overhead. By treating incoming WebSocket text frames as JSON Lines (JSONL), the client handles both single frames and batched frames identically without throwing `SyntaxError`.
- **Alternatives Considered**: Modifying Go `WritePump` to send one WebSocket frame per message. Rejected because TCP/WS batching reduces syscalls and network latency during high-throughput operations (e.g. folder cloning or mass reordering).

### 2. NoteBufferManager Fault Tolerance & Memory Eviction (`note_buffer.go`)
- **Choice**:
  1. In `FlushDirty()`, keep `item.IsDirty = true` until `h.queries.PatchNote` successfully completes. If an error occurs, leave `item.IsDirty = true` and log with `slog.Error`. The item will automatically be retried on the next 2.5s ticker cycle.
  2. Implement an eviction sweep: notes that have `!IsDirty` and have not been touched for more than 5 minutes are deleted from `m.items` under lock.
  3. In `main.go`, invoke `srv.Shutdown(shutdownCtx)` first to stop accepting new requests and drain in-flight requests, then invoke `noteBufferMgr.Stop()` to execute the final flush.
- **Alternatives Considered**: Flushing synchronously on every HTTP request. Rejected because direct DB writes for every keystroke degrade server performance and exhaust database connections.

### 3. Custom `ApiHttpError` Inheriting from `Error` (`apiClient.ts` & `sync.ts`)
- **Choice**: Create `ApiHttpError extends Error` containing `status: number`, `message: string`, and `data: unknown`.
- **Rationale**: When `apiClient` threw plain objects, `error instanceof Error` checks in `toDataSyncError()` evaluated to `false`, discarding the HTTP 409 status and error message and substituting a generic `"同步失败"`. With `ApiHttpError`, downstream error handlers correctly identify `hasVersionConflict` and display actionable conflict prompts.
- **Alternatives Considered**: Wrapping every `apiClient` call in try-catch in each service. Rejected because centralized error typing guarantees consistent behavior across all features.

### 4. User-Scoped Sequence Tracking & Pagination Loop (`wsClient.ts`)
- **Choice**:
  - Key local sequence storage by `workbuddy_last_seq_id:${userId}`.
  - On login, initialize with the active user's key. On logout, clear in-memory sequence reference.
  - In `syncMissedDeltas()`, loop while `res.has_more` is true:
    ```ts
    let currentSeq = this.lastSeqId;
    let hasMore = true;
    while (hasMore) {
      const res = await apiClient.get<SyncResponse>(`/api/v1/sync?since_seq=${currentSeq}`);
      if (!res || !res.changes || res.changes.length === 0) break;
      for (const change of res.changes) {
        currentSeq = Math.max(currentSeq, change.seq_id);
        this.saveSeqId(currentSeq);
        this.listeners.forEach((fn) => fn(createDeltaEvent(change)));
      }
      hasMore = Boolean(res.has_more);
    }
    ```
- **Rationale**: Prevents cross-user sequence leakage and guarantees that large backlogs (e.g., >500 events after hours offline) are completely replayed without gaps.

### 5. Radix UI Headless Integration (`@radix-ui/react-select` & `@radix-ui/react-dropdown-menu`)
- **Choice**: Replace hand-rolled `Select.tsx` and `DropdownMenu.tsx` internals with Radix UI headless components, using `RadixSelect.Portal` and `RadixDropdownMenu.Portal` (`z-index: 1100`).
- **Rationale**: Radix UI provides battle-tested collision avoidance, viewport flipping, full ARIA attributes, keyboard navigation (Escape, Arrow keys, Home, End, Tab), and portal mounting. Our custom styling (both Modern Minimal and 8-Bit Pixel themes) is applied via Tailwind classes on Radix's `Trigger`, `Content`, and `Item` components.
- **Alternatives Considered**: `@floating-ui/react`. Radix UI is chosen because it includes full accessibility and focus-trap primitives in addition to floating-ui positioning.

### 6. Canonical Daily Review Schema & Date Alignment
- **Choice**:
  - Ensure `daily_reviews.content` is always a canonical Tiptap Doc JSON: `{ "type": "doc", "content": [...] }`.
  - Remove `tryDecodeBase64` and recursive wrapper sniffing.
  - Align all date calculations in `habitService.ts` and `dateUtils.ts` to local timezone YYYY-MM-DD formatting.
- **Rationale**: Eliminates fragile heuristics and guarantees that data stored by the editor can be read predictably by summaries, heatmaps, and stats.

## Risks / Trade-offs

- **[Risk]** Radix UI dependencies add bundle size.
  → **Mitigation**: Radix primitives are tree-shaken and modular (`@radix-ui/react-select`, `@radix-ui/react-dropdown-menu`). Their size is offset by removing hundreds of lines of fragile hand-written positioning and event listener code.
- **[Risk]** Buffered notes in memory during unexpected process crash (`kill -9`).
  → **Mitigation**: The 2.5s flush interval bounds the vulnerability window. `NoteBufferManager.Stop()` handles normal `SIGINT` / `SIGTERM` gracefully.
- **[Risk]** Old daily review records with legacy format.
  → **Mitigation**: Add a graceful normalizer during parse: if content is string or legacy wrapper, safely convert to a single paragraph Tiptap doc instead of crashing.
