import type { QueryKey } from "@tanstack/react-query";

const pending = new Map<string, number>();
const pendingScopes = new Map<string, number>();

function keyOf(queryKey: QueryKey) {
  return JSON.stringify(queryKey);
}

export function markQueryPending(queryKey: QueryKey) {
  const key = keyOf(queryKey);
  pending.set(key, (pending.get(key) ?? 0) + 1);
}

export function clearQueryPending(queryKey: QueryKey) {
  const key = keyOf(queryKey);
  const count = pending.get(key) ?? 0;
  if (count <= 1) pending.delete(key);
  else pending.set(key, count - 1);
}

export function isQueryPending(queryKey: QueryKey) {
  const target = queryKey.map(String);
  for (const [serialized, count] of pending) {
    if (count <= 0) continue;
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
