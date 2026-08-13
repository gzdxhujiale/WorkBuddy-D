import { supabase } from "@/lib/supabase";
import type { FocusSession, FocusSessionStatus, FocusSessionType } from "@/types/focusAssistant";
import { throwOnPostgrestError } from "@/lib/sync";

type CreateSession = Omit<FocusSession, "id" | "startedAt" | "endedAt">;

function fromDb(row: Record<string, unknown>): FocusSession {
  return {
    id: row.id as string, cycleId: row.cycle_id as string, taskId: row.task_id as string | null,
    type: row.type as FocusSessionType, status: row.status as FocusSessionStatus,
    plannedMinutes: row.planned_minutes as number, activeSeconds: row.active_seconds as number,
    restCompleted: row.rest_completed as boolean, startedAt: row.started_at as string,
    endedAt: row.ended_at as string | null,
  };
}

export const focusAssistantApi = {
  async create(input: CreateSession): Promise<FocusSession> {
    const id = crypto.randomUUID();
    const { data, error } = await supabase.rpc("create_focus_session", {
      p_id: id, p_cycle_id: input.cycleId, p_task_id: input.taskId,
      p_type: input.type, p_status: input.status,
      p_planned_minutes: input.plannedMinutes, p_active_seconds: input.activeSeconds,
      p_rest_completed: input.restCompleted,
    });
    throwOnPostgrestError(error, "创建专注记录");
    return { ...input, id, startedAt: data as string, endedAt: null };
  },
  async update(id: string, updates: Partial<Pick<FocusSession, "status" | "activeSeconds" | "restCompleted">>): Promise<void> {
    const { error } = await supabase.rpc("update_focus_session", {
      p_id: id,
      p_status: updates.status,
      p_active_seconds: updates.activeSeconds,
      p_rest_completed: updates.restCompleted,
    });
    throwOnPostgrestError(error, "更新专注记录");
  },
  async markOpenSessionsInterrupted(): Promise<void> {
    const { error } = await supabase.rpc("interrupt_open_focus_sessions");
    throwOnPostgrestError(error, "中断专注记录");
  },
  fromDb,
};
