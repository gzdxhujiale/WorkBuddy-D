export const queryKeys = {
  lists: {
    all: (userId: string) => ['lists', userId, 'all'] as const,
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
  private pending = new Map<string, () => Promise<void> | void>();

  schedule(key: string, fn: () => Promise<void> | void, delayMs: number): void {
    this.cancel(key);
    this.pending.set(key, fn);
    const timer = setTimeout(() => {
      this.timers.delete(key);
      this.pending.delete(key);
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
    this.pending.delete(key);
  }

  async flush(key: string): Promise<void> {
    const timer = this.timers.get(key);
    if (timer) clearTimeout(timer);
    this.timers.delete(key);
    const job = this.pending.get(key);
    this.pending.delete(key);
    if (job) await job();
  }
}

export const sharedSyncEngine = new SharedSyncEngine();
