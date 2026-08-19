import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  queryKeys,
  HIGH_FREQ_DELAY,
  LOW_FREQ_DELAY,
  NOTE_EDIT_DELAY,
} from '@/lib/syncEngine';
import { clearPendingScope, markPendingScope } from '@/lib/queryPending';
import { useDebouncedMutation } from '@/hooks/useDebouncedMutation';
import * as knowledgeService from '@/services/knowledgeService';
import type { KnowledgeFolder, KnowledgeBase, Note, NoteGroup } from '@/types/knowledge';
import { getNoteGroups as selectNoteGroups, getNotesByFolderId as selectNotesByFolderId } from '@/utils/knowledgeSelectors';
import { useAuth } from '@/lib/auth';
import {
  createKnowledgeBaseId,
  createKnowledgeFolderId,
  createNoteGroupId,
  createNoteId,
} from '@/lib/entityIds';

/**
 * useKnowledgeQuery — the knowledge feature's async-data seam on TanStack Query.
 *
 * `useKnowledgeData` owns fetching/caching of the four entity collections; components
 * derive views via `knowledgeSelectors`. `useKnowledgeActions` is the write path:
 * synchronous optimistic cache updates + debounced persistence through
 * `sharedSyncEngine` (`list:` completions are refetched by useSyncQueryInvalidator).
 * Cross-window changes arrive as Supabase Broadcast invalidation hints, then refetch
 * under RLS; no window mirrors another window's note body into its local cache.
 */

// ── Query data ──────────────────────────────────────────────────────────────

export interface KnowledgeQueryData {
  lists: KnowledgeFolder[];
  folders: KnowledgeBase[];
  noteGroups: NoteGroup[];
  notes: Note[];
}

const EMPTY_DATA: KnowledgeQueryData = { lists: [], folders: [], noteGroups: [], notes: [] };

async function fetchListsData(): Promise<KnowledgeQueryData> {
  const allData = await knowledgeService.loadAll();
  return {
    folders: allData.folders.map(f => ({ ...f })),
    lists: allData.lists.map(l => ({ ...l })),
    noteGroups: allData.noteGroups.map(g => ({ ...g })),
    notes: allData.notes.map(n => ({ ...n })),
  };
}

function getData(queryClient: QueryClient, userId: string): KnowledgeQueryData {
  return queryClient.getQueryData<KnowledgeQueryData>(queryKeys.lists.all(userId)) ?? EMPTY_DATA;
}

async function fetchKnowledgeFolderContents(folderId: string): Promise<Pick<KnowledgeQueryData, 'noteGroups' | 'notes'>> {
  const contents = await knowledgeService.loadKnowledgeFolderContents(folderId);
  return { noteGroups: contents.noteGroups, notes: contents.notes };
}

function setData(queryClient: QueryClient, userId: string, updater: (prev: KnowledgeQueryData) => KnowledgeQueryData) {
  queryClient.setQueryData<KnowledgeQueryData>(queryKeys.lists.all(userId), prev => updater(prev ?? EMPTY_DATA));
}

/**
 * Fetches only the module shell. Use `useKnowledgeFolderContents` after the user selects
 * a list; templates and note bodies have their own on-demand queries.
 */
export function useKnowledgeData() {
  const { userId } = useAuth();

  return useQuery({
    queryKey: queryKeys.lists.all(userId),
    queryFn: fetchListsData,
  });
}

// ── Write path ───────────────────────────────────────────────────────────────

export interface KnowledgeActions {
  addList: (list: Omit<KnowledgeFolder, 'id'>) => KnowledgeFolder;
  updateList: (id: string, updates: Partial<KnowledgeFolder>) => void;
  deleteKnowledgeFolder: (id: string) => void;
  duplicateKnowledgeFolder: (list: KnowledgeFolder) => KnowledgeFolder;
  reorderKnowledgeFolders: (orderedIds: string[]) => void;
  moveKnowledgeFolder: (folderId: string, knowledgeBaseId: string | null, targetIndex?: number) => void;

  addFolder: (name: string) => KnowledgeBase;
  updateFolder: (id: string, updates: Partial<KnowledgeBase>) => void;
  reorderKnowledgeBases: (orderedIds: string[]) => void;
  deleteKnowledgeBase: (id: string) => void;

  addNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'sortOrder'>) => Note;
  updateNote: (id: string, updates: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  moveNoteAndReorder: (noteId: string, groupId: string | null, targetIndex?: number) => void;
  moveNoteToList: (noteId: string, targetListId: string, targetGroupId?: string | null) => void;
  reorderNotes: (orderedIds: string[]) => void;

  addGroup: (folderId: string, name: string) => NoteGroup;
  updateGroup: (id: string, updates: Partial<NoteGroup>) => void;
  deleteGroup: (id: string) => void;
  flushNote: (id: string) => Promise<void>;
}

export function useKnowledgeFolderContents(folderId: string | null) {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const query = useQuery({
    queryKey: queryKeys.lists.contents(userId, folderId ?? 'none'),
    queryFn: () => fetchKnowledgeFolderContents(folderId!),
    enabled: Boolean(folderId),
  });
  useEffect(() => {
    if (!folderId || !query.data) return;
    setData(queryClient, userId, (current) => {
      const existingById = new Map(current.notes.map(note => [note.id, note]));
      const notes = query.data.notes.map((summary) => {
        const cached = existingById.get(summary.id);
        // List-content queries deliberately omit note bodies. Keep a loaded
        // body only while the database version still matches the summary.
        return cached?.contentLoaded && cached.lockVersion === summary.lockVersion
          ? { ...summary, content: cached.content, contentLoaded: true }
          : summary;
      });
      return {
        ...current,
        noteGroups: [...current.noteGroups.filter(group => group.folderId !== folderId), ...query.data.noteGroups],
        notes: [...current.notes.filter(note => note.folderId !== folderId), ...notes],
      };
    });
  }, [folderId, query.data, queryClient, userId]);
  return query;
}

export function useKnowledgeActions(): KnowledgeActions {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const debouncedSync = useDebouncedMutation({
    onTaskStateChange: (key, pending) => {
      if (!key.startsWith('note:') && key !== 'reorder:notes') return;
      const scope = `knowledge:${userId}`;
      if (pending) markPendingScope(scope);
      else clearPendingScope(scope);
    },
  });

  return useMemo<KnowledgeActions>(() => {
    // ── Lists ──
    const addList: KnowledgeActions['addList'] = (list) => {
      const data = getData(queryClient, userId);
      const newList: KnowledgeFolder = {
        ...list,
        id: createKnowledgeFolderId(),
        sortOrder: data.lists.length,
      };
      setData(queryClient, userId, () => ({ ...data, lists: [...data.lists, newList] }));
      debouncedSync.schedule(`list:${newList.id}`, async () => {
        const savedSortOrder = await knowledgeService.upsertKnowledgeFolder(newList);
        if (savedSortOrder === undefined) return;
        setData(queryClient, userId, (current) => ({
          ...current,
          lists: current.lists.map((item) => item.id === newList.id ? { ...item, sortOrder: savedSortOrder } : item),
        }));
      }, LOW_FREQ_DELAY);
      return newList;
    };

    const updateList: KnowledgeActions['updateList'] = (id, updates) => {
      const data = getData(queryClient, userId);
      const index = data.lists.findIndex(l => l.id === id);
      if (index === -1) return;
      const newLists = [...data.lists];
      newLists[index] = { ...newLists[index], ...updates };
      const list = newLists[index];
      setData(queryClient, userId, () => ({ ...data, lists: newLists }));
      debouncedSync.schedule(`list:${id}`, async () => { await knowledgeService.upsertKnowledgeFolder(list); }, HIGH_FREQ_DELAY);
    };

    const deleteKnowledgeFolder: KnowledgeActions['deleteKnowledgeFolder'] = (id) => {
      const data = getData(queryClient, userId);
      setData(queryClient, userId, () => ({
        ...data,
        lists: data.lists.filter(l => l.id !== id),
        notes: data.notes.filter(n => n.folderId !== id),
        noteGroups: data.noteGroups.filter(g => g.folderId !== id),
      }));
      debouncedSync.cancel(`list:${id}`);
      knowledgeService.deleteKnowledgeFolder(id).catch(() => {});
    };

    const reorderKnowledgeFolders: KnowledgeActions['reorderKnowledgeFolders'] = (orderedIds) => {
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
      debouncedSync.schedule('reorder:lists', () => knowledgeService.reorderKnowledgeFolders(items), LOW_FREQ_DELAY);
    };

    const moveKnowledgeFolder: KnowledgeActions['moveKnowledgeFolder'] = (folderId, knowledgeBaseId, targetIndex) => {
      const data = getData(queryClient, userId);
      const listIndex = data.lists.findIndex(l => l.id === folderId);
      if (listIndex === -1) return;

      const list = { ...data.lists[listIndex], knowledgeBaseId };
      let newLists = [...data.lists];
      newLists[listIndex] = list;

      const siblingLists = newLists
        .filter(l => l.knowledgeBaseId === knowledgeBaseId && l.id !== folderId)
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
      const updatedList = newLists.find(l => l.id === folderId);
      debouncedSync.schedule(
        `list:${folderId}`,
        () => knowledgeService.moveKnowledgeFolder(folderId, knowledgeBaseId, updatedList?.sortOrder || 0),
        LOW_FREQ_DELAY
      );
    };

    // ── Note Groups ──
    const addGroup: KnowledgeActions['addGroup'] = (folderId, name) => {
      const data = getData(queryClient, userId);
      const newGroup: NoteGroup = {
        id: createNoteGroupId(),
        folderId,
        name,
        sortOrder: data.noteGroups.filter(g => g.folderId === folderId).length,
      };
      setData(queryClient, userId, () => ({ ...data, noteGroups: [...data.noteGroups, newGroup] }));
      debouncedSync.schedule(`group:${newGroup.id}`, async () => {
        const savedSortOrder = await knowledgeService.upsertGroup(newGroup);
        if (savedSortOrder === undefined) return;
        setData(queryClient, userId, (current) => ({
          ...current,
          noteGroups: current.noteGroups.map((item) => item.id === newGroup.id ? { ...item, sortOrder: savedSortOrder } : item),
        }));
      }, LOW_FREQ_DELAY);
      return newGroup;
    };

    const updateGroup: KnowledgeActions['updateGroup'] = (id, updates) => {
      const data = getData(queryClient, userId);
      const index = data.noteGroups.findIndex(g => g.id === id);
      if (index === -1) return;
      const newGroups = [...data.noteGroups];
      newGroups[index] = { ...newGroups[index], ...updates };
      const group = newGroups[index];
      setData(queryClient, userId, () => ({ ...data, noteGroups: newGroups }));
      debouncedSync.schedule(`group:${id}`, async () => { await knowledgeService.upsertGroup(group); }, HIGH_FREQ_DELAY);
    };

    const deleteGroup: KnowledgeActions['deleteGroup'] = (id) => {
      const data = getData(queryClient, userId);
      setData(queryClient, userId, () => ({
        ...data,
        noteGroups: data.noteGroups.filter(g => g.id !== id),
        notes: data.notes.map(n => (n.groupId === id ? { ...n, groupId: null } : n)),
      }));
      debouncedSync.cancel(`group:${id}`);
      knowledgeService.deleteGroup(id).catch(() => {});
    };

    // ── Notes ──
    const addNote: KnowledgeActions['addNote'] = (note) => {
      const data = getData(queryClient, userId);
      const siblingNotes = data.notes.filter(n => n.folderId === note.folderId && n.groupId === note.groupId);
      const newNote: Note = {
        ...note,
        id: createNoteId(),
        sortOrder: siblingNotes.length,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isNew: true,
      };
      setData(queryClient, userId, () => ({ ...data, notes: [...data.notes, newNote] }));
      debouncedSync.schedule(`note:${newNote.id}`, async () => {
        const latest = getData(queryClient, userId).notes.find(item => item.id === newNote.id);
        if (!latest) return;
        const saved = await knowledgeService.upsertNote(latest);
        if (saved === undefined) return;
        setData(queryClient, userId, (current) => ({
          ...current,
          notes: current.notes.map((item) =>
            item.id === newNote.id && item.lockVersion === latest.lockVersion
              ? {
                  ...item,
                  updatedAt: item.updatedAt === latest.updatedAt ? saved.updatedAt : item.updatedAt,
                  lockVersion: saved.lockVersion,
                  isNew: false,
                  sortOrder: saved.sortOrder,
                }
              : item,
          ),
        }));
      }, LOW_FREQ_DELAY);
      return newNote;
    };

    const updateNote: KnowledgeActions['updateNote'] = (id, updates) => {
      const delay = updates.title !== undefined || updates.content !== undefined
        ? NOTE_EDIT_DELAY
        : HIGH_FREQ_DELAY;
      const data = getData(queryClient, userId);
      const index = data.notes.findIndex(n => n.id === id);
      if (index === -1) {
        // A metadata-only cache cannot safely manufacture an expected version.
        // Refetch instead of issuing an unconditional patch that can overwrite
        // another window's newer note body.
        void queryClient.invalidateQueries({
          queryKey: queryKeys.lists.all(userId),
          refetchType: 'active',
        });
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
        lockVersion: newNotes[index].lockVersion,
      };
      // Content writes must retain this complete snapshot. A folder-content
      // refetch contains note metadata only and can replace the cache entry
      // before the debounce expires.
      setData(queryClient, userId, () => ({ ...data, notes: newNotes }));
      debouncedSync.schedule(`note:${id}`, async () => {
        const latest = getData(queryClient, userId).notes.find(item => item.id === id);
        if (!latest) return;
        let saved: knowledgeService.SavedNoteVersion | undefined;
        let savedSortOrder: number | undefined;
        if (updates.content !== undefined) {
          const savedNote = await knowledgeService.upsertNote(latest);
          saved = savedNote;
          savedSortOrder = savedNote?.sortOrder;
        } else if (latest.contentLoaded) {
          const savedNote = await knowledgeService.upsertNote(latest);
          saved = savedNote;
          savedSortOrder = savedNote?.sortOrder;
        } else {
          saved = await knowledgeService.patchNote({
            id,
            folderId: updates.folderId,
            groupId: updates.groupId,
            title: updates.title,
            sortOrder: updates.sortOrder,
            lockVersion: latest.lockVersion,
          });
        }
        if (saved === undefined) return;
        setData(queryClient, userId, (current) => ({
          ...current,
          notes: current.notes.map((item) =>
            item.id === id && item.lockVersion === latest.lockVersion
              ? {
                  ...item,
                  updatedAt: item.updatedAt === latest.updatedAt ? saved.updatedAt : item.updatedAt,
                  lockVersion: saved.lockVersion,
                  isNew: false,
                  sortOrder: savedSortOrder ?? item.sortOrder,
                }
              : item,
          ),
        }));
      }, delay);
    };

    const deleteNote: KnowledgeActions['deleteNote'] = (id) => {
      const data = getData(queryClient, userId);
      setData(queryClient, userId, () => ({
        ...data,
        notes: data.notes.filter(n => n.id !== id),
      }));
      debouncedSync.cancel(`note:${id}`);
      knowledgeService.deleteNote(id).catch(() => {});
    };

    const moveNoteAndReorder: KnowledgeActions['moveNoteAndReorder'] = (noteId, groupId, targetIndex) => {
      const data = getData(queryClient, userId);
      const noteIndex = data.notes.findIndex(n => n.id === noteId);
      if (noteIndex === -1) return;

      let newNotes = [...data.notes];
      const note = { ...newNotes[noteIndex], groupId, updatedAt: Date.now() };
      newNotes[noteIndex] = note;

      const siblingNotes = newNotes
        .filter(n => n.folderId === note.folderId && n.groupId === groupId && n.id !== noteId)
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
      debouncedSync.schedule(
        `note:${noteId}`,
        async () => {
          const latest = getData(queryClient, userId).notes.find(item => item.id === noteId);
          if (!latest) return;
          const saved = latest.isNew
            ? await knowledgeService.upsertNote(latest)
            : await knowledgeService.moveNote(
              noteId,
              latest.folderId,
              latest.groupId ?? null,
              latest.sortOrder ?? updatedNote?.sortOrder ?? 0,
              latest.lockVersion,
            );
          if (saved === undefined) return;
          setData(queryClient, userId, (current) => ({
            ...current,
            notes: current.notes.map((item) => item.id === noteId
              ? {
                  ...item,
                  updatedAt: saved.updatedAt,
                  lockVersion: saved.lockVersion,
                  isNew: false,
                  sortOrder: item.sortOrder,
                }
              : item),
          }));
        },
        LOW_FREQ_DELAY
      );
    };

    const moveNoteToList: KnowledgeActions['moveNoteToList'] = (noteId, targetListId, targetGroupId = null) => {
      const data = getData(queryClient, userId);
      const noteIndex = data.notes.findIndex(n => n.id === noteId);
      if (noteIndex === -1) return;

      const oldNote = data.notes[noteIndex];
      if (oldNote.folderId === targetListId && oldNote.groupId === targetGroupId) return;

      const targetListNotes = data.notes.filter(n => n.folderId === targetListId);
      const maxSortOrder = targetListNotes.reduce((max, n) => Math.max(max, n.sortOrder || 0), -1);
      const newSortOrder = maxSortOrder + 1;

      const newNotes = [...data.notes];
      newNotes[noteIndex] = {
        ...oldNote,
        folderId: targetListId,
        groupId: targetGroupId,
        sortOrder: newSortOrder,
        updatedAt: Date.now(),
      };

      setData(queryClient, userId, () => ({ ...data, notes: newNotes }));
      debouncedSync.schedule(
        `note:${noteId}`,
        async () => {
          const latest = getData(queryClient, userId).notes.find(item => item.id === noteId);
          if (!latest) return;
          const saved = latest.isNew
            ? await knowledgeService.upsertNote(latest)
            : await knowledgeService.moveNote(
              noteId,
              latest.folderId,
              latest.groupId ?? null,
              latest.sortOrder ?? newSortOrder,
              latest.lockVersion,
            );
          if (saved === undefined) return;
          setData(queryClient, userId, (current) => ({
            ...current,
            notes: current.notes.map((item) => item.id === noteId
              ? {
                  ...item,
                  updatedAt: saved.updatedAt,
                  lockVersion: saved.lockVersion,
                  isNew: false,
                  sortOrder: item.sortOrder,
                }
              : item),
          }));
        },
        LOW_FREQ_DELAY
      );
    };

    const reorderNotes: KnowledgeActions['reorderNotes'] = (orderedIds) => {
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
      debouncedSync.schedule('reorder:notes', async () => {
        const savedVersions = await knowledgeService.reorderNotes(items);
        if (savedVersions === undefined) return;
        const versions = new Map(savedVersions.map((version) => [version.id, version]));
        setData(queryClient, userId, (current) => ({
          ...current,
          notes: current.notes.map((note) => {
            const saved = versions.get(note.id);
            return saved === undefined
              ? note
              : { ...note, updatedAt: saved.updatedAt, lockVersion: saved.lockVersion };
          }),
        }));
      }, LOW_FREQ_DELAY);
    };

    // ── Folders ──
    const addFolder: KnowledgeActions['addFolder'] = (name) => {
      const data = getData(queryClient, userId);
      const newFolder: KnowledgeBase = {
        id: createKnowledgeBaseId(),
        name,
        sortOrder: data.folders.length,
      };
      setData(queryClient, userId, () => ({ ...data, folders: [...data.folders, newFolder] }));
      debouncedSync.schedule(`folder:${newFolder.id}`, () => knowledgeService.upsertKnowledgeBase(newFolder), LOW_FREQ_DELAY);
      return newFolder;
    };

    const updateFolder: KnowledgeActions['updateFolder'] = (id, updates) => {
      const data = getData(queryClient, userId);
      const index = data.folders.findIndex(f => f.id === id);
      if (index === -1) return;
      const newFolders = [...data.folders];
      newFolders[index] = { ...newFolders[index], ...updates };
      const folder = newFolders[index];
      setData(queryClient, userId, () => ({ ...data, folders: newFolders }));
      debouncedSync.schedule(`folder:${id}`, () => knowledgeService.upsertKnowledgeBase(folder), HIGH_FREQ_DELAY);
    };

    const reorderKnowledgeBases: KnowledgeActions['reorderKnowledgeBases'] = (orderedIds) => {
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
      debouncedSync.schedule('reorder:folders', () => knowledgeService.reorderKnowledgeBases(items), LOW_FREQ_DELAY);
    };

    const deleteKnowledgeBase: KnowledgeActions['deleteKnowledgeBase'] = (id) => {
      const data = getData(queryClient, userId);
      setData(queryClient, userId, () => ({
        ...data,
        folders: data.folders.filter(f => f.id !== id),
        lists: data.lists.map(l => (l.knowledgeBaseId === id ? { ...l, knowledgeBaseId: null } : l)),
      }));
      debouncedSync.cancel(`folder:${id}`);
      knowledgeService.deleteKnowledgeBase(id).catch(() => {});
    };

    // ── Duplicate (composes the primitives above) ──
    const duplicateKnowledgeFolder: KnowledgeActions['duplicateKnowledgeFolder'] = (list) => {
      const newList = addList({ ...list, name: list.name + ' (副本)' });

      const sourceGroups = selectNoteGroups(getData(queryClient, userId).noteGroups, list.id);
      const groupMap = new Map<string, string>();
      sourceGroups.forEach(group => {
        const newGroup = addGroup(newList.id, group.name);
        updateGroup(newGroup.id, { sortOrder: group.sortOrder });
        groupMap.set(group.id, newGroup.id);
      });

      const sourceNotes = selectNotesByFolderId(getData(queryClient, userId).notes, list.id);
      sourceNotes.forEach(note => {
        addNote({
          folderId: newList.id,
          groupId: note.groupId ? groupMap.get(note.groupId) || null : null,
          title: note.title,
          content: note.content,
          contentLoaded: true,
        });
      });

      knowledgeService.duplicateKnowledgeFolder(list.id, newList).catch(() => {});

      return newList;
    };

    const flushNote = async (id: string) => {
      await debouncedSync.flush(`note:${id}`);
    };

    return {
      addList,
      updateList,
      deleteKnowledgeFolder,
      duplicateKnowledgeFolder,
      reorderKnowledgeFolders,
      moveKnowledgeFolder,
      addFolder,
      updateFolder,
      reorderKnowledgeBases,
      deleteKnowledgeBase,
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
