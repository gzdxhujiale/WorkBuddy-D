# Knowledge structural mutations: atomic move, reorder, and failure visibility

## 1. Purpose and big picture

Make knowledge note and folder drag operations transactional and versioned, so a completed drag never leaves an authoritative partial order. Ensure the remaining knowledge delete failures are visible and remove stale documentation about a retired Tauri cache-patch path.

## 2. Context and orientation

`src/hooks/useKnowledgeQuery.ts` currently changes all target sibling `sortOrder` values optimistically, but `move_note_v2` persists only the moved row. Folder moves likewise use a move RPC followed by a separate reorder RPC. `reorder_notes_v3` and folder equivalents already validate full versioned item sets and supply the model for composite RPCs. The user-owned knowledge tables are RLS-protected and publish private Broadcast invalidation hints.

## 3. Progress

- [x] 2026-08-20: inspected current move/reorder paths and identified the partial-order persistence gap.
- [x] Added atomic versioned note move-and-reorder RPC and client path.
- [x] Added atomic versioned folder move-and-reorder RPC and client path.
- [x] Prevented unpersisted entities from entering structural reorders.
- [x] Surfaced knowledge deletion failures; corrected durable documentation.
- [x] Applied and verified migrations, then built and reviewed the final diff.

## 4. Plan of work

First create two `security invoker` RPCs that validate the complete supplied target order before applying any row update. Replace sequential client move/reorder calls with those RPCs. Then prevent a newly created item from participating in structural reorder before its initial RPC has returned a version. Finally add visible delete errors and update the sync/reliability record.

## 5. Concrete steps

1. In `supabase/migrations/`, add `move_and_reorder_notes_v3` and `move_and_reorder_knowledge_base_folders_v3`; revoke `PUBLIC`/`anon`, grant only `authenticated`.
2. Extend `src/services/knowledgeService.ts` with matching typed RPC calls.
3. Replace move flows in `src/hooks/useKnowledgeQuery.ts`; preserve one optimistic cache state and reconcile returned versions.
4. Update `src/components/knowledge/KnowledgePanel.tsx` or the hook error path to show user-facing failures.
5. Update `docs/design-docs/sync-and-editor-consistency.md` and `docs/RELIABILITY.md`.
6. Apply migration to project `cdrdmkojduynctaoymjl`; inspect grants/security, run advisors, `pnpm build`, and `pnpm docs:build`.

## 6. Validation and acceptance

- Given a persisted note is moved into a group, when the RPC succeeds, observe the moved row and every ordered sibling receive one coherent returned version set.
- Given any supplied note/folder version is stale, when a move is attempted, observe `VERSION_CONFLICT` and no row changes.
- Given a new unsaved note/folder, when it is dragged, observe no structural reorder RPC with missing versions.
- Given deletion fails, observe a Toast and authoritative refetch.
- Run `pnpm build` and `pnpm docs:build`.

## 7. Idempotence and recovery

The migration is append-only. RPC input is fully versioned: retrying a committed request returns a conflict rather than applying a second ambiguous reorder; the client refetches to recover. Do not add direct table-write fallback paths.

## 8. Surprises and discoveries

- Cross-group note moves currently recalculate sibling sort values locally but persist only the moved note through `move_note_v2`.
- The reliability document mentioned a Tauri list-note cache-patch path, but no runtime event listener/emitter remains; the stale note was removed.
- Cross-container moves must compact the source scope as well as validate the destination scope. Migration `20260820050100_compact_knowledge_source_order_on_move.sql` replaces the initial V3 function bodies to do this under deterministic scope locks.

## 9. Decision log

- 2026-08-20: use complete-order, version-checked composite RPCs rather than an intermediate move plus reorder; this makes conflict behavior atomic and keeps `sort_order` authoritative.

## 10. Outcomes and retrospective

Two append-only migrations were applied to project `cdrdmkojduynctaoymjl`: `20260820050000_atomic_knowledge_structural_moves.sql` introduces the composite RPCs and `20260820050100_compact_knowledge_source_order_on_move.sql` closes the discovered source-scope compaction gap. Both RPCs are `security invoker`, are executable by `authenticated` only, and have no `anon` grant. The hook now keeps note title/body data in the same structural RPC, preventing a structural drag from replacing a pending debounced editor write. New entities without `lock_version` are deliberately not eligible for structural operations.

Validated with `pnpm exec tsc --noEmit`, `pnpm build`, `pnpm docs:build`, and `git diff --check`. Supabase security advisor reports only the existing leaked-password-protection warning; performance advisor reports existing unused-index informational findings. Manual signed-in drag/concurrent-window verification remains the next test needed because the repository has no automated test suite.
