# Proposal

## Why

In the desktop environment, on-demand dynamic route loading (`React.lazy`) introduces jarring loading spinners and layout flashes when switching between core application tabs, degrading the native desktop feel compared to eager bundling with local disk assets. Concurrently, the Daily Review module suffers from severe date-switching bugs: switching dates destroys and recreates the rich text editor instance, asynchronous detail loading fails to reconcile with the local auto-save state (causing historical content to disappear or be overwritten with blanks), and browsing past calendar months forcibly alters the currently edited review date.

## What Changes

- **Desktop Eager Route Bundling**: Transition core desktop navigation routes (`TodayPage`, `FourQuadrantsPage`, `HabitPage`, `DailyReviewPage`, `KnowledgePage`, `ProjectsPage`) in `src/app/routes/router.tsx` from `React.lazy` to eager module imports, eliminating `Suspense` loading spinner flashes while maintaining optimized `manualChunks` vendor separation in Vite.
- **Stable TipTap Editor Lifecycle Across Date Switching**: Remove intrusive `key={selectedDate}` recreation from `ReviewEditor` and `ReactjsTiptapEditor`. Keep the editor mounted and update its content smoothly via `editor.commands.setContent`, avoiding unnecessary ProseMirror state destructions.
- **Asynchronous Content Hydration Reconciler**: Fix `useReviewAutoSave` in `DailyReviewPanel` to accurately synchronize asynchronous review detail payload arrivals with local editor state when navigating to previously uncached dates, preventing blank displays and accidental blank overwrites.
- **Decoupled Calendar View Month from Selected Review Date**: Introduce an independent `viewMonth` state in `CompoundStats` so users can freely navigate and browse past punch-in history across months without forcibly hijacking or altering their active review editing date.

## Capabilities

### Modified Capabilities
- `daily-review`: Enhance date switching lifecycle, calendar view month decoupling, and asynchronous review hydration continuity.

## Impact

- **Frontend Routes**: `src/app/routes/router.tsx` will switch from dynamic `React.lazy` imports to standard imports for top-level pages.
- **Review Components**: `src/features/daily-review/components/DailyReviewPanel.tsx` will refactor editor lifecycle keys, auto-save state reconciliation, and calendar month navigation.
- **Build & Bundle**: `vite.config.ts` maintains existing `manualChunks` configurations; bundle chunks remain strictly under size limits without extra network latency in Tauri.
