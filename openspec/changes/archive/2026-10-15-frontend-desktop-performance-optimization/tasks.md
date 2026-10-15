# Tasks: Frontend and Desktop Performance Optimization

## 1. TanStack Router & Concurrent Navigation Optimization

- [x] 1.1 Enable `defaultPreload: 'intent'` and `defaultPreloadDelay: 50` in `src/app/routes/router.tsx` and verify router options
- [x] 1.2 Wrap heavy document/date updates in `React.startTransition` in `DailyReviewPanel.tsx` and verify non-blocking date transitions

## 2. Vite Bundle Splitting & TaskQuickEdit Lightweighting

- [x] 2.1 Configure `manualChunks` in `vite.config.ts` for `tiptap-vendor`, `arco-vendor`, and `react-core`
- [x] 2.2 Convert `ReactjsTiptapEditor` in `TaskQuickEdit.tsx` to dynamic lazy loading with lightweight fallback and verify type-checking

## 3. Native Desktop IPC Event Debouncing & Verification

- [x] 3.1 Add debouncing to window `onScaleChanged` in `App.tsx` and `onResized` in `AppLayout.tsx`
- [x] 3.2 Verify full frontend build (`pnpm build`) and confirm chunk splitting and build success
