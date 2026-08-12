import type { QueryKey } from "@tanstack/react-query";

const pending = new Map<string, number>();

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
