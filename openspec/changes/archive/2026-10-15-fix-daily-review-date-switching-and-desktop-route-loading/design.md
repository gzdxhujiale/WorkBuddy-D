# Design

## Context

WorkBuddy-D runs as a local Tauri 2 desktop application. All web assets (HTML, CSS, JS) reside on the local filesystem and are loaded directly by the native webview via IPC/custom protocols with sub-millisecond file reads. The application previously used `React.lazy()` for all 6 top-level workbench routes, which forces React into asynchronous scheduling and triggers `React.Suspense` fallback spinners (`加载模块中...`) upon first clicking any navigation icon.

Additionally, within the Daily Review workbench, the editor lifecycle and calendar state suffer from tight coupling:
- `<ReviewEditor key={selectedDate}>` forces component destruction and remount on every date change.
- In `useReviewAutoSave`, asynchronous hydration of review details from TanStack Query fails to propagate because `prev.date === date` prevents `setContent(initialContent)` from executing.
- The calendar header's month navigation forcibly mutates `selectedDate`, preventing users from browsing past months without modifying their active editing session.

## Goals / Non-Goals

**Goals:**
- Eliminate route-switching Suspense fallback flashes for all 6 core navigation tabs by using eager imports while preserving Vite `manualChunks` vendor separation.
- Maintain a stable, persistent TipTap editor instance across date navigation, updating document content seamlessly via `editor.commands.setContent`.
- Accurately reconcile asynchronous review detail hydration into local state without blank displays or race-condition data overwrites.
- Decouple calendar browsing month (`viewMonth`) from the active review date (`selectedDate`).

**Non-Goals:**
- Removing `React.Suspense` entirely (retained at root as a standard error/fallback boundary for dynamic dialogs).
- Altering the backend API schema or database migrations (backend persistence and empty deletion logic are already sound).

## Decisions

### 1. Eager Route Imports for Desktop Shell Navigation
- **Decision**: In `src/app/routes/router.tsx`, import page components statically (`import { TodayPage } from "@/pages/TodayPage";` etc.) instead of wrapping them in `React.lazy()`.
- **Rationale**: In a desktop app, asset fetching from disk takes <1ms. Asynchronous code-splitting creates an artificial delay and flashes loading spinners on initial tab clicks. Static imports provide immediate, 0ms tab switching.
- **Alternatives Considered**:
  - *Background preloading*: Keep `lazy()` and trigger `import()` in `requestIdleCallback`. Rejected because rapid user clicks immediately after launch would still encounter loading spinners.
  - *Skeleton screens*: Replace the spinner with a skeleton screen. Rejected because replacing one placeholder with another still lacks native desktop snappiness.

### 2. Retaining Vite Vendor Chunking
- **Decision**: Keep the `manualChunks` strategy in `vite.config.ts` separating `reactjs-tiptap-editor`, `prosemirror`, `@tiptap`, and `@tanstack`.
- **Rationale**: Chunking vendor libraries avoids Rollup 500kB bundle warnings and accelerates incremental build caches during development without causing runtime lazy-load delays for application pages.

### 3. Stable Editor Lifecycle Across Date Switches
- **Decision**: Remove `key={selectedDate}` from `ReviewEditor` and `key={date}` from `ReactjsTiptapEditor`.
- **Rationale**: TipTap already provides `editor.commands.setContent(nextContent, { emitUpdate: false })`. Destroying and recreating ProseMirror state, DOM nodes, and extensions on every date switch incurs high CPU overhead and causes visual flashes.

### 4. Robust Asynchronous Content Hydration Reconciler
- **Decision**: In `useReviewAutoSave`, introduce explicit handling for two distinct events:
  1. *Date change*: Flush dirty content of the previous date, reset `content` to `initialContent`, and update date refs.
  2. *Asynchronous detail resolution*: When `initialContent` updates while `date` remains the same, if the local content is pristine (matching `lastSavedRef`), update `content` and `lastSavedRef` with the fetched content.
- **Rationale**: When navigating to an uncached date, `initialContent` is initially empty (`""`) and resolves ~50ms later. Without this reconciler, the editor remains permanently blank and can overwrite remote content with blanks.

### 5. Independent Calendar View Month State
- **Decision**: In `CompoundStats`, maintain `[viewMonth, setViewMonth]` state initialized to `dayjs(selectedDate).startOf("month")`.
  - Clicking `<` / `>` alters `viewMonth` only.
  - Clicking an enabled calendar cell invokes `onSelectDate(dStr)` and syncs `viewMonth`.
  - Changing `selectedDate` from the top bar (e.g., "回到今天", "前一天") synchronizes `viewMonth` if the new date lies outside `viewMonth`.
- **Rationale**: Users frequently want to check past months' punch-in density without losing their place or disrupting the review they are currently writing.

## Risks / Trade-offs

- **[Initial Startup Memory]**: Eagerly importing all 6 core pages increases initial memory footprint marginally.
  - *Mitigation*: The total uncompressed application JS bundle is under 1.5MB; modern desktop webviews (WebView2) parse this in under 20ms, negligible compared to web browser constraints.
- **[Dirty Content During Date Switch]**: Fast date switching while auto-save is debounced might lose unsaved edits.
  - *Mitigation*: The date-switch effect immediately flushes `onSave(prev.date, prev.content)` before updating internal state to the new date.
