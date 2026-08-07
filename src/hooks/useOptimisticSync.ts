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
}

export function useOptimisticSync<TData, TVariables>({
  queryKey,
  updateCache,
  syncFn,
  debounceMs = 500,
}: OptimisticSyncOptions<TData, TVariables>) {
  const queryClient = useQueryClient();
  const pendingVarsRef = useRef<TVariables | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncFnRef = useRef(syncFn);
  syncFnRef.current = syncFn;

  // Flush pending changes to remote persistence layer immediately
  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingVarsRef.current !== null) {
      const payload = pendingVarsRef.current;
      pendingVarsRef.current = null;
      try {
        await syncFnRef.current(payload);
      } catch (err) {
        console.error("[useOptimisticSync] Sync persistence error:", err);
        queryClient.invalidateQueries({ queryKey });
      }
    }
  }, [queryClient, queryKey]);

  // Trigger optimistic cache update and schedule debounced sync
  const trigger = useCallback(
    (vars: TVariables) => {
      // 1. Immediate optimistic UI update
      queryClient.setQueryData<TData>(queryKey, (old) => updateCache(old, vars));
      pendingVarsRef.current = vars;

      if (debounceMs <= 0) {
        flush();
        return;
      }

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        flush();
      }, debounceMs);
    },
    [queryClient, queryKey, updateCache, debounceMs, flush]
  );

  // Unmount / route-change cleanup: ensure pending draft is safely flushed
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (pendingVarsRef.current !== null) {
        const payload = pendingVarsRef.current;
        pendingVarsRef.current = null;
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
