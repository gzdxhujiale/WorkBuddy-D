import { useRef, useEffect, useCallback } from "react";
import { useQueryClient, QueryKey } from "@tanstack/react-query";

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

  const syncFnRef = useRef(syncFn);
  syncFnRef.current = syncFn;

  // Flush pending changes to remote persistence layer immediately
  const flush = useCallback(async (onlyKey?: string) => {
    const keys = onlyKey ? [onlyKey] : [...pendingVarsRef.current.keys()];
    await Promise.all(keys.map(async (key) => {
      const timer = timerRef.current.get(key);
      if (timer) clearTimeout(timer);
      timerRef.current.delete(key);
      const payload = pendingVarsRef.current.get(key);
      if (payload !== undefined) {
        pendingVarsRef.current.delete(key);
        const version = versionRef.current.get(key) ?? 0;
      try {
        await syncFnRef.current(payload);
      } catch (err) {
        console.error("[useOptimisticSync] Sync persistence error:", err);
        // Do not overwrite a newer local edit made while this request was in flight.
        if ((versionRef.current.get(key) ?? 0) === version) {
          queryClient.setQueryData(queryKey, previousDataRef.current.get(key));
        }
      }
      }
    }));
  }, [queryClient, queryKey]);

  // Trigger optimistic cache update and schedule debounced sync
  const trigger = useCallback(
    (vars: TVariables) => {
      const key = getSyncKey(vars);
      // 1. Immediate optimistic UI update
      const before = queryClient.getQueryData<TData>(queryKey);
      queryClient.setQueryData<TData>(queryKey, (old) => updateCache(old, vars));
      previousDataRef.current.set(key, before);
      pendingVarsRef.current.set(key, vars);
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
      for (const payload of pendingVarsRef.current.values()) {
        syncFnRef.current(payload).catch((err) => {
          console.error("[useOptimisticSync] Unmount flush failed:", err);
        });
      }
    };
  }, []);

  return {
    trigger,
    flush,
  };
}
