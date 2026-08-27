# Generated artifacts

This directory holds versioned reference snapshots derived from external or live system state. These files make current facts discoverable for agents, but they do not replace their authoritative sources.

| Artifact | Source of truth | Use it for |
| --- | --- | --- |
| [Live database snapshot](db-schema.md) | The connected Supabase project for installed state; `supabase/migrations/` for intended, versioned database behavior. | Current application tables, RLS/realtime model, database-owned facts, and refresh scope. |

## Refresh rules

- Refresh a snapshot from a verified live query or inspection, then record the project, date, and scope.
- Compare the live migration history with checked-in migrations; do not infer applied state only from a filename.
- Keep narrative architecture/design guidance outside this directory. If a generated fact changes an invariant, update the relevant durable document separately.
- Never hand-edit a table/policy/function fact merely to match frontend expectations; resolve the source discrepancy first.

For database changes, read [Security](../SECURITY.md), [ARCHITECTURE.md](../../ARCHITECTURE.md), and the relevant Supabase skill before changing migrations or snapshots.


