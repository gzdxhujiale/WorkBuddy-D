import { ApiHttpError } from "./apiClient";

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

  let message = fallbackMessage;
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "object" && error !== null && "error" in error && typeof (error as any).error === "string") {
    message = (error as any).error;
  }

  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  return new DataSyncError(message || fallbackMessage, offline ? "offline" : "failed", error);
}

export function isVersionConflictError(error: unknown): boolean {
  if (error instanceof ApiHttpError) {
    return error.status === 409 || /VERSION_CONFLICT/i.test(error.message);
  }
  if (error instanceof DataSyncError) {
    if (error.originalError instanceof ApiHttpError && error.originalError.status === 409) {
      return true;
    }
    return /VERSION_CONFLICT/i.test(error.message);
  }
  if (error instanceof Error) {
    return /VERSION_CONFLICT/i.test(error.message);
  }
  return false;
}

export function throwOnPostgrestError(error: { message: string } | null, action: string): void {
  if (!error) return;
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  throw new DataSyncError(`${action}失败：${error.message}`, offline ? "offline" : "failed", error);
}
