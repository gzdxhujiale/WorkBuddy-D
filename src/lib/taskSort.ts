export interface TaskLike {
  id: string;
  completed?: boolean;
  scheduledStartAt?: number | null;
  scheduledEndAt?: number | null;
  sortOrder?: number | null;
  createdAt?: number | null;
  updatedAt?: number | null;
}

/**
 * Deterministic comparison for stage-bound tasks.
 * Hierarchy:
 * 1. Uncompleted tasks before completed tasks
 * 2. Explicit sortOrder (ascending: lower index appears first)
 * 3. Scheduled due/start time (earlier time appears first)
 * 4. Creation time (newer tasks first if unarranged)
 * 5. Unique ID (lexicographical tie-breaker for 100% mathematical stability)
 */
export function compareStageTasks<T extends TaskLike>(a: T, b: T): number {
  // 1. Completion status
  if (Boolean(a.completed) !== Boolean(b.completed)) {
    return a.completed ? 1 : -1;
  }

  // 2. Explicit sortOrder if defined and different
  const hasSortOrderA = a.sortOrder !== undefined && a.sortOrder !== null;
  const hasSortOrderB = b.sortOrder !== undefined && b.sortOrder !== null;
  if (hasSortOrderA && hasSortOrderB && a.sortOrder !== b.sortOrder) {
    return (a.sortOrder as number) - (b.sortOrder as number);
  }
  if (hasSortOrderA && !hasSortOrderB) return -1;
  if (!hasSortOrderA && hasSortOrderB) return 1;

  // 3. Due / Start date
  const timeA = a.scheduledEndAt || a.scheduledStartAt;
  const timeB = b.scheduledEndAt || b.scheduledStartAt;
  if (timeA && timeB && timeA !== timeB) {
    return timeA - timeB;
  }
  if (timeA && !timeB) return -1;
  if (!timeA && timeB) return 1;

  // 4. Creation time (DESC)
  const createdA = a.createdAt || 0;
  const createdB = b.createdAt || 0;
  if (createdA !== createdB) {
    return createdB - createdA;
  }

  // 5. Unique ID tie-breaker
  return a.id.localeCompare(b.id);
}

/**
 * Returns a new array of stage tasks sorted deterministically.
 */
export function sortStageTasks<T extends TaskLike>(tasks: T[]): T[] {
  return [...tasks].sort(compareStageTasks);
}

/**
 * Deterministic comparison for Eisenhower quadrant tasks.
 * Hierarchy:
 * 1. Uncompleted tasks before completed tasks
 * 2. Explicit sortOrder (descending: higher index appears first, matching drag-and-drop stack)
 * 3. Creation time (newer tasks first if unarranged)
 * 4. Unique ID tie-breaker
 */
export function compareQuadrantTasks<T extends TaskLike>(a: T, b: T): number {
  if (Boolean(a.completed) !== Boolean(b.completed)) {
    return a.completed ? 1 : -1;
  }

  const sortA = a.sortOrder ?? -1;
  const sortB = b.sortOrder ?? -1;
  if (sortA !== sortB) {
    return sortB - sortA;
  }

  const createdA = a.createdAt || 0;
  const createdB = b.createdAt || 0;
  if (createdA !== createdB) {
    return createdB - createdA;
  }

  return a.id.localeCompare(b.id);
}

/**
 * Returns a new array of quadrant tasks sorted deterministically.
 */
export function sortQuadrantTasks<T extends TaskLike>(tasks: T[]): T[] {
  return [...tasks].sort(compareQuadrantTasks);
}

/**
 * Deterministic comparison for Today workbench due tasks.
 * Hierarchy:
 * 1. Uncompleted tasks before completed tasks
 * 2. Overdue status (overdue tasks first)
 * 3. Scheduled due/start time (earlier deadline first)
 * 4. Explicit sortOrder (descending)
 * 5. Creation time (newer tasks first)
 * 6. Unique ID tie-breaker
 */
export function compareTodayTasks<T extends TaskLike>(
  a: T,
  b: T,
  now: number = Date.now()
): number {
  // 1. Completion status
  if (Boolean(a.completed) !== Boolean(b.completed)) {
    return a.completed ? 1 : -1;
  }

  // 2. Overdue status
  const aEnd = a.scheduledEndAt || a.scheduledStartAt;
  const bEnd = b.scheduledEndAt || b.scheduledStartAt;
  const aOverdue = Boolean(aEnd && aEnd < now && !a.completed);
  const bOverdue = Boolean(bEnd && bEnd < now && !b.completed);
  if (aOverdue !== bOverdue) {
    return aOverdue ? -1 : 1;
  }

  // 3. Deadline time
  const targetA = aEnd ?? Number.MAX_SAFE_INTEGER;
  const targetB = bEnd ?? Number.MAX_SAFE_INTEGER;
  if (targetA !== targetB) {
    return targetA - targetB;
  }

  // 4. sortOrder
  const sortA = a.sortOrder ?? -1;
  const sortB = b.sortOrder ?? -1;
  if (sortA !== sortB) {
    return sortB - sortA;
  }

  // 5. Creation time
  const createdA = a.createdAt || 0;
  const createdB = b.createdAt || 0;
  if (createdA !== createdB) {
    return createdB - createdA;
  }

  // 6. Unique ID tie-breaker
  return a.id.localeCompare(b.id);
}

/**
 * Returns a new array of today tasks sorted deterministically.
 */
export function sortTodayTasks<T extends TaskLike>(tasks: T[], now: number = Date.now()): T[] {
  return [...tasks].sort((a, b) => compareTodayTasks(a, b, now));
}
