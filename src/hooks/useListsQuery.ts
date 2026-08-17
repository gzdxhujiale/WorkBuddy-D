import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { emit, listen } from '@tauri-apps/api/event';
import {
  queryKeys,
  HIGH_FREQ_DELAY,
  LOW_FREQ_DELAY,
  NOTE_EDIT_DELAY,
  logSilent,
} from '@/lib/syncEngine';
import { useDebouncedMutation } from '@/hooks/useDebouncedMutation';
import * as listsService from '@/services/listsService';
import type { List, Folder, Note, NoteGroup } from '@/types/lists';
import { getNoteGroups as selectNoteGroups, getNotesByListId as selectNotesByListId } from '@/utils/listsSelectors';
import { useAuth } from '@/lib/auth';

function genId(_prefix: string): string {
  return crypto.randomUUID();
}

/**
 * useListsQuery — the Lists feature's async-data seam on TanStack Query.
 *
 * `useListsData` owns fetching/caching of the four entity collections; components
 * derive views via `listsSelectors`. `useListsActions` is the write path:
 * synchronous optimistic cache updates + debounced persistence through
 * `sharedSyncEngine` (`list:` completions are refetched by useSyncQueryInvalidator).
 * Cross-window note sync (registered once per window) patches the same cache.
 */

// ── Cross-window note sync (Tauri events) ───────────────────────────────────
// BroadcastChannel does not cross Tauri windows on macOS WKWebView, so note
// changes fan out over Tauri events. `emit` echoes back to the sender window;
// the instance id filters out self-echo.
const SYNC_SOURCE_ID = genId('win');
const NOTE_UPDATED_EVENT = 'lists:note-updated';
const NOTE_DELETED_EVENT = 'lists:note-deleted';
const NOTES_REORDERED_EVENT = 'lists:notes-reordered';

interface NoteSyncPayload {
  source: string;
  noteId: string;
  updates?: Partial<Note>;
}

interface NotesReorderPayload {
  source: string;
  /** [noteId, sortOrder] */
  items: Array<[string, number]>;
}

function broadcastNoteUpdate(noteId: string, updates: Partial<Note>) {
  emit(NOTE_UPDATED_EVENT, { source: SYNC_SOURCE_ID, noteId, updates } satisfies NoteSyncPayload)
    .catch(e => logSilent('useListsQuery', 'note sync broadcast failed', e));
}

function broadcastNoteDelete(noteId: string) {
  emit(NOTE_DELETED_EVENT, { source: SYNC_SOURCE_ID, noteId } satisfies NoteSyncPayload)
    .catch(e => logSilent('useListsQuery', 'note sync broadcast failed', e));
}

function broadcastNotesReorder(items: Array<[string, number]>) {
  if (items.length === 0) return;
  emit(NOTES_REORDERED_EVENT, { source: SYNC_SOURCE_ID, items } satisfies NotesReorderPayload)
    .catch(e => logSilent('useListsQuery', 'note sync broadcast failed', e));
}

// ── Query data ──────────────────────────────────────────────────────────────

export interface ListsQueryData {
  lists: List[];
  folders: Folder[];
  noteGroups: NoteGroup[];
  notes: Note[];
}

const EMPTY_DATA: ListsQueryData = { lists: [], folders: [], noteGroups: [], notes: [] };

async function fetchListsData(): Promise<ListsQueryData> {
  const allData = await listsService.loadAll();
  return {
    folders: allData.folders.map(f => ({ ...f })),
    lists: allData.lists.map(l => ({ ...l })),
    noteGroups: allData.noteGroups.map(g => ({ ...g })),
    notes: allData.notes.map(n => ({ ...n })),
  };
}

function getData(queryClient: QueryClient, userId: string): ListsQueryData {
  return queryClient.getQueryData<ListsQueryData>(queryKeys.lists.all(userId)) ?? EMPTY_DATA;
}

async function fetchListContents(listId: string): Promise<Pick<ListsQueryData, 'noteGroups' | 'notes'>> {
  const contents = await listsService.loadListContents(listId);
  return { noteGroups: contents.noteGroups, notes: contents.notes };
}

function setData(queryClient: QueryClient, userId: string, updater: (prev: ListsQueryData) => ListsQueryData) {
  queryClient.setQueryData<ListsQueryData>(queryKeys.lists.all(userId), prev => updater(prev ?? EMPTY_DATA));
}

// Register the cross-window listeners exactly once per window. Each Tauri window
// has its own JS context (and thus its own module instance + queryClient), so a
// module-level guard is per-window — precisely the desired scope.
let crossWindowRegistered = false;
function registerCrossWindowSync(queryClient: QueryClient, userId: string) {
  if (crossWindowRegistered) return;
  crossWindowRegistered = true;

  void listen<NoteSyncPayload>(NOTE_UPDATED_EVENT, (event) => {
    const { source, noteId, updates } = event.payload;
    if (source === SYNC_SOURCE_ID) return;
    setData(queryClient, userId, (data) => {
      const index = data.notes.findIndex(n => n.id === noteId);
      if (index === -1) return data;
      const newNotes = [...data.notes];
      newNotes[index] = { ...newNotes[index], ...updates, updatedAt: Date.now() };
      return { ...data, notes: newNotes };
    });
  }).catch(e => logSilent('useListsQuery', 'note sync listen failed', e));

  void listen<NoteSyncPayload>(NOTE_DELETED_EVENT, (event) => {
    const { source, noteId } = event.payload;
    if (source === SYNC_SOURCE_ID) return;
    setData(queryClient, userId, (data) => ({
      ...data,
      notes: data.notes.filter(n => n.id !== noteId),
    }));
  }).catch(e => logSilent('useListsQuery', 'note sync listen failed', e));

  void listen<NotesReorderPayload>(NOTES_REORDERED_EVENT, (event) => {
    const { source, items } = event.payload;
    if (source === SYNC_SOURCE_ID) return;
    const orderMap = new Map(items);
    setData(queryClient, userId, (data) => ({
      ...data,
      notes: data.notes.map(n => (orderMap.has(n.id) ? { ...n, sortOrder: orderMap.get(n.id)! } : n)),
    }));
  }).catch(e => logSilent('useListsQuery', 'note sync listen failed', e));
}

/**
 * Fetches only the module shell. Use `useListContents` after the user selects
 * a list; templates and note bodies have their own on-demand queries.
 */
export function useListsData() {
  const queryClient = useQueryClient();
  const { userId } = useAuth();

  useEffect(() => {
    registerCrossWindowSync(queryClient, userId);
  }, [queryClient, userId]);


  return useQuery({
    queryKey: queryKeys.lists.all(userId),
    queryFn: fetchListsData,
  });
}

// ── Write path ───────────────────────────────────────────────────────────────

export interface ListsActions {
  addList: (list: Omit<List, 'id'>) => List;
  updateList: (id: string, updates: Partial<List>) => void;
  deleteList: (id: string) => void;
  duplicateList: (list: List) => List;
  reorderLists: (orderedIds: string[]) => void;
  moveList: (listId: string, folderId: string | null, targetIndex?: number) => void;

  addFolder: (name: string) => Folder;
  updateFolder: (id: string, updates: Partial<Folder>) => void;
  reorderFolders: (orderedIds: string[]) => void;
  deleteFolder: (id: string) => void;

  addNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'sortOrder'>) => Note;
  updateNote: (id: string, updates: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  moveNoteAndReorder: (noteId: string, groupId: string | null, targetIndex?: number) => void;
  moveNoteToList: (noteId: string, targetListId: string, targetGroupId?: string | null) => void;
  reorderNotes: (orderedIds: string[]) => void;

  addGroup: (listId: string, name: string) => NoteGroup;
  updateGroup: (id: string, updates: Partial<NoteGroup>) => void;
  deleteGroup: (id: string) => void;
  flushNote: (id: string) => Promise<void>;
}

export function useListContents(listId: string | null) {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const query = useQuery({
    queryKey: queryKeys.lists.contents(userId, listId ?? 'none'),
    queryFn: () => fetchListContents(listId!),
    enabled: Boolean(listId),
  });
  useEffect(() => {
    if (!listId || !query.data) return;
    setData(queryClient, userId, (current) => ({
      ...current,
      noteGroups: [...current.noteGroups.filter(group => group.listId !== listId), ...query.data.noteGroups],
      notes: [...current.notes.filter(note => note.listId !== listId), ...query.data.notes],
    }));
  }, [listId, query.data, queryClient, userId]);
  return query;
}

export function useListsActions(): ListsActions {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const debouncedSync = useDebouncedMutation();

  return useMemo<ListsActions>(() => {
    // ── Lists ──
    const addList: ListsActions['addList'] = (list) => {
      const data = getData(queryClient, userId);
      const newList: List = {
        ...list,
        id: genId('list'),
        sortOrder: data.lists.length,
      };
      setData(queryClient, userId, () => ({ ...data, lists: [...data.lists, newList] }));
      debouncedSync.schedule(`list:${newList.id}`, async () => {
        const savedSortOrder = await listsService.upsertList(newList);
        if (savedSortOrder === undefined) return;
        setData(queryClient, userId, (current) => ({
          ...current,
          lists: current.lists.map((item) => item.id === newList.id ? { ...item, sortOrder: savedSortOrder } : item),
        }));
      }, LOW_FREQ_DELAY);
      return newList;
    };

    const updateList: ListsActions['updateList'] = (id, updates) => {
      const data = getData(queryClient, userId);
      const index = data.lists.findIndex(l => l.id === id);
      if (index === -1) return;
      const newLists = [...data.lists];
      newLists[index] = { ...newLists[index], ...updates };
      const list = newLists[index];
      setData(queryClient, userId, () => ({ ...data, lists: newLists }));
      debouncedSync.schedule(`list:${id}`, async () => { await listsService.upsertList(list); }, HIGH_FREQ_DELAY);
    };

    const deleteList: ListsActions['deleteList'] = (id) => {
      const data = getData(queryClient, userId);
      setData(queryClient, userId, () => ({
        ...data,
        lists: data.lists.filter(l => l.id !== id),
        notes: data.notes.filter(n => n.listId !== id),
        noteGroups: data.noteGroups.filter(g => g.listId !== id),
      }));
      debouncedSync.cancel(`list:${id}`);
      listsService.deleteList(id).catch(() => {});
    };

    const reorderLists: ListsActions['reorderLists'] = (orderedIds) => {
      const data = getData(queryClient, userId);
      const orderMap = new Map(orderedIds.map((id, index) => [id, index]));
      const items: Array<[string, number]> = [];
      const newLists = data.lists.map(l => {
        if (orderMap.has(l.id)) {
          const order = orderMap.get(l.id)!;
          items.push([l.id, order]);
          return { ...l, sortOrder: order };
        }
        return l;
      });
      setData(queryClient, userId, () => ({ ...data, lists: newLists }));
      debouncedSync.schedule('reorder:lists', () => listsService.reorderLists(items), LOW_FREQ_DELAY);
    };

    const moveList: ListsActions['moveList'] = (listId, folderId, targetIndex) => {
      const data = getData(queryClient, userId);
      const listIndex = data.lists.findIndex(l => l.id === listId);
      if (listIndex === -1) return;

      const list = { ...data.lists[listIndex], folderId };
      let newLists = [...data.lists];
      newLists[listIndex] = list;

      const siblingLists = newLists
        .filter(l => l.folderId === folderId && l.id !== listId)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

      if (targetIndex !== undefined) {
        siblingLists.splice(targetIndex, 0, list);
      } else {
        siblingLists.push(list);
      }

      const orderMap = new Map<string, number>();
      siblingLists.forEach((l, idx) => orderMap.set(l.id, idx));

      newLists = newLists.map(l => (orderMap.has(l.id) ? { ...l, sortOrder: orderMap.get(l.id) } : l));
      setData(queryClient, userId, () => ({ ...data, lists: newLists }));
      const updatedList = newLists.find(l => l.id === listId);
      debouncedSync.schedule(
        `list:${listId}`,
        () => listsService.moveList(listId, folderId, updatedList?.sortOrder || 0),
        LOW_FREQ_DELAY
      );
    };

    // ── Note Groups ──
    const addGroup: ListsActions['addGroup'] = (listId, name) => {
      const data = getData(queryClient, userId);
      const newGroup: NoteGroup = {
        id: genId('group'),
        listId,
        name,
        sortOrder: data.noteGroups.filter(g => g.listId === listId).length,
      };
      setData(queryClient, userId, () => ({ ...data, noteGroups: [...data.noteGroups, newGroup] }));
      debouncedSync.schedule(`group:${newGroup.id}`, async () => {
        const savedSortOrder = await listsService.upsertGroup(newGroup);
        if (savedSortOrder === undefined) return;
        setData(queryClient, userId, (current) => ({
          ...current,
          noteGroups: current.noteGroups.map((item) => item.id === newGroup.id ? { ...item, sortOrder: savedSortOrder } : item),
        }));
      }, LOW_FREQ_DELAY);
      return newGroup;
    };

    const updateGroup: ListsActions['updateGroup'] = (id, updates) => {
      const data = getData(queryClient, userId);
      const index = data.noteGroups.findIndex(g => g.id === id);
      if (index === -1) return;
      const newGroups = [...data.noteGroups];
      newGroups[index] = { ...newGroups[index], ...updates };
      const group = newGroups[index];
      setData(queryClient, userId, () => ({ ...data, noteGroups: newGroups }));
      debouncedSync.schedule(`group:${id}`, async () => { await listsService.upsertGroup(group); }, HIGH_FREQ_DELAY);
    };

    const deleteGroup: ListsActions['deleteGroup'] = (id) => {
      const data = getData(queryClient, userId);
      setData(queryClient, userId, () => ({
        ...data,
        noteGroups: data.noteGroups.filter(g => g.id !== id),
        notes: data.notes.map(n => (n.groupId === id ? { ...n, groupId: null } : n)),
      }));
      debouncedSync.cancel(`group:${id}`);
      listsService.deleteGroup(id).catch(() => {});
    };

    // ── Notes ──
    const addNote: ListsActions['addNote'] = (note) => {
      const data = getData(queryClient, userId);
      const siblingNotes = data.notes.filter(n => n.listId === note.listId && n.groupId === note.groupId);
      const newNote: Note = {
        ...note,
        id: genId('note'),
        sortOrder: siblingNotes.length,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setData(queryClient, userId, () => ({ ...data, notes: [...data.notes, newNote] }));
      debouncedSync.schedule(`note:${newNote.id}`, async () => {
        const saved = await listsService.upsertNote(newNote);
        if (saved === undefined) return;
        setData(queryClient, userId, (current) => ({
          ...current,
          notes: current.notes.map((item) =>
            item.id === newNote.id && item.updatedAt === newNote.updatedAt
              ? { ...item, updatedAt: saved.updatedAt, baseUpdatedAt: saved.updatedAt, sortOrder: saved.sortOrder }
              : item,
          ),
        }));
      }, LOW_FREQ_DELAY);
      return newNote;
    };

    const updateNote: ListsActions['updateNote'] = (id, updates) => {
      const delay = updates.title !== undefined || updates.content !== undefined
        ? NOTE_EDIT_DELAY
        : HIGH_FREQ_DELAY;
      const data = getData(queryClient, userId);
      const index = data.notes.findIndex(n => n.id === id);
      if (index === -1) {
        // Defensive fallback if note is not yet loaded in query cache.
        broadcastNoteUpdate(id, updates);
        debouncedSync.schedule(`note:${id}`, async () => {
          const savedUpdatedAt = await listsService.patchNote({
            id,
            ...updates,
          });
          if (savedUpdatedAt === undefined) return;
        }, delay);
        return;
      }
      const currentNote = data.notes[index];
      if (Object.entries(updates).every(([key, value]) => (
        Object.is(currentNote[key as keyof Note], value)
      ))) {
        return;
      }
      const newNotes = [...data.notes];
      newNotes[index] = {
        ...newNotes[index],
        ...updates,
        updatedAt: Date.now(),
        contentLoaded: newNotes[index].contentLoaded || updates.content !== undefined,
        baseUpdatedAt: newNotes[index].baseUpdatedAt,
      };
      setData(queryClient, userId, () => ({ ...data, notes: newNotes }));
      broadcastNoteUpdate(id, updates);
      debouncedSync.schedule(`note:${id}`, async () => {
        const latest = getData(queryClient, userId).notes.find(item => item.id === id);
        if (!latest) return;
        let savedUpdatedAt: number | undefined;
        let savedSortOrder: number | undefined;
        if (latest.contentLoaded || updates.content !== undefined) {
          const saved = await listsService.upsertNote(latest);
          savedUpdatedAt = saved?.updatedAt;
          savedSortOrder = saved?.sortOrder;
        } else {
          savedUpdatedAt = await listsService.patchNote({
            id,
            listId: updates.listId,
            groupId: updates.groupId,
            title: updates.title,
            sortOrder: updates.sortOrder,
            baseUpdatedAt: latest.baseUpdatedAt,
          });
        }
        if (savedUpdatedAt === undefined) return;
        setData(queryClient, userId, (current) => ({
          ...current,
          notes: current.notes.map((item) =>
            item.id === id && item.updatedAt === latest.updatedAt
              ? {
                  ...item,
                  updatedAt: savedUpdatedAt,
                  baseUpdatedAt: savedUpdatedAt,
                  sortOrder: savedSortOrder ?? item.sortOrder,
                }
              : item,
          ),
        }));
      }, delay);
    };

    const deleteNote: ListsActions['deleteNote'] = (id) => {
      const data = getData(queryClient, userId);
      setData(queryClient, userId, () => ({
        ...data,
        notes: data.notes.filter(n => n.id !== id),
      }));
      debouncedSync.cancel(`note:${id}`);
      listsService.deleteNote(id).catch(() => {});
      broadcastNoteDelete(id);
    };

    const moveNoteAndReorder: ListsActions['moveNoteAndReorder'] = (noteId, groupId, targetIndex) => {
      const data = getData(queryClient, userId);
      const noteIndex = data.notes.findIndex(n => n.id === noteId);
      if (noteIndex === -1) return;

      let newNotes = [...data.notes];
      const note = { ...newNotes[noteIndex], groupId };
      newNotes[noteIndex] = note;

      const siblingNotes = newNotes
        .filter(n => n.listId === note.listId && n.groupId === groupId && n.id !== noteId)
        .sort((a, b) => {
          if (a.sortOrder !== b.sortOrder) return (a.sortOrder || 0) - (b.sortOrder || 0);
          return b.updatedAt - a.updatedAt;
        });

      if (targetIndex !== undefined) {
        siblingNotes.splice(targetIndex, 0, note);
      } else {
        siblingNotes.push(note);
      }

      const orderMap = new Map<string, number>();
      siblingNotes.forEach((n, idx) => orderMap.set(n.id, idx));

      newNotes = newNotes.map(n => (orderMap.has(n.id) ? { ...n, sortOrder: orderMap.get(n.id)! } : n));
      setData(queryClient, userId, () => ({ ...data, notes: newNotes }));
      const updatedNote = newNotes.find(n => n.id === noteId);
      // Sync the group change and affected same-group ordering so a stale copy in
      // a child window does not write back the whole note and undo the move.
      broadcastNoteUpdate(noteId, { groupId });
      broadcastNotesReorder(Array.from(orderMap.entries()));
      debouncedSync.schedule(
        `note:${noteId}`,
        async () => {
          const savedUpdatedAt = await listsService.moveNote(
            noteId,
            note.listId,
            groupId,
            updatedNote?.sortOrder || 0,
            note.baseUpdatedAt,
          );
          if (savedUpdatedAt === undefined) return;
          setData(queryClient, userId, (current) => ({
            ...current,
            notes: current.notes.map((item) => item.id === noteId
              ? {
                  ...item,
                  updatedAt: savedUpdatedAt,
                  baseUpdatedAt: savedUpdatedAt,
                  sortOrder: item.sortOrder,
                }
              : item),
          }));
        },
        LOW_FREQ_DELAY
      );
    };

    const moveNoteToList: ListsActions['moveNoteToList'] = (noteId, targetListId, targetGroupId = null) => {
      const data = getData(queryClient, userId);
      const noteIndex = data.notes.findIndex(n => n.id === noteId);
      if (noteIndex === -1) return;

      const oldNote = data.notes[noteIndex];
      if (oldNote.listId === targetListId && oldNote.groupId === targetGroupId) return;

      const targetListNotes = data.notes.filter(n => n.listId === targetListId);
      const maxSortOrder = targetListNotes.reduce((max, n) => Math.max(max, n.sortOrder || 0), -1);
      const newSortOrder = maxSortOrder + 1;

      const newNotes = [...data.notes];
      newNotes[noteIndex] = {
        ...oldNote,
        listId: targetListId,
        groupId: targetGroupId,
        sortOrder: newSortOrder,
        updatedAt: Date.now(),
      };

      setData(queryClient, userId, () => ({ ...data, notes: newNotes }));
      broadcastNoteUpdate(noteId, { listId: targetListId, groupId: targetGroupId, sortOrder: newSortOrder });
      debouncedSync.schedule(
        `note:${noteId}`,
        async () => {
          const savedUpdatedAt = await listsService.moveNote(
            noteId,
            targetListId,
            targetGroupId,
            newSortOrder,
            oldNote.baseUpdatedAt,
          );
          if (savedUpdatedAt === undefined) return;
          setData(queryClient, userId, (current) => ({
            ...current,
            notes: current.notes.map((item) => item.id === noteId
              ? {
                  ...item,
                  updatedAt: savedUpdatedAt,
                  baseUpdatedAt: savedUpdatedAt,
                  sortOrder: item.sortOrder,
                }
              : item),
          }));
        },
        LOW_FREQ_DELAY
      );
    };

    const reorderNotes: ListsActions['reorderNotes'] = (orderedIds) => {
      const data = getData(queryClient, userId);
      const orderMap = new Map(orderedIds.map((id, index) => [id, index]));
      const items: Array<[string, number]> = [];
      const newNotes = data.notes.map(n => {
        if (orderMap.has(n.id)) {
          const order = orderMap.get(n.id)!;
          items.push([n.id, order]);
          return { ...n, sortOrder: order };
        }
        return n;
      });
      setData(queryClient, userId, () => ({ ...data, notes: newNotes }));
      broadcastNotesReorder(items);
      debouncedSync.schedule('reorder:notes', async () => {
        const savedVersions = await listsService.reorderNotes(items);
        if (savedVersions === undefined) return;
        const versions = new Map(savedVersions);
        setData(queryClient, userId, (current) => ({
          ...current,
          notes: current.notes.map((note) => {
            const savedUpdatedAt = versions.get(note.id);
            return savedUpdatedAt === undefined
              ? note
              : { ...note, updatedAt: savedUpdatedAt, baseUpdatedAt: savedUpdatedAt };
          }),
        }));
      }, LOW_FREQ_DELAY);
    };

    // ── Folders ──
    const addFolder: ListsActions['addFolder'] = (name) => {
      const data = getData(queryClient, userId);
      const newFolder: Folder = {
        id: genId('folder'),
        name,
        sortOrder: data.folders.length,
      };
      setData(queryClient, userId, () => ({ ...data, folders: [...data.folders, newFolder] }));
      debouncedSync.schedule(`folder:${newFolder.id}`, () => listsService.upsertFolder(newFolder), LOW_FREQ_DELAY);
      return newFolder;
    };

    const updateFolder: ListsActions['updateFolder'] = (id, updates) => {
      const data = getData(queryClient, userId);
      const index = data.folders.findIndex(f => f.id === id);
      if (index === -1) return;
      const newFolders = [...data.folders];
      newFolders[index] = { ...newFolders[index], ...updates };
      const folder = newFolders[index];
      setData(queryClient, userId, () => ({ ...data, folders: newFolders }));
      debouncedSync.schedule(`folder:${id}`, () => listsService.upsertFolder(folder), HIGH_FREQ_DELAY);
    };

    const reorderFolders: ListsActions['reorderFolders'] = (orderedIds) => {
      const data = getData(queryClient, userId);
      const orderMap = new Map(orderedIds.map((id, index) => [id, index]));
      const items: Array<[string, number]> = [];
      const newFolders = data.folders.map(f => {
        if (orderMap.has(f.id)) {
          const order = orderMap.get(f.id)!;
          items.push([f.id, order]);
          return { ...f, sortOrder: order };
        }
        return f;
      });
      setData(queryClient, userId, () => ({ ...data, folders: newFolders }));
      debouncedSync.schedule('reorder:folders', () => listsService.reorderFolders(items), LOW_FREQ_DELAY);
    };

    const deleteFolder: ListsActions['deleteFolder'] = (id) => {
      const data = getData(queryClient, userId);
      setData(queryClient, userId, () => ({
        ...data,
        folders: data.folders.filter(f => f.id !== id),
        lists: data.lists.map(l => (l.folderId === id ? { ...l, folderId: null } : l)),
      }));
      debouncedSync.cancel(`folder:${id}`);
      listsService.deleteFolder(id).catch(() => {});
    };

    // ── Duplicate (composes the primitives above) ──
    const duplicateList: ListsActions['duplicateList'] = (list) => {
      const newList = addList({ ...list, name: list.name + ' (副本)' });

      const sourceGroups = selectNoteGroups(getData(queryClient, userId).noteGroups, list.id);
      const groupMap = new Map<string, string>();
      sourceGroups.forEach(group => {
        const newGroup = addGroup(newList.id, group.name);
        updateGroup(newGroup.id, { sortOrder: group.sortOrder });
        groupMap.set(group.id, newGroup.id);
      });

      const sourceNotes = selectNotesByListId(getData(queryClient, userId).notes, list.id);
      sourceNotes.forEach(note => {
        addNote({
          listId: newList.id,
          groupId: note.groupId ? groupMap.get(note.groupId) || null : null,
          title: note.title,
          content: note.content,
        });
      });

      listsService.duplicateList(list.id, newList).catch(() => {});

      return newList;
    };

    const flushNote = async (id: string) => {
      await debouncedSync.flush(`note:${id}`);
    };

    return {
      addList,
      updateList,
      deleteList,
      duplicateList,
      reorderLists,
      moveList,
      addFolder,
      updateFolder,
      reorderFolders,
      deleteFolder,
      addNote,
      updateNote,
      deleteNote,
      moveNoteAndReorder,
      moveNoteToList,
      reorderNotes,
      addGroup,
      updateGroup,
      deleteGroup,
      flushNote,
    };
  }, [queryClient, userId, debouncedSync]);
}
