export type SyncState = "saving" | "saved" | "offline" | "failed";

export class DataSyncError extends Error {
  readonly state: Extract<SyncState, "offline" | "failed">;
  readonly originalError?: unknown;

  constructor(message: string, state: Extract<SyncState, "offline" | "failed"> = "failed", cause?: unknown) {
    super(message);
    this.name = "DataSyncError";
    this.state = state;
    this.originalError = cause;
  }
}

export function toDataSyncError(error: unknown, fallbackMessage: string): DataSyncError {
  if (error instanceof DataSyncError) return error;
  const message = error instanceof Error ? error.message : fallbackMessage;
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  return new DataSyncError(message || fallbackMessage, offline ? "offline" : "failed", error);
}

export function throwOnPostgrestError(error: { message: string } | null, action: string): void {
  if (!error) return;
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  throw new DataSyncError(`${action}失败：${error.message}`, offline ? "offline" : "failed", error);
}
