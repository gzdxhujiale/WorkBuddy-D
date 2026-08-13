import { useRef, useEffect, useCallback } from "react";
import { useQueryClient, QueryKey } from "@tanstack/react-query";
import { markQueryPending, clearQueryPending } from "@/lib/queryPending";

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
  const previousDataRef = useRef(new Map<string, TData | undefined>());
  const timerRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const versionRef = useRef(new Map<string, number>());
  const inFlightKeysRef = useRef(new Set<string>());
  const flushRef = useRef<(onlyKey?: string) => Promise<void>>(async () => {});

  const syncFnRef = useRef(syncFn);
  syncFnRef.current = syncFn;

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
      try {
        await syncFnRef.current(payload);
        clearQueryPending(queryKey);
      } catch (err) {
        console.error("[useOptimisticSync] Sync persistence error:", err);
        // Do not overwrite a newer local edit made while this request was in flight.
        if ((versionRef.current.get(key) ?? 0) === version) {
          queryClient.setQueryData(queryKey, previousDataRef.current.get(key));
          clearQueryPending(queryKey);
        }
      } finally {
        inFlightKeysRef.current.delete(key);
        if (pendingVarsRef.current.has(key)) {
          queueMicrotask(() => { void flushRef.current(key); });
        }
      }
    }));
  }, [queryClient, queryKey]);
  flushRef.current = flush;

  // Trigger optimistic cache update and schedule debounced sync
  const trigger = useCallback(
    (vars: TVariables) => {
      const key = getSyncKey(vars);
      // 1. Immediate optimistic UI update
      const before = queryClient.getQueryData<TData>(queryKey);
      queryClient.setQueryData<TData>(queryKey, (old) => updateCache(old, vars));
      previousDataRef.current.set(key, before);
      pendingVarsRef.current.set(key, vars);
      markQueryPending(queryKey);
      versionRef.current.set(key, (versionRef.current.get(key) ?? 0) + 1);

      if (debounceMs <= 0) {
        void flush(key);
        return;
      }

      const previousTimer = timerRef.current.get(key);
      if (previousTimer) clearTimeout(previousTimer);

      timerRef.current.set(key, setTimeout(() => { void flush(key); }, debounceMs));
    },
    [queryClient, queryKey, updateCache, debounceMs, flush, getSyncKey]
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
        syncFnRef.current(payload)
          .then(() => clearQueryPending(queryKey))
          .catch((err) => {
            clearQueryPending(queryKey);
            console.error("[useOptimisticSync] Unmount flush failed:", err);
          })
          .finally(() => {
            inFlightKeysRef.current.delete(key);
            if (pendingVarsRef.current.has(key)) {
              void flushRef.current(key);
            }
          });
      }
    };
  }, []);

  return {
    trigger,
    flush,
  };
}
