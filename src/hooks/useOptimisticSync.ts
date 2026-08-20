import { useRef, useEffect, useCallback } from "react";
import { useQueryClient, QueryKey } from "@tanstack/react-query";
import { markQueryPending, clearQueryPending } from "@/lib/queryPending";
import { toast } from "@/components/ui/toast";

let nextSyncOwnerId = 0;

type SyncState = "idle" | "pending" | "syncing";

export interface OptimisticSyncOptions<TData, TVariables> {
  /** React Query Cache Key */
  queryKey: QueryKey;
  /** Pure function to optimistically update the cached data (0ms delay UI response) */
  updateCache: (old: TData | undefined, vars: TVariables) => TData;
  /** Persistence API function (Supabase / local DB) */
  syncFn: (vars: TVariables) => Promise<void>;
  /** Debounce delay in ms (default: 500ms; set to 0 for instant async persistence) */
  debounceMs?: number;
  /** Distinguishes concurrent entities so an edit to B never cancels an edit to A. */
  getSyncKey?: (vars: TVariables) => string;
}

export function useOptimisticSync<TData, TVariables>({
  queryKey,
  updateCache,
  syncFn,
  debounceMs = 500,
  getSyncKey = () => "default",
}: OptimisticSyncOptions<TData, TVariables>) {
  const queryClient = useQueryClient();
  const pendingVarsRef = useRef(new Map<string, TVariables>());
  const timerRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const versionRef = useRef(new Map<string, number>());
  const inFlightKeysRef = useRef(new Set<string>());
  const stateRef = useRef(new Map<string, SyncState>());
  const ownerIdRef = useRef(`optimistic-sync:${++nextSyncOwnerId}`);
  const flushRef = useRef<(onlyKey?: string) => Promise<void>>(async () => {});

  const syncFnRef = useRef(syncFn);
  syncFnRef.current = syncFn;

  const pendingToken = useCallback(
    (key: string) => `${ownerIdRef.current}:${key}`,
    []
  );

  // Flush pending changes to remote persistence layer immediately.
  // A given entity is serialized: version-checked RPCs must never race.
  const flush = useCallback(async (onlyKey?: string) => {
    const keys = onlyKey ? [onlyKey] : [...pendingVarsRef.current.keys()];
    await Promise.all(keys.map(async (key) => {
      if (inFlightKeysRef.current.has(key)) {
        const pendingTimer = timerRef.current.get(key);
        if (pendingTimer) clearTimeout(pendingTimer);
        timerRef.current.delete(key);
        return;
      }

      const timer = timerRef.current.get(key);
      if (timer) clearTimeout(timer);
      timerRef.current.delete(key);
      const payload = pendingVarsRef.current.get(key);
      if (payload === undefined) return;

      pendingVarsRef.current.delete(key);
      const version = versionRef.current.get(key) ?? 0;
      inFlightKeysRef.current.add(key);
      stateRef.current.set(key, "syncing");
      try {
        await syncFnRef.current(payload);
      } catch (err) {
        console.error("[useOptimisticSync] Sync persistence error:", err);
        // Never restore a whole-query snapshot here: a failure for entity A
        // must not erase a newer optimistic edit for entity B. Refetch only
        // when this is still the newest operation for the entity.
        if ((versionRef.current.get(key) ?? 0) === version) {
          void queryClient.invalidateQueries({ queryKey, refetchType: "active" });
          toast.error("保存失败，已重新加载最新数据。");
        }
      } finally {
        inFlightKeysRef.current.delete(key);
        if (pendingVarsRef.current.has(key)) {
          stateRef.current.set(key, "pending");
          queueMicrotask(() => { void flushRef.current(key); });
        } else {
          stateRef.current.set(key, "idle");
          clearQueryPending(queryKey, pendingToken(key));
        }
      }
    }));
  }, [pendingToken, queryClient, queryKey]);
  flushRef.current = flush;

  // Trigger optimistic cache update and schedule debounced sync
  const trigger = useCallback(
    (vars: TVariables) => {
      const key = getSyncKey(vars);
      // 1. Immediate optimistic UI update
      queryClient.setQueryData<TData>(queryKey, (old) => updateCache(old, vars));
      pendingVarsRef.current.set(key, vars);
      stateRef.current.set(key, "pending");
      markQueryPending(queryKey, pendingToken(key));
      versionRef.current.set(key, (versionRef.current.get(key) ?? 0) + 1);

      if (debounceMs <= 0) {
        void flush(key);
        return;
      }

      const previousTimer = timerRef.current.get(key);
      if (previousTimer) clearTimeout(previousTimer);

      timerRef.current.set(key, setTimeout(() => { void flush(key); }, debounceMs));
    },
    [queryClient, queryKey, updateCache, debounceMs, flush, getSyncKey, pendingToken]
  );

  // Unmount / route-change cleanup: ensure pending draft is safely flushed
  useEffect(() => {
    return () => {
      for (const timer of timerRef.current.values()) clearTimeout(timer);
      timerRef.current.clear();

      // Remove a payload before dispatching it. React StrictMode and HMR can
      // invoke cleanup more than once; this makes that cleanup idempotent.
      // If a prior write is in flight, its finally block sends the newer value.
      for (const [key, payload] of [...pendingVarsRef.current.entries()]) {
        if (inFlightKeysRef.current.has(key)) continue;
        pendingVarsRef.current.delete(key);
        inFlightKeysRef.current.add(key);
        stateRef.current.set(key, "syncing");
        syncFnRef.current(payload)
          .catch((err) => {
            console.error("[useOptimisticSync] Unmount flush failed:", err);
            toast.error("离开页面前保存失败，已重新加载最新数据。");
          })
          .finally(() => {
            inFlightKeysRef.current.delete(key);
            if (pendingVarsRef.current.has(key)) {
              stateRef.current.set(key, "pending");
              void flushRef.current(key);
            } else {
              stateRef.current.set(key, "idle");
              clearQueryPending(queryKey, pendingToken(key));
            }
          });
      }
    };
  }, [pendingToken, queryKey]);

  return {
    trigger,
    flush,
  };
}
