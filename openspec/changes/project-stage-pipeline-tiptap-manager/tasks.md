# Tasks

## 1. Data Contract & Stage History Models

- [x] 1.1 Extend `ProjectTask` and `Task` types with `stageHistory?: Array<{ stageId: string; completedAt: number }>` in `src/types/project.ts` and `src/types/task.ts`, and verify via `pnpm build`.
- [x] 1.2 Ensure backend tasks query and save handlers gracefully round-trip `stage_history` or task metadata, and verify with `go -C server test ./...`.

## 2. Stage Progression & Rollback Pipeline

- [x] 2.1 Implement pipeline transition logic (`advanceTaskStage` and `rollbackTaskStage`) in `src/features/projects/lib/stagePipeline.ts` managing stage advance, snapshot history, assignee remapping, and terminal stage global completion, verified with unit tests.
- [x] 2.2 Update `ProjectStageBoard.tsx` checkbox toggle handler to trigger stage progression in non-terminal stages and global completion in terminal stages, verifying active task movement and snapshot retention.
- [x] 2.3 Update stage task rendering in `ProjectStageBoard.tsx` to display historical completed snapshot cards with distinct read-only style and rollback capabilities for active cards.

## 3. Task Context Menu for Direct Actions

- [x] 3.1 Implement a right-click context menu on stage task cards in `ProjectStageBoard.tsx` offering "直接标记完成"、"退回上一阶段"与"删除任务"，并验证右键呼出与菜单项响应。
- [x] 3.2 Wire "直接标记完成" action to bypass intermediate pipeline stages, mark the task globally completed, and update project progress metrics.

## 4. Tiptap Stage Task Manager Modal

- [x] 4.1 Create `StageTaskManagerModal.tsx` embedding Tiptap `TaskList` and `TaskItem` extensions to render stage tasks as editable checklist items with Enter-to-add and Backspace-to-delete behaviors.
- [x] 4.2 Implement Diff parser on modal save to detect added tasks, renamed titles, deleted items, and checked items, applying atomic batch synchronization.
- [x] 4.3 Add the "管理任务" button to stage card headers in `ProjectStageBoard.tsx` and integrate `StageTaskManagerModal.tsx`, verifying that opening, batch editing, and saving synchronously updates the board.

## 5. End-to-End Verification & Boundaries

- [x] 5.1 Run `pnpm build` and `pnpm lint:boundaries` to ensure architecture compliance and zero type errors.
- [x] 5.2 Verify stage progression from Stage 1 through terminal stage, rollback, right-click direct completion, and Tiptap modal batch modifications in the browser.
