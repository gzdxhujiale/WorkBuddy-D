import type { QueryKey } from "@tanstack/react-query";

/**
 * A query can have several independent optimistic writers.  Counted marks are
 * unsafe for debounced writes because many edits can collapse into one request;
 * use stable lifecycle tokens instead so one settled write releases exactly its
 * own pending state.
 */
const pending = new Map<string, Set<string>>();
const pendingScopes = new Map<string, number>();

function keyOf(queryKey: QueryKey) {
  return JSON.stringify(queryKey);
}

export function markQueryPending(queryKey: QueryKey, token = "default") {
  const key = keyOf(queryKey);
  const tokens = pending.get(key) ?? new Set<string>();
  tokens.add(token);
  pending.set(key, tokens);
}

export function clearQueryPending(queryKey: QueryKey, token = "default") {
  const key = keyOf(queryKey);
  const tokens = pending.get(key);
  if (!tokens) return;
  tokens.delete(token);
  if (tokens.size === 0) pending.delete(key);
}

export function isQueryPending(queryKey: QueryKey) {
  const target = queryKey.map(String);
  for (const [serialized, tokens] of pending) {
    if (tokens.size === 0) continue;
    const pendingKey = JSON.parse(serialized) as unknown[];
    if (target.every((part, index) => String(pendingKey[index]) === part)) return true;
  }
  return false;
}

/**
 * Marks a domain-wide synchronization operation. Use this when one mutation
 * affects several query keys and incoming Broadcast hints must wait until the
 * local optimistic write has settled.
 */
export function markPendingScope(scope: string) {
  pendingScopes.set(scope, (pendingScopes.get(scope) ?? 0) + 1);
}

export function clearPendingScope(scope: string) {
  const count = pendingScopes.get(scope) ?? 0;
  if (count <= 1) pendingScopes.delete(scope);
  else pendingScopes.set(scope, count - 1);
}

export function isPendingScope(scope: string) {
  return (pendingScopes.get(scope) ?? 0) > 0;
}
