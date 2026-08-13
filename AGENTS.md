# WorkBuddy-D agent map

WorkBuddy-D is a Tauri 2 + React desktop productivity app backed by Supabase. `docs/` is the project record system.

## Read first

1. [Architecture](ARCHITECTURE.md)
2. [Product specs](docs/product-specs/index.md)
3. [Design docs](docs/design-docs/index.md)
4. [Security](docs/SECURITY.md)
5. [Live database snapshot](docs/generated/db-schema.md)

## Boundaries

- `src/pages` and `src/components`: UI composition.
- `src/hooks`: React Query reads and optimistic writes.
- `src/services`: Supabase data-access boundary.
- `src/lib`: authentication, query keys, offline/realtime runtime.
- `supabase/migrations`: database history and authoritative database behavior.
- `src-tauri`: native windows, tray, capabilities.

## Rules

- Keep user-owned data protected by `user_id` and RLS.
- Use service and hook layers, not direct Supabase calls from UI components.
- Preserve optimistic concurrency and offline replay behavior.
- Realtime uses database-triggered private Broadcast hints; invalidate the matching Query Key, then refetch under RLS.
- The knowledge module loads its shell first; list contents and note bodies are fetched on demand. Preserve this boundary.
- Add migrations rather than rewriting applied database history.
- Update the relevant document when behavior or architecture changes.

## Verification

- `pnpm build`
- Inspect migrations for RLS, function grants, trigger safety, and Realtime authorization.
