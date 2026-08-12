let activeUserId: string | null = null;

/**
 * Keeps browser-only offline caches separated between signed-in accounts.
 * Services are intentionally synchronous around localStorage, so the active
 * identity is set by the application when Supabase auth changes.
 */
export function setStorageUserId(userId: string | null): void {
  activeUserId = userId;
}

export function userStorageKey(key: string): string {
  if (!activeUserId) {
    throw new Error("Cannot access user data cache before authentication is ready.");
  }
  return `${key}:${activeUserId}`;
}
