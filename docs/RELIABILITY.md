# Reliability

## Purpose

This document defines how WorkBuddy-D should behave when its client, network, database API, or desktop windows fail. It records current safeguards, not an SLA or an operations runbook; no SLO, alerting system, or production health-check configuration is present in this repository.

## Failure model

The application depends on a local Tauri runtime and Supabase Auth/PostgREST/RPC/Realtime. Relevant failures include missing or expired sessions, offline or transient network failures, Supabase outages, stale concurrent edits, missed Broadcast messages, secondary-window lifecycle changes, and process/window closure during focus work.

Failure handling must preserve the primary data contract. An error is not resolved by silently retrying through a weaker path, manufacturing a default business value, or bypassing a failed versioned RPC with a direct update. Supported resilience has an explicit durable/recovery design; all other failures remain visible to the caller or become a documented conflict.

## Reliability invariants

| Invariant | Current mechanism | Evidence |
| --- | --- | --- |
| A prior account’s cached data must not render after an auth transition. | Clear Query and UI state before applying the new session. | `src/App.tsx` |
| A retryable network failure must preserve supported user operations for later replay. | `runOrQueue` persists the latest operation per entity key and replays on main-window start/online. | `src/lib/offlineSyncQueue.ts`, supported services |
| A non-network failure must not masquerade as an offline replay. | Only classified network/offline failures are queued; other errors propagate. | `src/lib/offlineSyncQueue.ts`, `src/lib/sync.ts` |
| A stale client must not silently overwrite a versioned database record. | RPCs receive expected versions and return `VERSION_CONFLICT` on stale state. | Latest migrations, [sync decision](design-docs/sync-and-editor-consistency.md) |
| Realtime loss must not be treated as durable replication. | Broadcast only invalidates cache; normal RLS queries recover state. | `src/lib/realtimeManager.ts` |
| Supabase incidents must not trigger a client-wide request storm. | Query retries/reconnect/mount refetches are disabled; a 521 pauses auth refresh for 30 seconds. | `src/lib/queryClient.ts`, `src/lib/supabase.ts` |

## Offline and retry behavior

The offline queue is local, user-scoped storage. It replaces an older pending operation with the same key, skips conflict records during replay, retains transient failures, and marks other replay failures as `conflict`. The main webview flushes it after authentication and on the browser `online` event.

This behavior is not universal: only domains that call `runOrQueue` receive it. Do not claim that a new mutation is offline-safe until its service is explicitly registered and its replay behavior is verified.

## Concurrency, data recovery, and loading

The database owns versions, timestamps, state-transition facts, and initial order. Clients may render optimistic state but must replace it with returned database values and preserve a conflict rather than generating a new client version. Structural changes (move, reorder, soft delete) are version-checked database RPCs; a failed optimistic operation invalidates its active query rather than restoring a potentially stale whole-query snapshot.

Private Broadcast is deliberately lossy as a data channel. The client batches invalidations for 500 ms and rate-limits a repeated target for 2 seconds; active queries refetch through RLS. A missed event is recovered by normal loading rather than a replay queue.

Knowledge data is a controlled degradation boundary: the shell loads first, while list contents and note bodies load only when needed. This limits work on inactive surfaces but requires each feature to handle empty, loading, and failed on-demand reads.

## Desktop lifecycle

The main webview owns app-start behavior, offline replay, and the Supabase Broadcast subscription. Secondary webviews establish their own session gate. On main-window unload, focus sessions are marked interrupted through the constrained RPC; quick-edit drafts are discarded during an auth transition rather than committed under the next account.

## Observability and validation

The repository currently uses `console.warn`/`console.error` and `logSilent` for diagnostics. It has no configured centralized logs, metrics, traces, alerts, failure injection, or automated reliability suite.

For a changed failure path, manually verify the affected observable behavior: disconnect/reconnect where replay is expected, concurrent update conflict handling, secondary-window lifecycle, and a refetch after a Broadcast hint. Run `pnpm build` for frontend changes. Database changes also require migration/RLS/trigger review as described in [Security](SECURITY.md).

## Known gaps

- No automated coverage verifies offline replay, RLS/RPC behavior, Broadcast delivery, or cross-window synchronization.
- Query retries are intentionally disabled, but there is no documented operation-specific timeout or backoff policy beyond the 521 auth-refresh pause.
- Migration-history drift is tracked in [the technical-debt tracker](exec-plans/tech-debt-tracker.md).

Track substantial reliability work through [PLANS.md](PLANS.md) and update [QUALITY_SCORE.md](QUALITY_SCORE.md) after verified improvement.
