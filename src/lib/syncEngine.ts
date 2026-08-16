export const queryKeys = {
  lists: {
    all: (userId: string) => ['lists', userId, 'all'] as const,
    contents: (userId: string, listId: string) => ['lists', userId, 'contents', listId] as const,
    note: (userId: string, noteId: string) => ['lists', userId, 'note', noteId] as const,
  },
  habits: (userId: string) => ['habits', userId] as const,
  dailyReviews: (userId: string) => ['dailyReviews', userId] as const,
  templates: (userId: string) => ['knowledge_base_templates', userId] as const,
  timeManagement: (userId: string) => ['time-management-tasks', userId] as const,
  focusAssistantTasks: (userId: string) => ['focus-assistant-tasks', userId] as const,
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


