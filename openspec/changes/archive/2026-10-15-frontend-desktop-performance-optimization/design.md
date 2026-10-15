# Design

## Context

See `proposal.md` for motivation. WorkBuddy-D uses Vite 7, TanStack Router, React 19, and Tauri 2. Secondary webviews (`quickEdit`, `focusAssistant`, `notificationToast`) share frontend assets. Heavy dependencies like `reactjs-tiptap-editor` (1.6 MB) and full UI libraries are currently bundled without explicit manual chunks or lazy isolation in auxiliary windows.

## Goals / Non-Goals

**Goals:**
- Enable predictive intent-based route chunk preloading on hover in TanStack Router.
- Isolate heavy third-party vendor libraries into distinct, cacheable chunks (`tiptap-vendor`, `arco-vendor`, `react-core`) via Vite `manualChunks`.
- Asynchronously lazy load `ReactjsTiptapEditor` in `TaskQuickEdit` so that secondary webview startup and drawer initialization don't pull 1.6 MB of JavaScript immediately.
- Debounce high-frequency native window resize and scale IPC events to prevent frame drops on Windows.
- Wrap heavy document and date selection state changes in `React.startTransition` for 60fps UI responsiveness.

**Non-Goals:**
- Dimension 4 (Go backend keep-alive ping / Neon Serverless heartbeats) is explicitly excluded per user request.
- Rewriting or swapping out Tiptap or Arco Design component APIs.

## Decisions

### Decision 1: TanStack Router intent preloading
Configure `defaultPreload: 'intent'` and `defaultPreloadDelay: 50` in `src/app/routes/router.tsx`.
- *Rationale*: Hovering over sidebar navigation links for >= 50ms automatically fetches the lazy route component chunk before user clicks, eliminating page transition wait times.
- *Alternatives considered*: Preload on render (too aggressive, preloads all modules on boot) or preload on click (current behavior, has noticeable delay).

### Decision 2: Vite manualChunks strategy
In `vite.config.ts`, configure `rollupOptions.output.manualChunks`:
- `tiptap-vendor`: includes `@tiptap/` and `reactjs-tiptap-editor`.
- `arco-vendor`: includes `@arco-design/web-react`.
- `react-core`: includes `react`, `react-dom`, `@tanstack/react-query`, `@tanstack/react-router`.
- *Rationale*: Separates the 1.6 MB editor and UI components from application code, enabling effective long-term asset caching and faster incremental rebuilds.

### Decision 3: Lazy loading rich text editor in TaskQuickEdit
In `TaskQuickEdit.tsx`, replace the static import of `ReactjsTiptapEditor` with `React.lazy` and a lightweight Suspense fallback.
- *Rationale*: The quick edit window and task drawers often only view or edit titles and metadata. Statically importing Tiptap forces every quick edit popup to parse 1.6 MB of AST/code before painting.

### Decision 4: Throttled/Debounced window resize IPC listeners
In `App.tsx` (`onScaleChanged`) and `AppLayout.tsx` (`onResized`), wrap the Tauri IPC callback in a 100ms debounce.
- *Rationale*: Window dragging and resizing on Windows triggers hundreds of events per second; without debouncing, rapid IPC calls can cause stuttering and CPU spikes.

### Decision 5: React 19 startTransition for document and date switches
In `DailyReviewPanel.tsx` and `KnowledgePanel.tsx`, wrap `setSelectedDate` and active note selection in `React.startTransition`.
- *Rationale*: Re-mounting a full Tiptap document tree can take 50-80ms; `startTransition` lets React keep navigation and UI buttons completely responsive during the transition.

## Risks / Trade-offs

- **[Risk]** First time clicking description in `TaskQuickEdit` may have a brief loading flicker while Tiptap loads.  
  → **Mitigation**: Provide a clean, subtle loading indicator and preload the chunk when the task quick edit popover opens.
- **[Risk]** Vite `manualChunks` could create circular dependency warnings if boundaries are too granular.  
  → **Mitigation**: Group only well-defined external `node_modules` vendor packages.
