# WorkBuddy-D agent guide

## Project

WorkBuddy-D is a single Tauri 2 desktop productivity application. Its frontend is React 19, TypeScript, Vite, Tailwind, TanStack Query/Router, and Zustand; Supabase provides Auth, PostgreSQL, RPCs, and Realtime.

Read [ARCHITECTURE.md](ARCHITECTURE.md) for the system boundaries and data flow. `docs/` is the project record system; use it for detail rather than expanding this file.

## Repository map

- `src/pages/`, `src/components/` — routes, windows, and UI composition.
- `src/hooks/` — React Query reads, optimistic mutations, and debounced writes.
- `src/services/` — the Supabase data-access boundary for each domain.
- `src/lib/` — authentication, query keys, synchronization, offline replay, and shared runtime code.
- `src/stores/` — Zustand UI-only state.
- `src/types/`, `src/utils/` — shared frontend types and helpers.
- `src-tauri/` — Rust entry points, Tauri configuration, capabilities, tray, and native integration.
- `supabase/migrations/` — append-only database history and authoritative database behavior.
- `docs/` — product specs, accepted design decisions, security, reliability, and the live schema snapshot.
- `.agents/skills/` — specialized, reusable agent workflows.

## Commands

Install dependencies:

    pnpm install --frozen-lockfile

Frontend development and validation:

    pnpm dev
    pnpm build
    pnpm preview

Desktop development and packaging:

    pnpm tauri
    pnpm run "tauri build"
    cd src-tauri && cargo check

Documentation:

    pnpm docs:dev
    pnpm docs:build

`pnpm build` runs `tsc` followed by `vite build`; TypeScript is strict and rejects unused locals and parameters. There are currently no repository scripts for tests, linting, formatting, or Supabase migration application. Do not report those checks as run unless their configuration is added.

## Architecture invariants

- Keep UI composition in pages/components. UI components must not access Supabase directly; go through the matching service and hook layer.
- TanStack Query owns server state and Zustand owns UI-only state. Preserve existing optimistic update, debounced-write, conflict, and offline-replay behavior.
- Protect every user-owned database resource with `user_id` and RLS. Never put a service-role credential in the frontend.
- The database owns audit timestamps, soft-delete and completion timestamps, focus-session boundaries, and initial ordering. Clients send the last observed `updated_at` only where versioned RPCs require it.
- Realtime uses the private `user:<id>:sync` Broadcast channel. Treat broadcasts as minimal invalidation hints: invalidate the narrow matching query key and refetch under RLS; do not treat a payload as authoritative row data.
- Preserve the knowledge module's loading boundary: fetch the shell first, then the selected list's contents and note bodies on demand.
- Add a new migration for database behavior; do not rewrite applied migrations. Review RLS, function grants, trigger safety, and Realtime authorization with every database change.
- For native changes, keep Tauri capabilities and permissions scoped to the affected windows and APIs.

## Working on tasks

### Before editing

1. Identify the owning module and inspect nearby code, hooks, services, and existing behavior.
2. Check whether a relevant repository skill applies; load only that skill and its required references.
3. Read the documentation routed below for behavior, security, database, synchronization, or native changes.
4. Locate any existing validation or manual reproduction path before changing observable behavior.

### While editing

- Extend existing services, hooks, query keys, and domain patterns instead of introducing a parallel data path.
- Keep the change scoped. Update the relevant documentation when product behavior, architecture, security posture, or schema behavior changes.
- Preserve compatibility for persisted local state when renaming storage keys or application identifiers.
- Keep generated/live schema material as a reference snapshot; migrations remain the source of truth for database changes.

### Before finishing

- Review the final diff for unintended files and boundary violations.
- Run the validation appropriate to the changed surface, listed below.
- Manually verify user-visible, synchronization, or multi-window behavior when automated coverage is unavailable.

## Skills

Repository-specific workflows live in `.agents/skills/`. They include routers and focused guidance for Tauri v2/native permissions, Supabase/Postgres, React performance, Tiptap, UI systems, and documentation review.

- For any Tauri or native-window task, start with `.agents/skills/tauri/SKILL.md`, then load the matching focused skill.
- For any Supabase, Auth, RLS, Realtime, or migration task, use `.agents/skills/supabase/SKILL.md`; use `supabase-postgres-best-practices` when the work concerns Postgres performance or schema design.
- Use `tiptap` for editor work and `vercel-react-best-practices` for substantial React implementation, review, or performance work.
- Use `frontend-design` for distinctive, intentional visual design, typography pairing, layout aesthetic direction, and anti-template UI decisions when building new UI or reshaping interfaces.
- Use `tailwind-design-system` for shared Tailwind tokens, theme variables, reusable component styling, or cross-screen visual consistency; skip it for isolated utility-class edits.
- Prefer a relevant existing skill over inventing a workflow. Do not load unrelated skills or duplicate their procedures here.

## Documentation routing

When working on:

- system boundaries, data flow, or loading strategy — read [ARCHITECTURE.md](ARCHITECTURE.md).
- UI/interaction design — read [docs/DESIGN.md](docs/DESIGN.md).
- frontend engineering — read [docs/FRONTEND.md](docs/FRONTEND.md).
- complex or risky multi-step work — read [docs/PLANS.md](docs/PLANS.md).
- ambiguous product trade-offs — read [docs/PRODUCT_SENSE.md](docs/PRODUCT_SENSE.md).
- current quality gaps or maintenance prioritization — read [docs/QUALITY_SCORE.md](docs/QUALITY_SCORE.md).
- product behavior — read [docs/product-specs/index.md](docs/product-specs/index.md).
- synchronization, optimistic concurrency, or editor consistency — read [docs/design-docs/sync-and-editor-consistency.md](docs/design-docs/sync-and-editor-consistency.md).
- durable engineering decisions — read [docs/design-docs/core-beliefs.md](docs/design-docs/core-beliefs.md).
- Supabase security, RPCs, Realtime, or native permissions — read [docs/SECURITY.md](docs/SECURITY.md).
- current database tables, triggers, and versioning model — read [docs/generated/db-schema.md](docs/generated/db-schema.md), then inspect the relevant migrations.
- frontend caching or editor implementation — read [docs/FRONTEND.md](docs/FRONTEND.md).
- resilience, degraded/offline behavior, or operational quality — read [docs/RELIABILITY.md](docs/RELIABILITY.md).

## Verification

Run the smallest relevant check first:

- Frontend TypeScript or UI change: `pnpm build`.
- Tauri/Rust/configuration change: `cd src-tauri && cargo check`; run `pnpm run "tauri build"` when packaging can be affected.
- Documentation site change: `pnpm docs:build`.
- Migration or database-security change: inspect the migration for RLS, function grants, trigger safety, and private Broadcast authorization; validate the changed database behavior with the applicable Supabase workflow.

Run a build when changes cross frontend/native boundaries or affect compilation. Because this repository has no configured test suite, describe the manual verification performed and any validation that could not run.
