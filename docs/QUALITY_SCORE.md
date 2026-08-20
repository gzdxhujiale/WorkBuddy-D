# Quality score

## Purpose and scoring model

This scorecard tracks evidence-based gaps in the current repository. It is not a coding-standard checklist or a claim about production service quality.

| Score | Meaning |
| ---: | --- |
| 5 | Strongly evidenced, mechanically supported, and well documented. |
| 4 | Healthy with limited, known gaps. |
| 3 | Functional and understandable, but important safeguards or consistency work remain. |
| 2 | Material inconsistency or missing safeguards. |
| 1 | Very limited verification or high fragility. |
| 0 | Absent or not assessable from repository evidence. |

## Current scorecard

| Area | Score | Evidence | Main gap |
| --- | ---: | --- | --- |
| System architecture | 4 | Clear React/Supabase/Tauri boundaries, migrations, architecture docs, typed build. | No structural tests enforce the intended seams. |
| Product clarity | 3 | Shipped-domain index and route/component structure identify the core workspace. | Product specs are an index, not detailed acceptance behavior. |
| Design consistency | 2 | Semantic light/dark tokens and reusable primitives exist. | Shell/features still mix hard-coded Slate values; the consistency proposal is not implemented. |
| Frontend engineering | 3 | Strict TypeScript, lazy routes, Query/Zustand split, domain services/hooks. | No frontend test/lint/format workflow. |
| Data integrity and sync | 4 | RLS, RPCs, database-owned facts, optimistic locking, private Broadcast migrations, offline queue. | No automated migration/RLS/Realtime or cross-window coverage. |
| Reliability | 3 | Offline replay in supported domains, conflict retention, request-storm controls, scoped invalidation. | No retry/timeout policy beyond current safeguards and no automated failure tests. |
| Security | 3 | RLS, authenticated grants, ownership-aware RPCs, private-topic policy, capability files. | CSP is `null`; dashboard channel setting and security automation are unverified. |
| Verification confidence | 1 | `pnpm build` and Cargo manifest are available. | No configured tests, lint, formatter, or root CI workflow. |
| Observability | 0 | Local console diagnostics exist. | No repository-owned metrics, tracing, central logging, alerts, or health checks. |
| Documentation legibility | 4 | System docs, design decisions, product index, migration history, generated live snapshot, and skills are present. | Some legacy schema terminology needs reconciliation. |

## Priority gaps

1. Establish focused automated coverage for services, RLS/RPC behavior, offline replay, and main/secondary-window synchronization.
2. Define and validate a restrictive Tauri CSP; verify private Broadcast dashboard settings with two authenticated windows.
3. Add focused regression coverage for versioned knowledge structural moves, reorders, and atomic folder cloning.
4. Resolve reviewed migration-history drift; do not rewrite applied history while doing so.
5. Adopt semantic theme roles across the shell and feature surfaces instead of widening hard-coded color usage.

## Update policy

Reassess affected rows after a major feature, migration/security incident, reliability work, test/CI addition, architecture change, or a deliberate debt cleanup. Change a score only with current repository evidence; record detailed implementation work in an execution plan, not this table.

See [Architecture](/architecture), [RELIABILITY.md](RELIABILITY.md), [SECURITY.md](SECURITY.md), and [the technical-debt tracker](exec-plans/tech-debt-tracker.md) for source material.
