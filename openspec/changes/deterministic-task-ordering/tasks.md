# Tasks

## 1. Deterministic Sorter Utilities & Unit Tests

- [x] 1.1 Implement pure deterministic task comparators (`sortStageTasks`, `sortQuadrantTasks`, `sortTodayTasks`, `compareTasksDeterministically`) in `src/lib/taskSort.ts` and verify export integrity.
- [x] 1.2 Create unit tests in `src/lib/taskSort.test.ts` verifying stability under identical deadlines, identical sort orders, identical creation timestamps, and ID tie-breakers.

## 2. Project Views & Modal Integration

- [x] 2.1 Update `ProjectStageBoard.tsx` to sort active tasks with `sortStageTasks` before date grouping.
- [x] 2.2 Update `StageTaskManagerModal.tsx` to initialize Tiptap HTML using `sortStageTasks`, and assign sequential `sortOrder` in `computeStageTaskMutations` in `src/features/projects/lib/stagePipeline.ts`.
- [x] 2.3 Update `ProjectGanttView.tsx` and `TodayProjectTimeline.tsx` to sort stage tasks with `sortStageTasks` instead of unsorted array iteration.
- [x] 2.4 Update `ProjectTableView.tsx` to include `createdAt` and `id` tie-breakers for all sortable columns.
- [x] 2.5 Update `useProjects.ts` to allocate sequential `sortOrder` for newly created project tasks.

## 3. Time Management Views Integration

- [x] 3.1 Update `DailyQuadrants.tsx` to incorporate deterministic fallback tie-breakers (`createdAt` and `id`) in quadrant task sorting.
- [x] 3.2 Update `TodayTasksSection.tsx` to use deterministic multi-tier sorting with `createdAt` and `id` tie-breakers for due tasks and quadrant grouping.

## 4. Verification & Validation

- [x] 4.1 Run all Vitest test suites and verify 100% pass rate with `pnpm vitest run`.
- [x] 4.2 Run ESLint boundary checks and production build with `pnpm lint:boundaries` and `pnpm build`.
- [x] 4.3 Validate OpenSpec change integrity with `cmd /c openspec validate deterministic-task-ordering`.
