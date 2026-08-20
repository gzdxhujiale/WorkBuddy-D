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
import { toast } from '@/components/ui/toast';
import * as knowledgeService from '@/services/knowledgeService';
import type { KnowledgeFolder, KnowledgeBase, Note, NoteGroup } from '@/types/knowledge';
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
  duplicateKnowledgeFolder: (list: KnowledgeFolder) => Promise<KnowledgeFolder>;
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
    onTaskError: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.lists.all(userId),
        refetchType: 'active',
      });
      toast.error('保存失败，已重新加载最新数据。');
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
        const saved = await knowledgeService.upsertKnowledgeFolder(newList);
        if (saved === undefined) return;
        setData(queryClient, userId, (current) => ({
          ...current,
          lists: current.lists.map((item) => item.id === newList.id ? { ...item, sortOrder: saved.sortOrder, lockVersion: saved.lockVersion, isNew: false } : item),
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
      debouncedSync.schedule(`list:${id}`, async () => {
        const saved = await knowledgeService.upsertKnowledgeFolder(list);
        if (!saved) return;
        setData(queryClient, userId, (current) => ({ ...current, lists: current.lists.map((item) => item.id === id
          ? { ...item, sortOrder: saved.sortOrder, lockVersion: saved.lockVersion, isNew: false } : item) }));
      }, HIGH_FREQ_DELAY);
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
      void knowledgeService.deleteKnowledgeFolder({ id, lockVersion: data.lists.find((list) => list.id === id)?.lockVersion })
        .catch(() => {
          toast.error('删除清单失败，已重新加载最新数据。');
          return queryClient.invalidateQueries({ queryKey: queryKeys.lists.all(userId), refetchType: 'active' });
        });
    };

    const reorderKnowledgeFolders: KnowledgeActions['reorderKnowledgeFolders'] = (orderedIds) => {
      const data = getData(queryClient, userId);
      const orderedLists = orderedIds.map((id) => data.lists.find((item) => item.id === id));
      if (orderedLists.some((item) => item?.lockVersion === undefined)) {
        toast.info('新建清单正在保存，暂不能调整顺序。');
        return;
      }
      const orderMap = new Map(orderedIds.map((id, index) => [id, index]));
      const items: knowledgeService.VersionedOrderItem[] = [];
      const newLists = data.lists.map(l => {
        if (orderMap.has(l.id)) {
          const order = orderMap.get(l.id)!;
          if (l.lockVersion !== undefined) items.push({ id: l.id, sortOrder: order, lockVersion: l.lockVersion });
          return { ...l, sortOrder: order };
        }
        return l;
      });
      setData(queryClient, userId, () => ({ ...data, lists: newLists }));
      debouncedSync.schedule('reorder:lists', async () => {
        const saved = await knowledgeService.reorderKnowledgeFolders(items);
        if (!saved) return;
        const versions = new Map(saved.map((item) => [item.id, item]));
        setData(queryClient, userId, (current) => ({ ...current, lists: current.lists.map((item) => {
          const version = versions.get(item.id);
          return version ? { ...item, sortOrder: version.sortOrder, lockVersion: version.lockVersion } : item;
        }) }));
      }, LOW_FREQ_DELAY);
    };

    const moveKnowledgeFolder: KnowledgeActions['moveKnowledgeFolder'] = (folderId, knowledgeBaseId, targetIndex) => {
      const data = getData(queryClient, userId);
      const listIndex = data.lists.findIndex(l => l.id === folderId);
      if (listIndex === -1) return;

      const sourceKnowledgeBaseId = data.lists[listIndex].knowledgeBaseId;
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

      const sourceSiblings = sourceKnowledgeBaseId === knowledgeBaseId
        ? []
        : data.lists
          .filter((item) => item.knowledgeBaseId === sourceKnowledgeBaseId && item.id !== folderId)
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id.localeCompare(b.id));
      sourceSiblings.forEach((item, index) => orderMap.set(item.id, index));

      if ([...siblingLists, ...sourceSiblings].some((item) => item.lockVersion === undefined)) {
        toast.info('新建清单正在保存，暂不能调整其结构顺序。');
        return;
      }

      newLists = newLists.map(l => (orderMap.has(l.id) ? { ...l, sortOrder: orderMap.get(l.id) } : l));
      setData(queryClient, userId, () => ({ ...data, lists: newLists }));
      debouncedSync.schedule(
        `list:${folderId}`,
        async () => {
          const current = getData(queryClient, userId);
          const moved = current.lists.find((item) => item.id === folderId);
          if (!moved) return;
          const ordered = current.lists
            .filter((item) => item.knowledgeBaseId === knowledgeBaseId)
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
            .map((item, index) => ({ id: item.id, sortOrder: index, lockVersion: item.lockVersion }));
          if (ordered.some((item) => item.lockVersion === undefined)) {
            throw new Error('清单版本尚未加载，无法原子移动并排序');
          }
          const saved = await knowledgeService.moveKnowledgeFolder({
            id: moved.id,
            knowledgeBaseId,
            name: moved.name,
            lockVersion: moved.lockVersion,
            items: ordered as knowledgeService.VersionedOrderItem[],
          });
          if (!saved) return;
          const versions = new Map(saved.map((item) => [item.id, item]));
          setData(queryClient, userId, (current) => ({ ...current, lists: current.lists.map((item) => {
            const version = versions.get(item.id);
            return version ? { ...item, sortOrder: version.sortOrder, lockVersion: version.lockVersion } : item;
          }) }));
        },
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
        const saved = await knowledgeService.upsertGroup(newGroup);
        if (saved === undefined) return;
        setData(queryClient, userId, (current) => ({
          ...current,
          noteGroups: current.noteGroups.map((item) => item.id === newGroup.id ? { ...item, sortOrder: saved.sortOrder, lockVersion: saved.lockVersion, isNew: false } : item),
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
      debouncedSync.schedule(`group:${id}`, async () => {
        const saved = await knowledgeService.upsertGroup(group);
        if (!saved) return;
        setData(queryClient, userId, (current) => ({ ...current, noteGroups: current.noteGroups.map((item) => item.id === id
          ? { ...item, sortOrder: saved.sortOrder, lockVersion: saved.lockVersion, isNew: false } : item) }));
      }, HIGH_FREQ_DELAY);
    };

    const deleteGroup: KnowledgeActions['deleteGroup'] = (id) => {
      const data = getData(queryClient, userId);
      setData(queryClient, userId, () => ({
        ...data,
        noteGroups: data.noteGroups.filter(g => g.id !== id),
        notes: data.notes.map(n => (n.groupId === id ? { ...n, groupId: null } : n)),
      }));
      debouncedSync.cancel(`group:${id}`);
      void knowledgeService.deleteGroup({ id, lockVersion: data.noteGroups.find((group) => group.id === id)?.lockVersion })
        .catch(() => {
          toast.error('删除分组失败，已重新加载最新数据。');
          return queryClient.invalidateQueries({ queryKey: queryKeys.lists.all(userId), refetchType: 'active' });
        });
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
      void knowledgeService.deleteNote({ id, lockVersion: data.notes.find((note) => note.id === id)?.lockVersion })
        .catch(() => {
          toast.error('删除笔记失败，已重新加载最新数据。');
          return queryClient.invalidateQueries({ queryKey: queryKeys.lists.all(userId), refetchType: 'active' });
        });
    };

    const moveNoteAndReorder: KnowledgeActions['moveNoteAndReorder'] = (noteId, groupId, targetIndex) => {
      const data = getData(queryClient, userId);
      const noteIndex = data.notes.findIndex(n => n.id === noteId);
      if (noteIndex === -1) return;

      let newNotes = [...data.notes];
      const sourceGroupId = data.notes[noteIndex].groupId;
      const note = { ...newNotes[noteIndex], groupId, updatedAt: Date.now() };
      newNotes[noteIndex] = note;

      const siblingNotes = newNotes
        .filter(n => n.folderId === note.folderId && n.groupId === groupId && n.id !== noteId)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id.localeCompare(b.id));

      if (targetIndex !== undefined) {
        siblingNotes.splice(targetIndex, 0, note);
      } else {
        siblingNotes.push(note);
      }

      const orderMap = new Map<string, number>();
      siblingNotes.forEach((n, idx) => orderMap.set(n.id, idx));

      const sourceSiblings = sourceGroupId === groupId
        ? []
        : data.notes
          .filter((item) => item.folderId === note.folderId && item.groupId === sourceGroupId && item.id !== noteId)
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id.localeCompare(b.id));
      sourceSiblings.forEach((item, index) => orderMap.set(item.id, index));

      if ([...siblingNotes, ...sourceSiblings].some((item) => item.lockVersion === undefined)) {
        toast.info('新建笔记正在保存，暂不能调整其结构顺序。');
        return;
      }

      newNotes = newNotes.map(n => (orderMap.has(n.id) ? { ...n, sortOrder: orderMap.get(n.id)! } : n));
      setData(queryClient, userId, () => ({ ...data, notes: newNotes }));
      debouncedSync.schedule(
        `note:${noteId}`,
        async () => {
          const current = getData(queryClient, userId);
          const latest = current.notes.find(item => item.id === noteId);
          if (!latest) return;
          const ordered = current.notes
            .filter((item) => item.folderId === latest.folderId && item.groupId === latest.groupId)
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
            .map((item, index) => ({ id: item.id, sortOrder: index, lockVersion: item.lockVersion }));
          if (ordered.some((item) => item.lockVersion === undefined)) {
            throw new Error('笔记版本尚未加载，无法原子移动并排序');
          }
          const saved = await knowledgeService.moveNote({
            ...latest,
            items: ordered as knowledgeService.VersionedOrderItem[],
          });
          if (saved === undefined) return;
          const versions = new Map(saved.map((item) => [item.id, item]));
          setData(queryClient, userId, (current) => ({
            ...current,
            notes: current.notes.map((item) => {
              const version = versions.get(item.id);
              return version ? {
                ...item,
                updatedAt: version.updatedAt,
                lockVersion: version.lockVersion,
                isNew: false,
                sortOrder: version.sortOrder,
              } : item;
            }),
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
      if (oldNote.lockVersion === undefined) {
        toast.info('新建笔记正在保存，暂不能移动。');
        return;
      }

      const sourceSiblings = data.notes
        .filter((item) => item.folderId === oldNote.folderId && item.groupId === oldNote.groupId && item.id !== noteId)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id.localeCompare(b.id));
      if (sourceSiblings.some((item) => item.lockVersion === undefined)) {
        toast.info('源清单中有新建笔记正在保存，暂不能移动。');
        return;
      }

      const sourceOrder = new Map(sourceSiblings.map((item, index) => [item.id, index]));
      const newNotes = data.notes.map((item) => sourceOrder.has(item.id)
        ? { ...item, sortOrder: sourceOrder.get(item.id)! }
        : item);
      newNotes[noteIndex] = {
        ...oldNote,
        folderId: targetListId,
        groupId: targetGroupId,
        updatedAt: Date.now(),
      };

      setData(queryClient, userId, () => ({ ...data, notes: newNotes }));
      debouncedSync.schedule(
        `note:${noteId}`,
        async () => {
          const latest = getData(queryClient, userId).notes.find(item => item.id === noteId);
          if (!latest) return;
          if (latest.lockVersion === undefined) {
            throw new Error('笔记版本尚未加载，无法移动');
          }
          const saved = await knowledgeService.moveNote(latest);
          if (saved === undefined) return;
          const versions = new Map(saved.map((item) => [item.id, item]));
          setData(queryClient, userId, (current) => ({
            ...current,
            notes: current.notes.map((item) => {
              const version = versions.get(item.id);
              return version ? {
                ...item,
                updatedAt: version.updatedAt,
                lockVersion: version.lockVersion,
                isNew: false,
                sortOrder: version.sortOrder,
              } : item;
            }),
          }));
        },
        LOW_FREQ_DELAY
      );
    };

    const reorderNotes: KnowledgeActions['reorderNotes'] = (orderedIds) => {
      const data = getData(queryClient, userId);
      const orderedNotes = orderedIds.map((id) => data.notes.find((item) => item.id === id));
      if (orderedNotes.some((item) => item?.lockVersion === undefined)) {
        toast.info('新建笔记正在保存，暂不能调整顺序。');
        return;
      }
      const orderMap = new Map(orderedIds.map((id, index) => [id, index]));
      const items: knowledgeService.VersionedOrderItem[] = [];
      const newNotes = data.notes.map(n => {
        if (orderMap.has(n.id)) {
          const order = orderMap.get(n.id)!;
          if (n.lockVersion !== undefined) items.push({ id: n.id, sortOrder: order, lockVersion: n.lockVersion });
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
              : { ...note, updatedAt: saved.updatedAt, lockVersion: saved.lockVersion, sortOrder: saved.sortOrder };
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
      debouncedSync.schedule(`folder:${newFolder.id}`, async () => {
        const saved = await knowledgeService.upsertKnowledgeBase(newFolder);
        if (!saved) return;
        setData(queryClient, userId, (current) => ({ ...current, folders: current.folders.map((item) => item.id === newFolder.id
          ? { ...item, sortOrder: saved.sortOrder, lockVersion: saved.lockVersion, isNew: false } : item) }));
      }, LOW_FREQ_DELAY);
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
      debouncedSync.schedule(`folder:${id}`, async () => {
        const saved = await knowledgeService.upsertKnowledgeBase(folder);
        if (!saved) return;
        setData(queryClient, userId, (current) => ({ ...current, folders: current.folders.map((item) => item.id === id
          ? { ...item, sortOrder: saved.sortOrder, lockVersion: saved.lockVersion, isNew: false } : item) }));
      }, HIGH_FREQ_DELAY);
    };

    const reorderKnowledgeBases: KnowledgeActions['reorderKnowledgeBases'] = (orderedIds) => {
      const data = getData(queryClient, userId);
      const orderedBases = orderedIds.map((id) => data.folders.find((item) => item.id === id));
      if (orderedBases.some((item) => item?.lockVersion === undefined)) {
        toast.info('新建知识库正在保存，暂不能调整顺序。');
        return;
      }
      const orderMap = new Map(orderedIds.map((id, index) => [id, index]));
      const items: knowledgeService.VersionedOrderItem[] = [];
      const newFolders = data.folders.map(f => {
        if (orderMap.has(f.id)) {
          const order = orderMap.get(f.id)!;
          if (f.lockVersion !== undefined) items.push({ id: f.id, sortOrder: order, lockVersion: f.lockVersion });
          return { ...f, sortOrder: order };
        }
        return f;
      });
      setData(queryClient, userId, () => ({ ...data, folders: newFolders }));
      debouncedSync.schedule('reorder:folders', async () => {
        const saved = await knowledgeService.reorderKnowledgeBases(items);
        if (!saved) return;
        const versions = new Map(saved.map((item) => [item.id, item]));
        setData(queryClient, userId, (current) => ({ ...current, folders: current.folders.map((item) => {
          const version = versions.get(item.id);
          return version ? { ...item, sortOrder: version.sortOrder, lockVersion: version.lockVersion } : item;
        }) }));
      }, LOW_FREQ_DELAY);
    };

    const deleteKnowledgeBase: KnowledgeActions['deleteKnowledgeBase'] = (id) => {
      const data = getData(queryClient, userId);
      setData(queryClient, userId, () => ({
        ...data,
        folders: data.folders.filter(f => f.id !== id),
        lists: data.lists.map(l => (l.knowledgeBaseId === id ? { ...l, knowledgeBaseId: null } : l)),
      }));
      debouncedSync.cancel(`folder:${id}`);
      void knowledgeService.deleteKnowledgeBase({ id, lockVersion: data.folders.find((folder) => folder.id === id)?.lockVersion })
        .catch(() => {
          toast.error('删除知识库失败，已重新加载最新数据。');
          return queryClient.invalidateQueries({ queryKey: queryKeys.lists.all(userId), refetchType: 'active' });
        });
    };

    // ── Duplicate ──
    const duplicateKnowledgeFolder: KnowledgeActions['duplicateKnowledgeFolder'] = async (list) => {
      const newList = await knowledgeService.duplicateKnowledgeFolder(list.id, `${list.name} (副本)`);
      setData(queryClient, userId, (current) => ({ ...current, lists: [...current.lists, newList] }));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.lists.all(userId),
        refetchType: 'active',
      });
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
