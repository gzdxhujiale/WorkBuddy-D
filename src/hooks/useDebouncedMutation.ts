import { useRef, useEffect, useCallback } from "react";

type DebouncedMutationOptions = {
  /** Called once while a key has either a queued or an in-flight task. */
  onTaskStateChange?: (key: string, pending: boolean) => void;
};

export function useDebouncedMutation(options: DebouncedMutationOptions = {}) {
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingTasksRef = useRef<Map<string, () => Promise<void>>>(new Map());
  const inFlightRef = useRef<Set<string>>(new Set());
  const drainWaitersRef = useRef<Map<string, Array<() => void>>>(new Map());
  const onTaskStateChangeRef = useRef(options.onTaskStateChange);
  const runRef = useRef<(key: string) => Promise<void>>(async () => {});

  onTaskStateChangeRef.current = options.onTaskStateChange;

  const setPendingState = useCallback((key: string, pending: boolean) => {
    onTaskStateChangeRef.current?.(key, pending);
  }, []);

  const resolveDrainWaiters = useCallback((key: string) => {
    const waiters = drainWaitersRef.current.get(key) ?? [];
    drainWaitersRef.current.delete(key);
    waiters.forEach((resolve) => resolve());
  }, []);

  const run = useCallback(async (key: string) => {
    if (inFlightRef.current.has(key)) return;

    const task = pendingTasksRef.current.get(key);
    if (!task) return;
    pendingTasksRef.current.delete(key);
    inFlightRef.current.add(key);

    try {
      await task();
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[DebouncedMutation] Task execution failed for ${key}`, err);
      }
    } finally {
      inFlightRef.current.delete(key);

      if (pendingTasksRef.current.has(key)) {
        // A newer edit arrived while this request was in flight. Its debounce
        // may already have elapsed, so immediately drain it after this write.
        if (!timersRef.current.has(key)) void runRef.current(key);
      } else {
        setPendingState(key, false);
        resolveDrainWaiters(key);
      }
    }
  }, [resolveDrainWaiters, setPendingState]);

  runRef.current = run;

  const schedule = useCallback((key: string, fn: () => Promise<void>, delayMs: number) => {
    const wasIdle = !timersRef.current.has(key)
      && !pendingTasksRef.current.has(key)
      && !inFlightRef.current.has(key);
    if (wasIdle) setPendingState(key, true);

    const existingTimer = timersRef.current.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
      timersRef.current.delete(key);
    }

    pendingTasksRef.current.set(key, fn);

    const timer = setTimeout(() => {
      timersRef.current.delete(key);
      void runRef.current(key);
    }, delayMs);

    timersRef.current.set(key, timer);
  }, [setPendingState]);

  const cancel = useCallback((key: string) => {
    const existingTimer = timersRef.current.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
      timersRef.current.delete(key);
    }
    pendingTasksRef.current.delete(key);
    if (!inFlightRef.current.has(key)) {
      setPendingState(key, false);
      resolveDrainWaiters(key);
    }
  }, [resolveDrainWaiters, setPendingState]);

  const flush = useCallback(async (key: string) => {
    const existingTimer = timersRef.current.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
      timersRef.current.delete(key);
    }
    await runRef.current(key);
    if (!inFlightRef.current.has(key) && !pendingTasksRef.current.has(key)) return;
    await new Promise<void>((resolve) => {
      const waiters = drainWaitersRef.current.get(key) ?? [];
      waiters.push(resolve);
      drainWaitersRef.current.set(key, waiters);
    });
  }, []);

  useEffect(() => {
    return () => {
      const queuedKeys = new Set([
        ...timersRef.current.keys(),
        ...pendingTasksRef.current.keys(),
      ]);
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer);
      }
      timersRef.current.clear();
      pendingTasksRef.current.clear();
      for (const key of queuedKeys) {
        if (!inFlightRef.current.has(key)) {
          setPendingState(key, false);
          resolveDrainWaiters(key);
        }
      }
    };
  }, [resolveDrainWaiters, setPendingState]);

  return { schedule, cancel, flush };
}
