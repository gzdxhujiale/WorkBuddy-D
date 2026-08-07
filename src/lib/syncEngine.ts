export const queryKeys = {
  lists: {
    all: ['lists', 'all'] as const,
  },
};

export const HIGH_FREQ_DELAY = 300;
export const LOW_FREQ_DELAY = 1000;

export function logSilent(scope: string, msg: string, err?: unknown): void {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[${scope}] ${msg}`, err);
  }
}

export function logError(scope: string, msg: string, err?: unknown): void {
  console.error(`[${scope}] ${msg}`, err);
}

class SharedSyncEngine {
  private timers = new Map<string, NodeJS.Timeout>();

  schedule(key: string, fn: () => Promise<void> | void, delayMs: number): void {
    this.cancel(key);
    const timer = setTimeout(() => {
      this.timers.delete(key);
      Promise.resolve(fn()).catch((e) => logError('SyncEngine', `Task execution failed for ${key}`, e));
    }, delayMs);
    this.timers.set(key, timer);
  }

  cancel(key: string): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }
}

export const sharedSyncEngine = new SharedSyncEngine();
