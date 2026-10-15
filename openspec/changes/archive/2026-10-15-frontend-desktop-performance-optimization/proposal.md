# Proposal

## Why

WorkBuddy-D has grown into a rich multi-window desktop application with 6 major modules and dedicated secondary Webviews. However, heavy third-party bundles (notably the 1.6 MB Tiptap rich-text package and 570 KB CSS) are statically pulled into sub-windows and initial page bundles, navigation switches lack intent-based preloading, and high-frequency Tauri window resize events lack debouncing, creating memory bloat and UI micro-stutters.

## What Changes

- **TanStack Router Intent Preloading**: Enable `defaultPreload: 'intent'` and `defaultPreloadDelay: 50` so hovering or focusing sidebar links triggers immediate background chunk preloading before user click.
- **TaskQuickEdit Lightweight & Lazy Editor**: Refactor `TaskQuickEdit` to dynamically lazy-load `ReactjsTiptapEditor` only when rich-text editing is active, keeping initial task drawer and secondary Webview startup ultra-fast and lightweight.
- **Vite Bundle Splitting (manualChunks)**: Configure `manualChunks` in `vite.config.ts` to isolate `tiptap-vendor`, `arco-vendor`, and `react-core` into separate, cacheable vendor chunks.
- **Tauri Native IPC Event Debounce**: Add 100ms debouncing to window `onResized` and `onScaleChanged` listener callbacks in `App.tsx` and `AppLayout.tsx`.
- **React 19 Concurrent Transition**: Wrap heavy document and date selection state updates in `React.startTransition` across Daily Review and Knowledge panels for smooth 60fps interaction.

## Capabilities

### New Capabilities
- `client-navigation-and-prefetching`: Provides intent-based route chunk preloading and non-blocking view transition scheduling across the application.

### Modified Capabilities
- `task-quick-edit`: Adds requirement for on-demand lazy loading of the heavy rich text editor to reduce sub-window memory usage and initial render latency.

## Impact

- `vite.config.ts`: Added `manualChunks` strategy.
- `src/app/routes/router.tsx`: Enabled `defaultPreload: 'intent'`.
- `src/features/time-management/components/TaskQuickEdit.tsx`: Dynamic lazy import of rich text editor.
- `src/components/layout/AppLayout.tsx` & `src/app/App.tsx`: Debounced native window resize/scale IPC listeners.
- `src/features/daily-review/components/DailyReviewPanel.tsx`: Added `startTransition` for date switching.
