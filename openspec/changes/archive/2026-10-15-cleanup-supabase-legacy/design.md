# Design: Cleanup Supabase Legacy Artifacts

## Context

Following the migration to a dedicated Go 1.26 independent backend service and Neon PostgreSQL database, the runtime data access layer uses `src/lib/apiClient.ts` for HTTP REST calls and `src/lib/wsClient.ts` for real-time WebSocket state synchronization. Active database migrations are managed via Goose embedded migrations located at `server/internal/database/migrations/` and `db/migrations/`.

Legacy Supabase artifacts (`supabase/` directory, `src/types/database.ts`, `src/config/env.ts`, and outdated comments) are completely decoupled from runtime execution. However, they continue to clutter the tree and create ambiguity.

## Goals / Non-Goals

**Goals:**
- Eliminate all unreferenced Supabase directories and dead code files.
- Clean up `src/config/env.ts` so that it validates and exports only active configurations (`VITE_API_BASE_URL`, `VITE_WS_URL`).
- Sanitize comments across source files and documentation to accurately describe the Go backend and Neon PostgreSQL.
- Ensure all builds (`pnpm build`, `cargo check`, Go backend build) and boundary checks (`pnpm lint:boundaries`) pass cleanly with zero regression.

**Non-Goals:**
- Modifying any active Go migration SQL files (`server/internal/database/migrations/`) or database tables in Neon.
- Modifying `openspec/changes/archive/` (historical archives must remain untouched).
- Changing any frontend data structures or TanStack Query cache keys.

## Decisions

### Decision 1: Complete deletion of `supabase/` directory
- **Choice**: Permanently remove `supabase/migrations/` (40 files).
- **Rationale**: These migrations are superseded by `server/internal/database/migrations/` (Goose-annotated migrations). The files contain non-standard Supabase extensions (`auth.uid()`, `supabase_realtime`) that cannot execute on vanilla PostgreSQL. Retaining them creates confusion about migration authority.
- **Alternative considered**: Moving them to an archive folder. *Rejected*: Git history already preserves all previous commits, and active database structure is fully covered by Goose migrations and `docs/generated/db-schema.md`.

### Decision 2: Deletion of `src/types/database.ts`
- **Choice**: Delete `src/types/database.ts`.
- **Rationale**: Verification confirmed 0 imports in `src/`. All features maintain their own domain models in `src/features/<feature>/types/index.ts`.
- **Alternative considered**: Keeping it as a generic table mapping. *Rejected*: It contains legacy Supabase `Database['public']` boilerplate that no longer matches current API response schemas.

### Decision 3: Modernize `src/config/env.ts`
- **Choice**: Refactor `src/config/env.ts` to validate current environment variables (`VITE_API_BASE_URL`, `VITE_WS_URL`) with Zod, dropping `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- **Rationale**: Ensures runtime environment checking reflects real configuration requirements rather than phantom Supabase keys.

### Decision 4: In-place Comment and Doc Sanitization
- **Choice**: Surgically update 5 source files and 1 doc file to replace obsolete "Supabase" wording with accurate descriptions ("Go backend", "Neon PostgreSQL", "API error").
- **Rationale**: Eliminates misleading comments without altering executable logic.

## Risks / Trade-offs

- **[Risk]** Accidental deletion of a file that had hidden dynamic imports.
  → **Mitigation**: Comprehensive static analysis using `git grep` and running `pnpm build` (`tsc && vite build`) to verify zero build or type errors.
- **[Risk]** Developers needing to reference legacy RPC SQL logic.
  → **Mitigation**: All historical SQL is safely recorded in Git commits and OpenSpec change archives (`openspec/changes/archive/2026-10-15-replace-supabase-with-go-neon/`).

## Verification Plan

1. **Type & Production Build**: Run `pnpm build` to confirm no missing imports or broken references.
2. **Boundary Linting**: Run `pnpm lint:boundaries` to confirm module boundary compliance.
3. **Backend & Rust Check**: Run `cargo check` and `go -C server test ./...` to guarantee full stack integrity.
4. **Cleanliness Verification**: Run `git grep -i "supabase" src/` to verify no orphaned Supabase tokens remain in active source code.
