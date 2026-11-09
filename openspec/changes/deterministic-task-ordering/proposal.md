# Proposal

## Why

Currently, tasks belonging to the same project stage, Eisenhower quadrant, or Today's workbench list display random position jumps and unstable ordering across re-renders, optimistic updates, and background queries. This occurs because view sorting comparators return `0` when primary sorting criteria are equal (e.g. same deadline or default sort order), leaving task positioning to arbitrary memory array mutations without deterministic secondary/tertiary tie-breakers, while project task creation omits `sortOrder` allocation.

## What Changes

- Establish a unified, deterministic multi-tier task sorting specification:
  1. Completion state: uncompleted tasks precede completed tasks (unless explicitly grouped).
  2. Primary domain order: explicit `sortOrder` (lower values first / ascending) or target due timestamp.
  3. Secondary chronological order: creation timestamp (`createdAt DESC`, newly created tasks first if unarranged).
  4. Final deterministic tie-breaker: unique entity ID comparison (`a.id.localeCompare(b.id)`), guaranteeing mathematically stable, jitter-free ordering under all conditions.
- Align `sortOrder` semantics across front-end drag-and-drop, query caching, and PostgreSQL backend queries (`sort_order ASC`).
- Automatically assign sequential `sortOrder` when tasks are created within project stages and task manager modals, eliminating unindexed zero-order tasks.
- Apply consistent deterministic ordering to all project views (`ProjectStageBoard`, `ProjectGanttView`, `TodayProjectTimeline`, `ProjectTableView`) and modal initializers (`StageTaskManagerModal`).

## Capabilities

### Modified Capabilities

- `task-management`: Enforce deterministic multi-tier task ordering across quadrant listings, today's due task aggregation, and drag-and-drop reordering with persistent tie-breakers.
- `project-management`: Enforce deterministic stage-bound task ordering across stage boards, timeline groups, gantt charts, and task management editors.

## Impact

- Frontend:
  - `src/features/projects/lib/stagePipeline.ts`: Export standardized deterministic task comparator.
  - `src/features/time-management/lib/taskSort.ts`: Shared deterministic task sort helpers.
  - `src/features/projects/components/ProjectStageBoard.tsx`, `ProjectGanttView.tsx`, `TodayProjectTimeline.tsx`, `ProjectTableView.tsx`, `StageTaskManagerModal.tsx`: Consume deterministic sorters.
  - `src/features/time-management/components/DailyQuadrants.tsx`, `TodayTasksSection.tsx`: Consume deterministic sorters and align `sortOrder` direction.
  - `src/features/projects/hooks/useProjects.ts`: Allocate `sortOrder` on task creation.
- Backend:
  - No database migration required; existing `time_management_tasks.sort_order` and `created_at` are already indexed and supported.
