import { supabase } from "@/lib/supabase";
import type { FocusSession, FocusSessionStatus, FocusSessionType } from "@/types/focusAssistant";
import { throwOnPostgrestError } from "@/lib/sync";

type CreateSession = Omit<FocusSession, "id" | "endedAt">;

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
    const session: FocusSession = { ...input, id: crypto.randomUUID(), endedAt: null };
    const { error } = await supabase.rpc("create_focus_session", {
      p_id: session.id, p_cycle_id: session.cycleId, p_task_id: session.taskId,
      p_type: session.type, p_status: session.status,
      p_planned_minutes: session.plannedMinutes, p_active_seconds: session.activeSeconds,
      p_rest_completed: session.restCompleted, p_started_at: session.startedAt,
    });
    throwOnPostgrestError(error, "创建专注记录");
    return session;
  },
  async update(id: string, updates: Partial<Pick<FocusSession, "status" | "activeSeconds" | "restCompleted" | "endedAt">>): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.activeSeconds !== undefined) payload.active_seconds = updates.activeSeconds;
    if (updates.restCompleted !== undefined) payload.rest_completed = updates.restCompleted;
    if (updates.endedAt !== undefined) payload.ended_at = updates.endedAt;
    const { error } = await supabase.from("focus_sessions").update(payload).eq("id", id);
    throwOnPostgrestError(error, "更新专注记录");
  },
  async markOpenSessionsInterrupted(): Promise<void> {
    const endedAt = new Date().toISOString();
    const { error } = await supabase
      .from("focus_sessions")
      .update({ status: "interrupted", ended_at: endedAt })
      .in("status", ["running", "paused"])
      .is("ended_at", null);
    throwOnPostgrestError(error, "中断专注记录");
  },
  fromDb,
};
