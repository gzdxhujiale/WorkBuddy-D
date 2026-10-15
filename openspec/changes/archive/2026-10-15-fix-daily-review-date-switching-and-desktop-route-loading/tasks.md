# Tasks

## 1. Desktop Shell Eager Navigation

- [x] 1.1 Convert top-level workbench routes in `src/app/routes/router.tsx` to static imports and verify with `pnpm build`
- [x] 1.2 Verify absence of Suspense fallback spinners during desktop navigation and ensure boundaries pass via `pnpm lint:boundaries`

## 2. Daily Review Editor Lifecycle and State Synchronization

- [x] 2.1 Refactor `ReviewEditor` and `ReactjsTiptapEditor` key bindings in `src/features/daily-review/components/DailyReviewPanel.tsx` to preserve persistent editor instances across date switches
- [x] 2.2 Implement asynchronous content reconciliation in `useReviewAutoSave` to ensure remote hydrated reviews display correctly without blanking out or overwriting
- [x] 2.3 Decouple calendar viewing month state (`viewMonth`) from active review editing date (`selectedDate`) in `CompoundStats`

## 3. Verification and Integration

- [x] 3.1 Run frontend verification suite (`pnpm lint:boundaries` and `pnpm build`) to confirm zero bundle warnings and compliant boundaries
- [x] 3.2 Run desktop host and Go test suite (`cargo check` and `go -C server test ./...`) to ensure end-to-end full-stack stability
