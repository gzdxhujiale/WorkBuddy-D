import { apiClient } from "@/lib/apiClient";
import { registerOfflineExecutor, runOrQueue } from "@/lib/offlineSyncQueue";
import type { Note, NoteGroup } from "../types";
import {
  requireLockVersion,
  type ListNotePatch,
  type SavedKnowledgeEntity,
  type SavedKnowledgeOrderEntity,
  type SavedNote,
  type SavedNoteVersion,
  type VersionedEntity,
  type VersionedOrderItem,
} from "./types";

export type NoteStructuralMove = Pick<
  Note,
  "id" | "folderId" | "groupId" | "title" | "content" | "contentLoaded" | "lockVersion"
> & {
  items?: VersionedOrderItem[];
};

function asTimestamp(val: unknown): number {
  if (!val) return Date.now();
  if (typeof val === "number") return val;
  return new Date(val as string).getTime();
}

// ---------------------------------------------------------------------------
// Remote helpers
// ---------------------------------------------------------------------------

async function remoteUpsertGroup(group: NoteGroup): Promise<SavedKnowledgeEntity> {
  const saved = await apiClient.post<any>(`/api/v1/folders/${group.folderId}/groups`, {
    id: group.id,
    folder_id: group.folderId,
    name: group.name,
    sort_order: group.sortOrder ?? 0,
    lock_version: group.lockVersion ?? 1,
  });
  return {
    updatedAt: asTimestamp(saved.updated_at || saved.updatedAt),
    lockVersion: Number(saved.lock_version || saved.lockVersion || 1),
    sortOrder: saved.sort_order ?? saved.sortOrder ?? 0,
  };
}

async function remoteDeleteGroup(entity: VersionedEntity): Promise<void> {
  requireLockVersion(entity, "删除分组");
  await apiClient.delete(`/api/v1/groups/${entity.id}`);
}

async function remoteReorderNotes(
  items: VersionedOrderItem[]
): Promise<Array<{ id: string; updatedAt: number; lockVersion: number; sortOrder: number }>> {
  const updated = await apiClient.post<any[]>("/api/v1/notes/reorder", {
    items: items.map(({ id, sortOrder }) => ({ id, sort_order: sortOrder })),
  });
  return (updated ?? []).map((item) => ({
    id: item.id,
    updatedAt: asTimestamp(item.updated_at || item.updatedAt),
    lockVersion: Number(item.lock_version || item.lockVersion || 1),
    sortOrder: item.sort_order ?? item.sortOrder ?? 0,
  }));
}

async function remoteMoveNote(note: NoteStructuralMove): Promise<SavedKnowledgeOrderEntity[]> {
  requireLockVersion(note, "移动笔记");
  await apiClient.post<any>(`/api/v1/notes/${note.id}/move`, {
    folder_id: note.folderId,
    group_id: note.groupId ?? null,
    sort_order: 0,
  });

  if (note.items && note.items.length > 0) {
    const updated = await apiClient.post<any[]>("/api/v1/notes/reorder", {
      items: note.items.map(({ id, sortOrder }) => ({ id, sort_order: sortOrder })),
    });
    return (updated ?? []).map((item) => ({
      id: item.id,
      updatedAt: asTimestamp(item.updated_at || item.updatedAt),
      lockVersion: Number(item.lock_version || item.lockVersion || 1),
      sortOrder: Number(item.sort_order ?? item.sortOrder ?? 0),
    }));
  }

  return [];
}

async function remoteSaveNote(note: Note): Promise<SavedNote> {
  if (note.lockVersion !== undefined && note.contentLoaded !== true) {
    throw new Error("笔记正文尚未加载，已阻止空内容覆盖");
  }
  let saved: any;
  if (!note.isNew && note.lockVersion !== undefined) {
    saved = await apiClient.put<any>(`/api/v1/notes/${note.id}`, {
      title: note.title,
      content: note.content,
      group_id: note.groupId ?? null,
      sort_order: note.sortOrder ?? 0,
      lock_version: note.lockVersion,
    });
  } else {
    saved = await apiClient.post<any>("/api/v1/notes", {
      id: note.id,
      folder_id: note.folderId,
      group_id: note.groupId ?? null,
      title: note.title,
      content: note.content,
      sort_order: note.sortOrder ?? 0,
      lock_version: null,
    });
  }
  return {
    updatedAt: asTimestamp(saved.updated_at || saved.updatedAt),
    lockVersion: Number(saved.lock_version || saved.lockVersion || 1),
    sortOrder: saved.sort_order ?? saved.sortOrder ?? 0,
  };
}

async function remotePatchNote(patch: ListNotePatch): Promise<SavedNoteVersion> {
  if (patch.lockVersion === undefined) throw new Error("缺少笔记版本，已阻止非条件更新");
  const saved = await apiClient.patch<any>(`/api/v1/notes/${patch.id}`, {
    title: patch.title,
    content: patch.content,
    sort_order: patch.sortOrder,
    folder_id: patch.folderId,
    group_id: patch.groupId,
    lock_version: patch.lockVersion,
  });
  return {
    updatedAt: asTimestamp(saved.updated_at || saved.updatedAt),
    lockVersion: Number(saved.lock_version || saved.lockVersion || 1),
  };
}

async function remoteDeleteNote(entity: VersionedEntity): Promise<void> {
  requireLockVersion(entity, "删除笔记");
  await apiClient.delete(`/api/v1/notes/${entity.id}`);
}

// ---------------------------------------------------------------------------
// Offline executor registrations
// ---------------------------------------------------------------------------

registerOfflineExecutor("list-group:save", async (p) => {
  await remoteUpsertGroup(p as NoteGroup);
});
registerOfflineExecutor("list-group:delete", async (p) => remoteDeleteGroup(p as VersionedEntity));

registerOfflineExecutor("note:save", async (p) => {
  await remoteSaveNote(p as Note);
});
registerOfflineExecutor("note:patch", async (p) => {
  await remotePatchNote(p as ListNotePatch);
});
registerOfflineExecutor("note:delete", async (p) => remoteDeleteNote(p as VersionedEntity));
registerOfflineExecutor("note:reorder", async (p) => {
  await remoteReorderNotes(p as VersionedOrderItem[]);
});
registerOfflineExecutor("note:move", async (p) => {
  await remoteMoveNote(p as NoteStructuralMove);
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function loadNote(id: string): Promise<Note | null> {
  try {
    const data = await apiClient.get<any>(`/api/v1/notes/${id}`);
    if (!data) return null;
    return {
      id: data.id,
      folderId: data.folder_id || data.folderId,
      groupId: data.group_id ?? data.groupId ?? null,
      title: data.title ?? "",
      content: data.content ?? "",
      contentLoaded: true,
      sortOrder: data.sort_order ?? data.sortOrder ?? 0,
      createdAt: asTimestamp(data.created_at || data.createdAt),
      updatedAt: asTimestamp(data.updated_at || data.updatedAt),
      lockVersion: Number(data.lock_version ?? data.lockVersion ?? 1),
    };
  } catch (err: any) {
    if (err?.status === 404) return null;
    throw err;
  }
}

export function upsertGroup(group: NoteGroup): Promise<SavedKnowledgeEntity | undefined> {
  return runOrQueue(
    { kind: "list-group:save", key: "list-group:" + group.id, payload: group },
    () => remoteUpsertGroup(group)
  );
}

export function deleteGroup(entity: VersionedEntity): Promise<void | undefined> {
  return runOrQueue(
    { kind: "list-group:delete", key: "list-group:" + entity.id, payload: entity },
    () => remoteDeleteGroup(entity)
  );
}

export function upsertNote(note: Note): Promise<SavedNote | undefined> {
  return runOrQueue(
    { kind: "note:save", key: "note:" + note.id, payload: note },
    () => remoteSaveNote(note)
  );
}

export function patchNote(patch: ListNotePatch): Promise<SavedNoteVersion | undefined> {
  return runOrQueue(
    { kind: "note:patch", key: "note:" + patch.id, payload: patch },
    () => remotePatchNote(patch)
  );
}

export async function deleteNote(entity: VersionedEntity): Promise<void> {
  await runOrQueue(
    { kind: "note:delete", key: "note:" + entity.id, payload: entity },
    () => remoteDeleteNote(entity)
  );
}

export function reorderNotes(
  items: VersionedOrderItem[]
): Promise<Array<{ id: string; updatedAt: number; lockVersion: number; sortOrder: number }> | undefined> {
  return runOrQueue(
    {
      kind: "note:reorder",
      key: "note:reorder:" + items.map((i) => i.id).join(","),
      payload: items,
    },
    () => remoteReorderNotes(items)
  );
}

export function moveNote(note: NoteStructuralMove): Promise<SavedKnowledgeOrderEntity[] | undefined> {
  return runOrQueue(
    { kind: "note:move", key: "note:move:" + note.id, payload: note },
    () => remoteMoveNote(note)
  );
}

export interface NoteSearchResult {
  id: string;
  userId: string;
  folderId: string;
  groupId?: string;
  title: string;
  content: string;
  sortOrder: number;
  lockVersion: number;
  createdAt: string;
  updatedAt: string;
}

export async function searchNotes(query: string): Promise<NoteSearchResult[]> {
  if (!query.trim()) return [];
  const res = await apiClient.get<any[]>(`/api/v1/notes/search?q=${encodeURIComponent(query.trim())}`);
  return (res || []).map((item) => ({
    id: item.id,
    userId: item.user_id,
    folderId: item.folder_id,
    groupId: item.group_id,
    title: item.title,
    content: item.content,
    sortOrder: item.sort_order ?? 0,
    lockVersion: Number(item.lock_version ?? 1),
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  }));
}

export async function bufferPatchNote(
  patch: ListNotePatch,
  options?: RequestInit
): Promise<{ status: string; id: string; lockVersion?: number }> {
  const res = await apiClient.patch<any>(
    `/api/v1/notes/${patch.id}/buffer`,
    {
      title: patch.title,
      content: patch.content,
      sort_order: patch.sortOrder,
      folder_id: patch.folderId,
      group_id: patch.groupId,
      lock_version: patch.lockVersion ?? 1,
    },
    options
  );
  return {
    status: res.status || "buffered",
    id: res.id,
    lockVersion: res.lock_version ? Number(res.lock_version) : undefined,
  };
}

export interface NoteSnapshot {
  id: string;
  noteId: string;
  userId: string;
  snapshotData: string;
  summary?: string;
  createdAt: string;
}

export async function createNoteSnapshot(
  noteId: string,
  snapshotData: string,
  summary?: string
): Promise<NoteSnapshot> {
  const res = await apiClient.post<any>(`/api/v1/notes/${noteId}/snapshots`, {
    snapshot_data: snapshotData,
    summary: summary || "",
  });
  return {
    id: res.id,
    noteId: res.note_id || res.noteId,
    userId: res.user_id || res.userId,
    snapshotData: res.snapshot_data || res.snapshotData || "",
    summary: typeof res.summary === "object" ? res.summary?.String || "" : res.summary || "",
    createdAt: res.created_at || res.createdAt,
  };
}

export async function listNoteSnapshots(noteId: string): Promise<NoteSnapshot[]> {
  const res = await apiClient.get<any[]>(`/api/v1/notes/${noteId}/snapshots`);
  return (res || []).map((item) => ({
    id: item.id,
    noteId: item.note_id || item.noteId,
    userId: item.user_id || item.userId,
    snapshotData: item.snapshot_data || item.snapshotData || "",
    summary: typeof item.summary === "object" ? item.summary?.String || "" : item.summary || "",
    createdAt: item.created_at || item.createdAt,
  }));
}

export async function getNoteSnapshot(noteId: string, snapshotId: string): Promise<NoteSnapshot> {
  const res = await apiClient.get<any>(`/api/v1/notes/${noteId}/snapshots/${snapshotId}`);
  return {
    id: res.id,
    noteId: res.note_id || res.noteId,
    userId: res.user_id || res.userId,
    snapshotData: res.snapshot_data || res.snapshotData || "",
    summary: typeof res.summary === "object" ? res.summary?.String || "" : res.summary || "",
    createdAt: res.created_at || res.createdAt,
  };
}

