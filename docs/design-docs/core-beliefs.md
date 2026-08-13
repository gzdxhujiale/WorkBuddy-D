# Core beliefs

1. Migrations are the database source of truth.
2. The UI may be optimistic; the server remains authoritative.
3. Broadcasts are minimal invalidation hints, never authoritative row replicas.
4. User isolation is enforced by RLS, not by client convention.
5. Load only the data needed for the active surface; fetch rich note bodies on demand.
6. Preserve recoverable user intent through offline replay and explicit conflicts.
7. Database audit timestamps are authoritative; clients only carry the version they last observed.
8. State-transition facts—soft deletion, completion, session boundaries, and initial order—are committed by the database, not guessed by a client clock.
