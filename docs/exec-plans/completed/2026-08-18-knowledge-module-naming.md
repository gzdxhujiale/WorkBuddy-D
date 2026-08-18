# Knowledge module naming unification

## Purpose and big picture

Rename the frontend knowledge-module seams to reflect the shipped hierarchy: knowledge base → knowledge folder → note. Preserve database names, `/lists` routing, TanStack Query key values, and existing Tauri event names so persisted state and cross-window synchronization remain compatible.

## Context and orientation

The database already uses `knowledge_bases`, `knowledge_base_folders`, `folder_note_groups`, and `notes`. The frontend still calls knowledge bases `Folder` and knowledge folders `List`, and exposes this terminology in `src/components/lists/`, `src/hooks/useListsQuery.ts`, `src/services/listsService.ts`, `src/types/lists.ts`, and their utilities.

`docs/design-docs/sync-and-editor-consistency.md` documents the existing `lists:*` Tauri-event divergence. This refactor must not extend or rename that wire contract.

## Progress

- [x] Inspect frontend ownership, route, query-key, and sync-event references.
- [x] Rename module files and imports to knowledge terminology.
- [x] Rename frontend entity types, fields, and local variables.
- [x] Preserve compatibility contracts and update documentation.
- [x] Build and review the final diff.

## Plan of work

1. Move the type, service, hook, utility, page, and panel entry files to knowledge-oriented names; update all frontend imports.
2. Rename public frontend entities to `KnowledgeBase`, `KnowledgeFolder`, `NoteGroup`, and `KnowledgeData`; rename their relationship fields to `knowledgeBaseId` and `folderId`.
3. Keep Supabase table/RPC names, `/lists`, `queryKeys.lists`, offline-operation keys, and `lists:*` Tauri events unchanged. Map the compatibility names only at the service boundary.
4. Update architecture/front-end terminology and verify TypeScript plus the production build.

## Concrete steps

Working directory: `C:\Users\Admin\Documents\WorkBuddy-D`.

1. Change `src/types/knowledge.ts`, `src/services/knowledgeService.ts`, and `src/hooks/useKnowledgeQuery.ts`, then update all calling components.
2. Rename the files and paths listed in the progress section without changing `src/router.tsx`'s `/lists` URL.
3. Run `pnpm build` and `git diff --check`.

## Validation and acceptance

- Given a knowledge base with folders and notes, when the knowledge screen opens, observe the same hierarchy and on-demand note loading.
- Given two windows editing a note, when a note change is emitted, observe the existing `lists:*` events still route to the same query cache.
- Given prior navigation to `/lists`, when the app loads, observe the knowledge screen remains reachable.
- Run `pnpm build` and `git diff --check`.

## Idempotence and recovery

The refactor changes frontend source names only. It does not change database schema, persisted data, RPC signatures, or route paths. If validation fails, revert the affected source-file move and import updates together; do not alter migrations or production data.

## Surprises and discoveries

- `Folder` currently maps `knowledge_bases`, while `List` maps `knowledge_base_folders`; this is the inverse of the product hierarchy.
- The existing Tauri events directly patch note cache state and are a documented design divergence, so their `lists:*` names remain compatibility identifiers.

## Decision log

| Date | Decision | Rationale |
| --- | --- | --- |
| 2026-08-18 | Preserve `/lists`, query-key values, operation keys, and `lists:*` events. | They are routing/cache/sync contracts, not user-facing domain terminology. |
| 2026-08-18 | Rename frontend entities to knowledge-base and knowledge-folder semantics. | The current terms invert the actual data model and confuse maintenance. |

## Outcomes and retrospective

Completed 2026-08-18. The knowledge-module files now use knowledge-oriented paths, public types use `KnowledgeBase`, `KnowledgeFolder`, and `KnowledgeTemplate`, and note/group relationships use `folderId` while a knowledge folder's parent uses `knowledgeBaseId`. The legacy `/lists` route, Query-key values, offline-operation keys, and `lists:*` Tauri event names remain unchanged by design. `pnpm build` and `git diff --check` passed.
