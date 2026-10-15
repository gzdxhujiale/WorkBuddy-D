# Proposal: Cleanup Supabase Legacy Artifacts

## Why

WorkBuddy-D has completed full migration from Supabase BaaS to a dedicated Go 1.26 independent backend service (`server/`), Neon PostgreSQL database, Goose embedded migrations, and monotonic WebSocket synchronization. However, legacy artifacts including `supabase/migrations/` (40 obsolete SQL files), unreferenced Supabase database schema types (`src/types/database.ts`), unused Supabase environment configurations (`src/config/env.ts`), and outdated source code comments remain across the project. 

These dead assets introduce cognitive confusion for developers and AI agents, risk accidental edits to superseded migrations, and violate the Single Source of Truth architecture principle. Cleaning them up solidifies repository cleanliness and architecture clarity.

## What Changes

- **Remove Obsolete Migration Directory**: Completely delete the `supabase/` directory containing 40 superseded SQL migration scripts that rely on deprecated Supabase-specific syntax (`auth.uid()`, `supabase_realtime`).
- **Remove Dead Database Types**: Delete `src/types/database.ts`, which was a 270-line Supabase database type stub never imported or referenced by any active application code.
- **Prune Unused Environment Variables**: Remove unused `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` declarations from `src/config/env.ts`.
- **Sanitize Source Code Comments and Documentation**: Update legacy comments referencing Supabase in `src/features/auth/components/LoginPage.tsx`, `src/features/knowledge/components/KnowledgePanel.tsx`, `src/hooks/useOptimisticSync.ts`, `src/lib/queryClient.ts`, `src/lib/userStorage.ts`, and `docs/generated/db-schema.md` to reflect current Go backend and Neon PostgreSQL reality.

## Capabilities

### New Capabilities
None. This change does not introduce any new system capabilities.

### Modified Capabilities
None. System behavior and functional capabilities remain identical. `skip_specs: true` is enabled in `.openspec.yaml`.

## Non-goals

- No modifications to database schemas in Neon PostgreSQL or active Goose migrations (`server/internal/database/migrations/`).
- No modifications to business logic, TanStack Query hooks, or Go backend endpoints.
- No deletion of archived change proposals under `openspec/changes/archive/` (historical decision audit records remain intact).

## Impact

- **Affected Files**:
  - `supabase/` (deleted entirely)
  - `src/types/database.ts` (deleted)
  - `src/config/env.ts` (cleaned)
  - `src/features/auth/components/LoginPage.tsx` (comment updated)
  - `src/features/knowledge/components/KnowledgePanel.tsx` (comment updated)
  - `src/hooks/useOptimisticSync.ts` (comment updated)
  - `src/lib/queryClient.ts` (comment updated)
  - `src/lib/userStorage.ts` (comment updated)
  - `docs/generated/db-schema.md` (documentation updated)
- **Dependencies**: No runtime dependencies affected (`@supabase/supabase-js` was already eliminated).
- **Breaking Changes**: None. Zero runtime impact.
