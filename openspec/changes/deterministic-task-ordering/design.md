# Design

## Context

See `proposal.md` for background and problem motivation.
Currently, task collections are queried through TanStack Query (`queryKeys.timeManagement` and `queryKeys.projects`) backed by Go server SQL (`ORDER BY sort_order ASC, created_at DESC`). Front-end views (`ProjectStageBoard`, `ProjectGanttView`, `TodayProjectTimeline`, `ProjectTableView`, `DailyQuadrants`, `TodayTasksSection`) sort tasks with ad-hoc comparators or no comparators at all. When comparator criteria are equal, lack of tie-breakers causes unstable ordering upon query invalidation or optimistic state mutation.

## Goals / Non-Goals

**Goals:**
- Provide a standardized, pure, and testable task sorting utility (`src/lib/taskSort.ts` and `src/features/projects/lib/stagePipeline.ts`).
- Guarantee mathematical idempotency and 100% stability: identical task sets always render in identical order regardless of array mutation history.
- Ensure project tasks created from boards or modals receive allocated `sortOrder` values.
- Maintain seamless 1:1 order alignment across all project views (board, timeline, gantt, table, modal).

**Non-Goals:**
- Modifying PostgreSQL database schema or adding new database columns (existing `sort_order`, `created_at`, `id` are sufficient).
- Changing cross-quadrant drag-and-drop animation mechanics.

## Decisions

### 1. Multi-tier Deterministic Task Sorting Protocol
- **Decision**: Define pure comparator functions with strict tie-breaking hierarchies:
  1. Completion Status: `a.completed !== b.completed ? (a.completed ? 1 : -1) : 0` (uncompleted first).
  2. User Sort Order: If defined and different, `(a.sortOrder ?? 0) - (b.sortOrder ?? 0)`.
  3. Due Date / Schedule: If dates exist and differ, earlier scheduled timestamps precede later timestamps.
  4. Chronological Creation: `(b.createdAt || 0) - (a.createdAt || 0)` (newer tasks first if unarranged).
  5. Deterministic ID Tie-Breaker: `a.id.localeCompare(b.id)` (guarantees zero-jitter stability even with identical timestamps).
- **Alternative Considered**: Relying on database ordering without client-side comparators. Rejected because client caches receive optimistic additions and local mutations before network refetches.

### 2. Auto-allocation of `sortOrder` on Project Task Creation
- **Decision**: When creating new project tasks in `useProjects.ts`, `ProjectStageBoard.tsx`, and `StageTaskManagerModal.tsx`, compute `sortOrder` as `(max(existingTasks.sortOrder) ?? -1) + 1` relative to the target stage/project.
- **Alternative Considered**: Leaving `sortOrder` undefined. Rejected because unassigned tasks collide at default 0 and drift when synced to four quadrants.

### 3. Harmonization of View Consumers
- **Decision**: Replace divergent ad-hoc `.sort(...)` calls in:
  - `ProjectStageBoard.tsx`: use `sortStageTasks`.
  - `ProjectGanttView.tsx`: sort stage tasks deterministically instead of raw array mapping.
  - `TodayProjectTimeline.tsx`: sort stage tasks deterministically before rendering track rows.
  - `ProjectTableView.tsx`: add `createdAt` and `id` tie-breakers to dynamic column sorting.
  - `StageTaskManagerModal.tsx`: sort `activeTasks` deterministically before generating Tiptap initial HTML.
  - `TodayTasksSection.tsx`: add `sortOrder`, `createdAt`, and `id` tie-breakers for due tasks.
  - `DailyQuadrants.tsx`: add `createdAt` and `id` tie-breakers to quadrant task sorting.

## Risks / Trade-offs

- [Risk]: Changing task order might surprise users accustomed to the previous reversed creation order in some views.
  → Mitigation: The new comparator prioritizes uncompleted tasks, explicit `sortOrder`, and creation timestamps, matching natural user expectations while eliminating random jumps.
