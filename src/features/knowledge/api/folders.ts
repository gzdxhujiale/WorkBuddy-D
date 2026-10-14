import { apiClient } from "@/lib/apiClient";
import { registerOfflineExecutor, runOrQueue } from "@/lib/offlineSyncQueue";
import type { KnowledgeFolder, KnowledgeBase, Note, NoteGroup } from "../types";
import {
  requireLockVersion,
  type ListLoadAllPayload,
  type SavedKnowledgeEntity,
  type SavedKnowledgeOrderEntity,
  type VersionedEntity,
  type VersionedOrderItem,
} from "./types";

export type KnowledgeFolderStructuralMove = VersionedEntity & {
  knowledgeBaseId: string | null;
  name: string;
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

async function remoteUpsertKnowledgeBase(folder: KnowledgeBase): Promise<SavedKnowledgeEntity> {
  const saved = await apiClient.post<any>("/api/v1/knowledge-bases", {
    id: folder.id,
    name: folder.name,
    sort_order: folder.sortOrder ?? 0,
    lock_version: folder.lockVersion ?? 1,
  });
  return {
    updatedAt: asTimestamp(saved.updated_at || saved.updatedAt),
    lockVersion: Number(saved.lock_version || saved.lockVersion || 1),
    sortOrder: saved.sort_order ?? saved.sortOrder ?? 0,
  };
}

async function remoteDeleteKnowledgeBase(entity: VersionedEntity): Promise<void> {
  requireLockVersion(entity, "删除知识库");
  await apiClient.delete(`/api/v1/knowledge-bases/${entity.id}`);
}

async function remoteReorderKnowledgeBases(items: VersionedOrderItem[]): Promise<SavedKnowledgeOrderEntity[]> {
  const updated = await apiClient.post<any[]>("/api/v1/knowledge-bases/reorder", {
    items: items.map(({ id, sortOrder }) => ({ id, sort_order: sortOrder })),
  });
  return (updated ?? []).map((item) => ({
    id: item.id,
    updatedAt: asTimestamp(item.updated_at || item.updatedAt),
    lockVersion: Number(item.lock_version || item.lockVersion || 1),
    sortOrder: item.sort_order ?? item.sortOrder ?? 0,
  }));
}

async function remoteUpsertKnowledgeFolder(list: KnowledgeFolder): Promise<SavedKnowledgeEntity> {
  const saved = await apiClient.post<any>("/api/v1/folders", {
    id: list.id,
    knowledge_base_id: list.knowledgeBaseId ?? null,
    name: list.name,
    sort_order: list.sortOrder ?? 0,
    lock_version: list.lockVersion ?? 1,
  });
  return {
    updatedAt: asTimestamp(saved.updated_at || saved.updatedAt),
    lockVersion: Number(saved.lock_version || saved.lockVersion || 1),
    sortOrder: saved.sort_order ?? saved.sortOrder ?? 0,
  };
}

async function remoteDeleteKnowledgeFolder(entity: VersionedEntity): Promise<void> {
  requireLockVersion(entity, "删除文件夹");
  await apiClient.delete(`/api/v1/folders/${entity.id}`);
}

async function remoteMoveKnowledgeFolder(entity: KnowledgeFolderStructuralMove): Promise<SavedKnowledgeOrderEntity[]> {
  requireLockVersion(entity, "移动文件夹");
  await apiClient.post<any>("/api/v1/folders", {
    id: entity.id,
    knowledge_base_id: entity.knowledgeBaseId,
    name: entity.name,
    sort_order: 0,
    lock_version: entity.lockVersion,
  });

  if (entity.items && entity.items.length > 0) {
    const updated = await apiClient.post<any[]>("/api/v1/folders/reorder", {
      items: entity.items.map(({ id, sortOrder }) => ({ id, sort_order: sortOrder })),
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

async function remoteReorderKnowledgeFolders(items: VersionedOrderItem[]): Promise<SavedKnowledgeOrderEntity[]> {
  const updated = await apiClient.post<any[]>("/api/v1/folders/reorder", {
    items: items.map(({ id, sortOrder }) => ({ id, sort_order: sortOrder })),
  });
  return (updated ?? []).map((item) => ({
    id: item.id,
    updatedAt: asTimestamp(item.updated_at || item.updatedAt),
    lockVersion: Number(item.lock_version || item.lockVersion || 1),
    sortOrder: item.sort_order ?? item.sortOrder ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Offline executor registrations
// ---------------------------------------------------------------------------

registerOfflineExecutor("list-folder:save", async (p) => {
  await remoteUpsertKnowledgeBase(p as KnowledgeBase);
});
registerOfflineExecutor("list-folder:delete", async (p) => remoteDeleteKnowledgeBase(p as VersionedEntity));
registerOfflineExecutor("list-folder:reorder", async (p) => {
  await remoteReorderKnowledgeBases(p as VersionedOrderItem[]);
});

registerOfflineExecutor("list:save", async (p) => {
  await remoteUpsertKnowledgeFolder(p as KnowledgeFolder);
});
registerOfflineExecutor("list:delete", async (p) => remoteDeleteKnowledgeFolder(p as VersionedEntity));
registerOfflineExecutor("list:move", async (p) => {
  await remoteMoveKnowledgeFolder(p as KnowledgeFolderStructuralMove);
});
registerOfflineExecutor("list:reorder", async (p) => {
  await remoteReorderKnowledgeFolders(p as VersionedOrderItem[]);
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function loadKnowledgeFolderContents(
  folderId: string
): Promise<Pick<ListLoadAllPayload, "noteGroups" | "notes">> {
  const [groupsRes, notesRes] = await Promise.all([
    apiClient.get<any[]>(`/api/v1/folders/${folderId}/groups`),
    apiClient.get<any[]>(`/api/v1/folders/${folderId}/notes`),
  ]);

  const noteGroups: NoteGroup[] = (groupsRes ?? []).map((g) => ({
    id: g.id,
    folderId: g.folder_id || g.folderId,
    name: g.name,
    sortOrder: g.sort_order ?? g.sortOrder ?? 0,
    lockVersion: Number(g.lock_version ?? g.lockVersion ?? 1),
  }));

  const notes: Note[] = (notesRes ?? []).map((n) => ({
    id: n.id,
    folderId: n.folder_id || n.folderId,
    groupId: n.group_id ?? n.groupId ?? null,
    title: n.title ?? "",
    content: "",
    contentLoaded: false,
    sortOrder: n.sort_order ?? n.sortOrder ?? 0,
    createdAt: asTimestamp(n.created_at || n.createdAt),
    updatedAt: asTimestamp(n.updated_at || n.updatedAt),
    lockVersion: Number(n.lock_version ?? n.lockVersion ?? 1),
  }));

  return { noteGroups, notes };
}

export function upsertKnowledgeBase(folder: KnowledgeBase): Promise<SavedKnowledgeEntity | undefined> {
  return runOrQueue(
    { kind: "list-folder:save", key: "list-folder:" + folder.id, payload: folder },
    () => remoteUpsertKnowledgeBase(folder)
  );
}

export function deleteKnowledgeBase(entity: VersionedEntity): Promise<void | undefined> {
  return runOrQueue(
    { kind: "list-folder:delete", key: "list-folder:" + entity.id, payload: entity },
    () => remoteDeleteKnowledgeBase(entity)
  );
}

export function reorderKnowledgeBases(
  items: VersionedOrderItem[]
): Promise<SavedKnowledgeOrderEntity[] | undefined> {
  return runOrQueue(
    {
      kind: "list-folder:reorder",
      key: "list-folder:reorder:" + items.map((i) => i.id).join(","),
      payload: items,
    },
    () => remoteReorderKnowledgeBases(items)
  );
}

export function upsertKnowledgeFolder(list: KnowledgeFolder): Promise<SavedKnowledgeEntity | undefined> {
  return runOrQueue(
    { kind: "list:save", key: "list:" + list.id, payload: list },
    () => remoteUpsertKnowledgeFolder(list)
  );
}

export function deleteKnowledgeFolder(entity: VersionedEntity): Promise<void | undefined> {
  return runOrQueue(
    { kind: "list:delete", key: "list:" + entity.id, payload: entity },
    () => remoteDeleteKnowledgeFolder(entity)
  );
}

export function moveKnowledgeFolder(
  entity: KnowledgeFolderStructuralMove
): Promise<SavedKnowledgeOrderEntity[] | undefined> {
  return runOrQueue(
    { kind: "list:move", key: "list:move:" + entity.id, payload: entity },
    () => remoteMoveKnowledgeFolder(entity)
  );
}

export function reorderKnowledgeFolders(
  items: VersionedOrderItem[]
): Promise<SavedKnowledgeOrderEntity[] | undefined> {
  return runOrQueue(
    {
      kind: "list:reorder",
      key: "list:reorder:" + items.map((i) => i.id).join(","),
      payload: items,
    },
    () => remoteReorderKnowledgeFolders(items)
  );
}

export async function duplicateKnowledgeFolder(sourceId: string, newName: string): Promise<KnowledgeFolder> {
  const cloned = await apiClient.post<any>(`/api/v1/folders/${sourceId}/duplicate`, {
    new_name: newName,
  });
  if (!cloned) throw new Error("复制清单未返回结果");
  return {
    id: cloned.id,
    knowledgeBaseId: cloned.knowledge_base_id ?? cloned.knowledgeBaseId ?? null,
    name: cloned.name,
    sortOrder: Number(cloned.sort_order ?? cloned.sortOrder ?? 0),
    lockVersion: Number(cloned.lock_version ?? cloned.lockVersion ?? 1),
  };
}
