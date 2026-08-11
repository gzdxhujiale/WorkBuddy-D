export type QuadrantType = 'Q1' | 'Q2' | 'Q3' | 'Q4';
export type ScheduleMode = 'point' | 'range';

export interface Role {
  id: string;
  name: string;
  color?: string;
  sort_order?: number;
}

export interface TaskReminder {
  offsetDays: number;
  time: string;
  repeat?: boolean;
}

export interface Task {
  id: string;
  title: string;
  quadrant: QuadrantType;
  roleId?: string;
  /** 单个截止时间（point）或时间段结束时间（range）。 */
  scheduleMode?: ScheduleMode;
  scheduledStartAt?: number;
  scheduledEndAt?: number;
  completed: boolean;
  completedAt?: number;
  description?: string;
  reminder?: string;
  createdAt: number;
}

export interface TaskDraft {
  title: string;
  description?: string;
  scheduleMode?: ScheduleMode;
  scheduledStartAt?: number;
  scheduledEndAt?: number;
  reminder?: string;
  roleId?: string;
}

export interface TimeManagementData {
  roles: Role[];
  tasks: Task[];
}

export const QUADRANT_DB_MAP: Record<QuadrantType, string> = {
  Q1: 'Q1_URGENT_IMPORTANT',
  Q2: 'Q2_NOT_URGENT_IMPORTANT',
  Q3: 'Q3_URGENT_NOT_IMPORTANT',
  Q4: 'Q4_NOT_URGENT_NOT_IMPORTANT',
};

export const DB_QUADRANT_MAP: Record<string, QuadrantType> = {
  Q1_URGENT_IMPORTANT: 'Q1',
  Q2_NOT_URGENT_IMPORTANT: 'Q2',
  Q3_URGENT_NOT_IMPORTANT: 'Q3',
  Q4_NOT_URGENT_NOT_IMPORTANT: 'Q4',
  Q1: 'Q1',
  Q2: 'Q2',
  Q3: 'Q3',
  Q4: 'Q4',
};

export function parseReminder(raw?: string): TaskReminder | null {
  if (!raw) return null;
  try {
    const json = JSON.parse(raw);
    if (typeof json === 'object' && json !== null && 'offsetDays' in json) {
      return json as TaskReminder;
    }
  } catch {
    // legacy string format ignored
  }
  return null;
}

export function serializeReminder(rem: TaskReminder | null): string | undefined {
  if (!rem) return undefined;
  return JSON.stringify(rem);
}

export function reminderLabel(rem: TaskReminder | null): string {
  if (!rem) return '';
  const dayText = rem.offsetDays === 0 ? '当天' : `${rem.offsetDays}天前`;
  return `${dayText} ${rem.time}`;
}
