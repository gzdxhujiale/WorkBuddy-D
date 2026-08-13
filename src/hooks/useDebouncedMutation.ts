import { useRef, useEffect, useCallback } from "react";

export function useDebouncedMutation() {
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingTasksRef = useRef<Map<string, () => Promise<void>>>(new Map());

  const schedule = useCallback((key: string, fn: () => Promise<void>, delayMs: number) => {
    const existingTimer = timersRef.current.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
      timersRef.current.delete(key);
    }

    pendingTasksRef.current.set(key, fn);

    const timer = setTimeout(() => {
      timersRef.current.delete(key);
      const task = pendingTasksRef.current.get(key);
      pendingTasksRef.current.delete(key);
      if (task) {
        void task().catch((err) => {
          if (process.env.NODE_ENV !== "production") {
            console.warn(`[DebouncedMutation] Task execution failed for ${key}`, err);
          }
        });
      }
    }, delayMs);

    timersRef.current.set(key, timer);
  }, []);

  const cancel = useCallback((key: string) => {
    const existingTimer = timersRef.current.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
      timersRef.current.delete(key);
    }
    pendingTasksRef.current.delete(key);
  }, []);

  const flush = useCallback(async (key: string) => {
    cancel(key);
    const task = pendingTasksRef.current.get(key);
    pendingTasksRef.current.delete(key);
    if (task) {
      await task();
    }
  }, [cancel]);

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer);
      }
      timersRef.current.clear();
      pendingTasksRef.current.clear();
    };
  }, []);

  return { schedule, cancel, flush };
}
