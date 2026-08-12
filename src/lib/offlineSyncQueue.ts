import { DataSyncError, toDataSyncError } from "@/lib/sync";
import { userStorageKey } from "@/lib/userStorage";

export type OfflineOperation = {
  id: string;
  kind: string;
  /** Replaces an older pending operation for the same entity. */
  key: string;
  payload: unknown;
  createdAt: number;
  state: "pending" | "conflict";
  error?: string;
};

type Executor = (payload: unknown) => Promise<void>;
const executors = new Map<string, Executor>();
const STORAGE_KEY = "fishbuddy_offline_operations_v1";

function readQueue(): OfflineOperation[] {
  try { return JSON.parse(localStorage.getItem(userStorageKey(STORAGE_KEY)) ?? "[]"); } catch { return []; }
}
function writeQueue(items: OfflineOperation[]) {
  localStorage.setItem(userStorageKey(STORAGE_KEY), JSON.stringify(items));
}

export function registerOfflineExecutor(kind: string, executor: Executor): void {
  executors.set(kind, executor);
}

export async function runOrQueue<T>(operation: Omit<OfflineOperation, "id" | "createdAt" | "state">, remote: () => Promise<T>): Promise<T | undefined> {
  try {
    return await remote();
  } catch (error) {
    const syncError = toDataSyncError(error, "同步失败");
    const networkFailure = syncError.state === "offline" ||
      syncError.originalError instanceof TypeError ||
      /network|fetch|connection|timeout/i.test(syncError.message);
    if (!networkFailure) throw syncError;
    const queue = readQueue().filter((item) => item.key !== operation.key);
    queue.push({ ...operation, id: crypto.randomUUID(), createdAt: Date.now(), state: "pending" });
    writeQueue(queue);
    return undefined;
  }
}

/** Replays persisted operations once; transient failures remain queued. */
export async function flushOfflineQueue(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  for (const item of readQueue()) {
    if (item.state === "conflict") continue;
    const executor = executors.get(item.kind);
    if (!executor) continue;
    try {
      await executor(item.payload);
      writeQueue(readQueue().filter((candidate) => candidate.id !== item.id));
    } catch (error) {
      const syncError = toDataSyncError(error, "同步失败");
      if (syncError.state === "offline") return;
      const queue = readQueue().map((candidate) => candidate.id === item.id
        ? { ...candidate, state: "conflict" as const, error: syncError.message }
        : candidate);
      writeQueue(queue);
    }
  }
}

export function hasVersionConflict(error: unknown): boolean {
  return error instanceof DataSyncError && /VERSION_CONFLICT/i.test(error.message);
}
