# Core beliefs

**Status:** Accepted

These beliefs constrain architecture and implementation choices across domains. They are not feature specifications or a replacement for database migrations.

1. **Migrations are the database source of truth.** A live schema snapshot is evidence, but new database behavior is introduced through a reviewed migration rather than by editing prior history.
2. **The UI may be optimistic; the server remains authoritative.** Local cache can make an interaction immediate, but RPC results and RLS-protected reads replace client assumptions.
3. **Broadcasts are minimal invalidation hints, never authoritative row replicas.** A message identifies affected scope; the client invalidates a narrow Query key and refetches.
4. **User isolation is enforced by RLS, not by client convention.** Every user-owned resource has an ownership-aware database boundary; a hidden UI control is not authorization.
5. **Load only the data needed for the active surface.** Knowledge shell data loads before selected-list contents and note bodies; inactive rich content is not a default payload.
6. **Preserve recoverable user intent through offline replay and explicit conflicts.** Retryable supported operations can be queued; stale versioned writes remain conflicts instead of being silently overwritten.
7. **Database audit timestamps are authoritative.** Clients carry only the version last observed and use the database-returned version after a write.
8. **State-transition facts are committed by the database.** Soft deletion, completion, focus-session boundaries, and initial order are not guessed from a client clock.

## Consequences for changes

| If changing | Preserve | Primary evidence |
| --- | --- | --- |
| Schema, RPCs, or triggers | Append-only migration history, RLS, grants, and database-owned facts. | `supabase/migrations/`, [generated snapshot](/generated/db-schema) |
| Query or mutation code | Query/store split, version replacement, precise invalidation, and explicit errors. | `src/hooks/`, `src/services/`, `src/lib/` |
| Knowledge UI | Shell-first and note-body-on-demand loading. | `src/hooks/useKnowledgeQuery.ts`, `src/services/knowledgeService.ts` |
| Realtime or windows | Private user topic and hint/refetch model. | `src/lib/realtimeManager.ts`, [sync decision](sync-and-editor-consistency.md) |
| Offline behavior | Existing executor registration, per-entity replacement, replay, and conflict retention. | `src/lib/offlineSyncQueue.ts` |

## Enforcement and limits

Strict TypeScript and `pnpm build` catch type and compilation errors; migrations enforce database behavior. The repository has no configured automated tests, lint suite, or CI workflow to enforce these beliefs end-to-end. For implementation-specific checks, follow [sync-and-editor consistency](sync-and-editor-consistency.md), [Security](/SECURITY), and [Reliability](/RELIABILITY).
