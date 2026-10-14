import { apiClient } from "@/lib/apiClient";
import type { FocusSession, FocusSessionStatus, FocusSessionType } from "../types";
import { createFocusSessionId } from "@/lib/entityIds";

type CreateSession = Omit<FocusSession, "id" | "startedAt" | "endedAt">;

function fromDb(row: Record<string, unknown>): FocusSession {
  return {
    id: row.id as string,
    cycleId: (row.cycle_id || row.cycleId) as string,
    taskId: (row.task_id || row.taskId) as string | null,
    type: row.type as FocusSessionType,
    status: row.status as FocusSessionStatus,
    plannedMinutes: (row.planned_minutes ?? row.plannedMinutes) as number,
    activeSeconds: (row.active_seconds ?? row.activeSeconds) as number,
    restCompleted: (row.rest_completed ?? row.restCompleted) as boolean,
    startedAt: (row.started_at || row.startedAt) as string,
    endedAt: (row.ended_at || row.endedAt) as string | null,
  };
}

export interface FocusStats {
  todayMinutes: number;
  weekMinutes: number;
}

export const focusAssistantApi = {
  async getFocusStats(_userId?: string): Promise<FocusStats> {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    try {
      const data = await apiClient.get<Array<{ active_seconds: number; started_at: string; type?: string; status?: string }>>(
        `/api/v1/focus/sessions?since=${encodeURIComponent(monday.toISOString())}`
      );
      if (!data) return { todayMinutes: 0, weekMinutes: 0 };

      let todaySec = 0;
      let weekSec = 0;
      const todayStartTime = todayStart.getTime();

      for (const session of data) {
        // 严格仅统计专注会话，剔除休息时段 (type: 'rest')
        const sessType = session.type || "focus";
        if (sessType !== "focus") continue;

        const sec = session.active_seconds || 0;
        const started = new Date(session.started_at).getTime();
        weekSec += sec;
        if (started >= todayStartTime) {
          todaySec += sec;
        }
      }

      return {
        todayMinutes: Math.round(todaySec / 60),
        weekMinutes: Math.round(weekSec / 60),
      };
    } catch {
      return { todayMinutes: 0, weekMinutes: 0 };
    }
  },
  async create(input: CreateSession): Promise<FocusSession> {
    const focusSessionId = createFocusSessionId();
    const data = await apiClient.post<Record<string, unknown>>("/api/v1/focus/sessions", {
      id: focusSessionId,
      cycle_id: input.cycleId,
      task_id: input.taskId,
      type: input.type,
      status: input.status,
      planned_minutes: input.plannedMinutes,
      active_seconds: input.activeSeconds,
      rest_completed: input.restCompleted,
    });
    return fromDb(data);
  },
  async update(id: string, updates: Partial<Pick<FocusSession, "status" | "activeSeconds" | "restCompleted">>): Promise<void> {
    await apiClient.put(`/api/v1/focus/sessions/${id}`, {
      status: updates.status,
      active_seconds: updates.activeSeconds,
      rest_completed: updates.restCompleted,
    });
  },
  async markOpenSessionsInterrupted(): Promise<void> {
    await apiClient.post("/api/v1/focus/interrupt");
  },
  fromDb,
};
