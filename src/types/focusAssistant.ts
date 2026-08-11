export type FocusSessionType = "focus" | "rest";
export type FocusSessionStatus = "running" | "paused" | "completed" | "interrupted";

export interface FocusSession {
  id: string;
  cycleId: string;
  taskId: string | null;
  type: FocusSessionType;
  status: FocusSessionStatus;
  plannedMinutes: number;
  activeSeconds: number;
  restCompleted: boolean;
  startedAt: string;
  endedAt: string | null;
}
