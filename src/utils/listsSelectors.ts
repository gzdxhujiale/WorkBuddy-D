import type { List, Folder, Note, NoteGroup } from "@/types/lists";

/**
 * listsSelectors — pure view derivations over the Lists query data.
 *
 * These functions take the raw entity arrays (from `useListsData`) as explicit
 * arguments and never touch any store/cache, mirroring the sorting/filtering
 * rules that previously lived inside the Zustand store getters.
 */

/** Ordered by sortOrder ascending. */
export function sortLists(lists: List[]): List[] {
  return [...lists].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

/** Ordered by sortOrder ascending. */
export function sortFolders(folders: Folder[]): Folder[] {
  return [...folders].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

/** Notes for a list: sortOrder ascending, then most-recently-updated. */
export function getNotesByListId(notes: Note[], listId: string): Note[] {
  return notes
    .filter(n => n.listId === listId)
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return (a.sortOrder || 0) - (b.sortOrder || 0);
      }
      return b.updatedAt - a.updatedAt;
    });
}

/** Groups for a list, ordered by sortOrder ascending. */
export function getNoteGroups(noteGroups: NoteGroup[], listId: string): NoteGroup[] {
  return noteGroups
    .filter(g => g.listId === listId)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}