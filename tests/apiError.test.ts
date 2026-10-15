import { describe, it, expect } from "vitest";
import { ApiHttpError } from "@/lib/apiClient";
import { toDataSyncError, isVersionConflictError, DataSyncError } from "@/lib/sync";
import { hasVersionConflict } from "@/lib/offlineSyncQueue";

describe("ApiHttpError and Optimistic Concurrency Conflict Detection", () => {
  it("ApiHttpError inherits from native Error and preserves status, message, and data", () => {
    const err = new ApiHttpError(409, "VERSION_CONFLICT or note not found", { lock_version: 3 });

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiHttpError);
    expect(err.name).toBe("ApiHttpError");
    expect(err.status).toBe(409);
    expect(err.message).toBe("VERSION_CONFLICT or note not found");
    expect(err.data).toEqual({ lock_version: 3 });
  });

  it("toDataSyncError preserves ApiHttpError message and wraps it cleanly", () => {
    const apiErr = new ApiHttpError(409, "VERSION_CONFLICT or task not found");
    const syncErr = toDataSyncError(apiErr, "同步失败");

    expect(syncErr).toBeInstanceOf(DataSyncError);
    expect(syncErr.message).toBe("VERSION_CONFLICT or task not found");
    expect(syncErr.originalError).toBe(apiErr);
  });

  it("hasVersionConflict returns true for 409 ApiHttpError directly and wrapped", () => {
    const direct409 = new ApiHttpError(409, "Conflict");
    expect(hasVersionConflict(direct409)).toBe(true);

    const directVersionConflict = new ApiHttpError(400, "VERSION_CONFLICT: stale version");
    expect(hasVersionConflict(directVersionConflict)).toBe(true);

    const wrapped409 = toDataSyncError(direct409, "同步失败");
    expect(hasVersionConflict(wrapped409)).toBe(true);

    const nativeErrorWithConflict = new Error("Transaction rolled back: VERSION_CONFLICT");
    expect(hasVersionConflict(nativeErrorWithConflict)).toBe(true);
  });

  it("hasVersionConflict returns false for non-conflict errors", () => {
    const err500 = new ApiHttpError(500, "Internal Server Error");
    expect(hasVersionConflict(err500)).toBe(false);

    const genericSyncErr = toDataSyncError(err500, "同步失败");
    expect(hasVersionConflict(genericSyncErr)).toBe(false);

    const plainError = new Error("Network timeout");
    expect(hasVersionConflict(plainError)).toBe(false);
  });
});
