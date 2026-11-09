import type { ProjectStage, ProjectTask, TaskStageHistoryItem } from "@/types/project";
import { createTaskId } from "@/lib/entityIds";

/**
 * Sorts stages in ascending order of their sortOrder.
 */
export function getSortedStages(stages: ProjectStage[]): ProjectStage[] {
  return [...stages].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

/**
 * Checks whether the given stage is the terminal (last) stage in the project.
 */
export function isTerminalStage(stageId: string, stages: ProjectStage[]): boolean {
  const sorted = getSortedStages(stages);
  if (sorted.length === 0) return true;
  return sorted[sorted.length - 1].id === stageId;
}

/**
 * Aligns task scheduling dates with target stage start/end dates if configured.
 */
function alignTaskScheduleWithStage(_task: ProjectTask, targetStage: ProjectStage): Partial<ProjectTask> {
  if (targetStage.startDate && targetStage.endDate) {
    return {
      scheduleMode: "range",
      scheduledStartAt: new Date(targetStage.startDate).getTime(),
      scheduledEndAt: new Date(targetStage.endDate).getTime(),
    };
  }
  if (targetStage.endDate) {
    return {
      scheduleMode: "point",
      scheduledStartAt: undefined,
      scheduledEndAt: new Date(targetStage.endDate).getTime(),
    };
  }
  if (targetStage.startDate) {
    return {
      scheduleMode: "point",
      scheduledStartAt: undefined,
      scheduledEndAt: new Date(targetStage.startDate).getTime(),
    };
  }
  return {};
}

/**
 * Advances a task to the next stage in the pipeline upon checkbox click.
 * - If in a non-terminal stage:
 *   - Appends current stage to stageHistory as completed snapshot.
 *   - Advances task to next stage in uncompleted state.
 *   - Remaps assigneeName to target stage's defaultAssigneeName if present.
 *   - Aligns schedule dates to target stage if present.
 * - If in a terminal stage (or no stages):
 *   - Marks task globally completed (completed: true, completedAt: now).
 */
export function advanceTaskStage(
  task: ProjectTask,
  stages: ProjectStage[],
  now: number = Date.now()
): ProjectTask {
  const sorted = getSortedStages(stages);
  if (sorted.length === 0) {
    return {
      ...task,
      completed: true,
      completedAt: now,
      updatedAt: now,
    };
  }

  const currentIndex = sorted.findIndex((s) => s.id === task.projectStageId);
  // If current stage is not found or is the last stage, it's terminal
  if (currentIndex === -1 || currentIndex >= sorted.length - 1) {
    return {
      ...task,
      completed: true,
      completedAt: now,
      updatedAt: now,
    };
  }

  const currentStage = sorted[currentIndex];
  const nextStage = sorted[currentIndex + 1];

  const existingHistory = task.stageHistory || [];
  const updatedHistory: TaskStageHistoryItem[] = [
    ...existingHistory.filter((h) => h.stageId !== currentStage.id),
    { stageId: currentStage.id, completedAt: now },
  ];

  const scheduleUpdates = alignTaskScheduleWithStage(task, nextStage);

  return {
    ...task,
    projectStageId: nextStage.id,
    completed: false,
    completedAt: undefined,
    stageHistory: updatedHistory,
    assigneeName: nextStage.defaultAssigneeName ?? task.assigneeName,
    ...scheduleUpdates,
    updatedAt: now,
  };
}

/**
 * Rolls back an active task to its previous stage.
 * - Removes previous stage and current stage from stageHistory.
 * - Moves projectStageId to previous stage.
 * - Resets completed state to false.
 * - Remaps assigneeName to previous stage defaultAssigneeName if present.
 */
export function rollbackTaskStage(
  task: ProjectTask,
  stages: ProjectStage[],
  now: number = Date.now()
): ProjectTask {
  const sorted = getSortedStages(stages);
  const currentIndex = sorted.findIndex((s) => s.id === task.projectStageId);

  if (currentIndex <= 0) {
    // Already in first stage or stage not found; cannot rollback
    return task;
  }

  const prevStage = sorted[currentIndex - 1];
  const currentStage = sorted[currentIndex];

  const updatedHistory = (task.stageHistory || []).filter(
    (h) => h.stageId !== prevStage.id && h.stageId !== currentStage.id
  );

  const scheduleUpdates = alignTaskScheduleWithStage(task, prevStage);

  return {
    ...task,
    projectStageId: prevStage.id,
    completed: false,
    completedAt: undefined,
    stageHistory: updatedHistory,
    assigneeName: prevStage.defaultAssigneeName ?? task.assigneeName,
    ...scheduleUpdates,
    updatedAt: now,
  };
}

/**
 * Direct completion bypassing intermediate stages (e.g. from context menu).
 * Marks task as globally completed immediately.
 */
export function directCompleteTask(
  task: ProjectTask,
  now: number = Date.now()
): ProjectTask {
  return {
    ...task,
    completed: true,
    completedAt: now,
    updatedAt: now,
  };
}

export interface StageCategorizedTasks {
  /** Active tasks currently in this stage (pending or completed in final stage) */
  active: ProjectTask[];
  /** Tasks that have passed this stage and left a completed snapshot here */
  snapshots: ProjectTask[];
}

/**
 * Filters and categorizes tasks belonging to a specific stage:
 * - Active: tasks currently assigned to this stage.
 * - Snapshots: tasks currently in subsequent stages that have this stage in their stageHistory.
 */
export function getStageCategorizedTasks(
  stageId: string,
  allProjectTasks: ProjectTask[]
): StageCategorizedTasks {
  const active: ProjectTask[] = [];
  const snapshots: ProjectTask[] = [];

  for (const task of allProjectTasks) {
    if (task.projectStageId === stageId) {
      active.push(task);
    } else if (task.stageHistory?.some((h) => h.stageId === stageId)) {
      snapshots.push(task);
    }
  }

  return { active, snapshots };
}

export interface ParsedStageTaskItem {
  taskId?: string;
  title: string;
  checked: boolean;
}

export interface StageTaskBatchMutations {
  creates: ProjectTask[];
  updates: ProjectTask[];
  deletes: string[];
}

/**
 * Computes creates, updates, and deletes from the editor's parsed task items.
 * Guaranteed idempotency and duplicate-id tolerance (e.g. from Enter/splitListItem).
 */
export function computeStageTaskMutations(
  parsedItems: ParsedStageTaskItem[],
  activeTasks: ProjectTask[],
  stage: ProjectStage,
  stages: ProjectStage[],
  createIdFn: () => string = createTaskId,
  now: number = Date.now()
): StageTaskBatchMutations {
  const creates: ProjectTask[] = [];
  const updates: ProjectTask[] = [];
  const seenTaskIds = new Set<string>();

  let nextSortOrder =
    activeTasks.reduce((max, t) => Math.max(max, t.sortOrder ?? -1), -1) + 1;

  for (const item of parsedItems) {
    // If item has a taskId and we have not seen it yet in this batch
    if (item.taskId && !seenTaskIds.has(item.taskId)) {
      const orig = activeTasks.find((t) => t.id === item.taskId);
      if (orig) {
        seenTaskIds.add(item.taskId);
        let nextTask: ProjectTask = {
          ...orig,
          title: item.title,
          updatedAt: now,
        };
        if (item.checked && !orig.completed) {
          nextTask = advanceTaskStage(nextTask, stages, now);
        } else if (!item.checked && orig.completed) {
          nextTask = { ...nextTask, completed: false, completedAt: undefined, updatedAt: now };
        }
        updates.push(nextTask);
        continue;
      }
    }

    // Otherwise: It is a newly added task line!
    // (Either taskId was undefined, or was duplicated on splitListItem from an existing task)
    let newTask: ProjectTask = {
      id: createIdFn(),
      title: item.title,
      projectId: stage.projectId,
      projectStageId: stage.id,
      assigneeName: stage.defaultAssigneeName,
      priority: "medium",
      completed: false,
      quadrant: "Q2",
      sortOrder: nextSortOrder++,
      createdAt: now,
      updatedAt: now,
    };
    if (item.checked) {
      newTask = advanceTaskStage(newTask, stages, now);
    }
    creates.push(newTask);
  }

  const deletes: string[] = activeTasks
    .filter((t) => !seenTaskIds.has(t.id))
    .map((t) => t.id);

  return { creates, updates, deletes };
}

