# Tasks: Cleanup Supabase Legacy Artifacts

## 1. Delete Legacy Files and Directories

- [x] 1.1 Remove `supabase/` directory and verify directory no longer exists on disk
- [x] 1.2 Remove `src/types/database.ts` and verify file no longer exists on disk

## 2. Refactor Environment Configuration

- [x] 2.1 Refactor `src/config/env.ts` to remove Supabase variables and validate active Go API & WS environment variables
- [x] 2.2 Verify `src/config/env.ts` compiles cleanly with `pnpm build`

## 3. Sanitize Source Code Comments and Documentation

- [x] 3.1 Update obsolete Supabase comments in `src/features/auth/components/LoginPage.tsx`
- [x] 3.2 Update obsolete Supabase comments in `src/features/knowledge/components/KnowledgePanel.tsx`
- [x] 3.3 Update obsolete Supabase comments in `src/hooks/useOptimisticSync.ts`, `src/lib/queryClient.ts`, and `src/lib/userStorage.ts`
- [x] 3.4 Update obsolete Supabase schema descriptions in `docs/generated/db-schema.md`

## 4. Full Quality Gate Verification

- [x] 4.1 Run `git grep -i "supabase" src/` to verify zero orphaned references in active frontend source
- [x] 4.2 Run `pnpm build` and `pnpm lint:boundaries` to confirm full build and architectural boundary pass
- [x] 4.3 Run `cargo check` and `go -C server test ./...` to confirm full-stack sanity
