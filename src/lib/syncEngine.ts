export const queryKeys = {
  lists: {
    all: (userId: string) => ['lists', userId, 'all'] as const,
    contents: (userId: string, listId: string) => ['lists', userId, 'contents', listId] as const,
    note: (userId: string, noteId: string) => ['lists', userId, 'note', noteId] as const,
  },
  habits: (userId: string) => ['habits', userId] as const,
  dailyReviews: Object.assign(
    (userId: string) => ['dailyReviews', userId] as const,
    {
      all: (userId: string) => ['dailyReviews', userId, 'all'] as const,
      summaries: (userId: string) => ['dailyReviews', userId, 'summaries'] as const,
      detail: (userId: string, date: string) => ['dailyReviews', userId, 'detail', date] as const,
      stats: (userId: string) => ['dailyReviews', userId, 'stats'] as const,
      heatmap: (userId: string, year: number) => ['dailyReviews', userId, 'heatmap', year] as const,
      snapshots: (userId: string, date: string) => ['dailyReviews', userId, 'snapshots', date] as const,
      snapshotDetail: (userId: string, date: string, snapshotId: string) => ['dailyReviews', userId, 'snapshotDetail', date, snapshotId] as const,
    }
  ),
  notes: {
    snapshots: (noteId: string) => ['notes', noteId, 'snapshots'] as const,
    snapshotDetail: (noteId: string, snapshotId: string) => ['notes', noteId, 'snapshotDetail', snapshotId] as const,
  },
  templates: (userId: string) => ['knowledge_base_templates', userId] as const,
  timeManagement: (userId: string) => ['time-management-tasks', userId] as const,
  focusAssistantTasks: (userId: string) => ['focus-assistant-tasks', userId] as const,
  focusStats: (userId?: string | null) => ['focus-stats', userId || 'anonymous'] as const,
  projects: (userId: string) => ['projects', userId] as const,
};

export const HIGH_FREQ_DELAY = 300;
export const LOW_FREQ_DELAY = 1000;
/** Long-form text stays local while the user is actively typing. */
export const NOTE_EDIT_DELAY = 3000;

export function logSilent(scope: string, msg: string, err?: unknown): void {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[${scope}] ${msg}`, err);
  }
}

export function logError(scope: string, msg: string, err?: unknown): void {
  console.error(`[${scope}] ${msg}`, err);
}


