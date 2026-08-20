import type { KnowledgeFolder, KnowledgeBase, Note, NoteGroup } from "@/types/knowledge";

/**
 * listsSelectors — pure view derivations over the Lists query data.
 *
 * These functions take the raw entity arrays (from `useKnowledgeData`) as explicit
 * arguments and never touch any store/cache, mirroring the sorting/filtering
 * rules that previously lived inside the Zustand store getters.
 */

/** Ordered by sortOrder ascending. */
export function sortKnowledgeFolders(lists: KnowledgeFolder[]): KnowledgeFolder[] {
  return [...lists].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

/** Ordered by sortOrder ascending. */
export function sortKnowledgeBases(folders: KnowledgeBase[]): KnowledgeBase[] {
  return [...folders].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

/** Notes for a list, ordered by the authoritative sortOrder sequence. */
export function getNotesByFolderId(notes: Note[], folderId: string): Note[] {
  return notes
    .filter(n => n.folderId === folderId)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id.localeCompare(b.id));
}

/** Groups for a list, ordered by sortOrder ascending. */
export function getNoteGroups(noteGroups: NoteGroup[], folderId: string): NoteGroup[] {
  return noteGroups
    .filter(g => g.folderId === folderId)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}
