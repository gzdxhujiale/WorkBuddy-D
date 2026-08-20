/**
 * knowledgeService - unified data-access layer for the Lists module.
 *
 * Centralizes the Lists module's Supabase access and type mapping in one seam.
 * All write operations pass through runOrQueue for durable offline replay.
 *
 * NOTE(design): Realtime channel split was evaluated and intentionally skipped.
 * Supabase recommends reusing one channel per user for multiple table listeners,
 * mapping to a single WebSocket connection. Splitting would add connections.
 */

import { supabase } from "@/lib/supabase";
import { throwOnPostgrestError } from "@/lib/sync";
import { registerOfflineExecutor, runOrQueue } from "@/lib/offlineSyncQueue";
import type { KnowledgeFolder, KnowledgeBase, Note, NoteGroup, KnowledgeTemplate } from "@/types/knowledge";

// ---------------------------------------------------------------------------
// Public data-shape types
// ---------------------------------------------------------------------------

export type ListLoadAllPayload = {
  folders: KnowledgeBase[];
  lists: KnowledgeFolder[];
  noteGroups: NoteGroup[];
  notes: Note[];
};

export type ListNotePatch = {
  id: string;
  folderId?: string;
  groupId?: string | null;
  title?: string;
  content?: string;
  sortOrder?: number;
  lockVersion?: number;
};

export type SavedNote = { updatedAt: number; lockVersion: number; sortOrder: number };
export type SavedNoteVersion = { updatedAt: number; lockVersion: number };
export type SavedKnowledgeEntity = { updatedAt: number; lockVersion: number; sortOrder: number };
export type SavedKnowledgeOrderEntity = SavedKnowledgeEntity & { id: string };
export type VersionedEntity = { id: string; lockVersion?: number };
export type VersionedOrderItem = VersionedEntity & { sortOrder: number };

function requireLockVersion(entity: VersionedEntity, action: string): number {
  if (entity.lockVersion === undefined) {
    throw new Error(`${action}缺少版本，已阻止非条件写入`);
  }
  return entity.lockVersion;
}

// ---------------------------------------------------------------------------
// Remote helpers (private)
// ---------------------------------------------------------------------------

async function remoteUpsertKnowledgeBase(folder: KnowledgeBase): Promise<SavedKnowledgeEntity> {
  const { data, error } = await supabase.rpc("save_knowledge_base_v2", {
    p_id: folder.id, p_name: folder.name,
    p_sort_order: folder.sortOrder ?? 0,
    p_expected_lock_version: folder.lockVersion ?? null,
  });
  throwOnPostgrestError(error, "\u4fdd\u5b58\u77e5\u8bc6\u5e93");
  const saved = (data as Array<{ updated_at: string; lock_version: number; sort_order: number }>)[0];
  return { updatedAt: new Date(saved.updated_at).getTime(), lockVersion: Number(saved.lock_version), sortOrder: saved.sort_order };
}

async function remoteDeleteKnowledgeBase(entity: VersionedEntity): Promise<void> {
  const { error } = await supabase.rpc("soft_delete_knowledge_base_v3", { p_id: entity.id, p_expected_lock_version: requireLockVersion(entity, "删除知识库") });
  throwOnPostgrestError(error, "\u5220\u9664\u77e5\u8bc6\u5e93");
}

async function remoteReorderKnowledgeBases(items: VersionedOrderItem[]): Promise<SavedKnowledgeOrderEntity[]> {
  const { data, error } = await supabase.rpc("reorder_knowledge_bases_v3", {
    p_items: items.map(({ id, sortOrder, lockVersion }) => ({ id, sort_order: sortOrder, lock_version: requireLockVersion({ id, lockVersion }, "排序知识库") })),
  });
  throwOnPostgrestError(error, "\u6392\u5e8f\u77e5\u8bc6\u5e93");
  return ((data ?? []) as Array<{ id: string; updated_at: string; lock_version: number; sort_order: number }>).map((item) => ({ id: item.id, updatedAt: new Date(item.updated_at).getTime(), lockVersion: Number(item.lock_version), sortOrder: item.sort_order }));
}

async function remoteUpsertKnowledgeFolder(list: KnowledgeFolder): Promise<SavedKnowledgeEntity> {
  const { data, error } = await supabase.rpc("save_knowledge_base_folder_v2", {
    p_id: list.id, p_knowledge_base_id: list.knowledgeBaseId ?? null,
    p_name: list.name,
    p_sort_order: list.sortOrder ?? 0,
    p_expected_lock_version: list.lockVersion ?? null,
  });
  throwOnPostgrestError(error, "\u4fdd\u5b58\u6e05\u5355");
  const saved = (data as Array<{ updated_at: string; lock_version: number; sort_order: number }>)[0];
  return { updatedAt: new Date(saved.updated_at).getTime(), lockVersion: Number(saved.lock_version), sortOrder: saved.sort_order };
}

async function remoteDeleteKnowledgeFolder(entity: VersionedEntity): Promise<void> {
  const { error } = await supabase.rpc("soft_delete_knowledge_base_folder_v3", { p_id: entity.id, p_expected_lock_version: requireLockVersion(entity, "删除清单") });
  throwOnPostgrestError(error, "\u5220\u9664\u6e05\u5355");
}

export type KnowledgeFolderStructuralMove = VersionedEntity & {
  knowledgeBaseId: string | null;
  name: string;
  items?: VersionedOrderItem[];
};

async function remoteMoveKnowledgeFolder(entity: KnowledgeFolderStructuralMove): Promise<SavedKnowledgeOrderEntity[]> {
  const { data, error } = await supabase.rpc("move_and_reorder_knowledge_base_folders_v3", {
    p_id: entity.id,
    p_knowledge_base_id: entity.knowledgeBaseId,
    p_name: entity.name,
    p_expected_lock_version: requireLockVersion(entity, "移动清单"),
    p_items: entity.items === undefined ? null : entity.items.map(({ id, sortOrder, lockVersion }) => ({
      id,
      sort_order: sortOrder,
      lock_version: requireLockVersion({ id, lockVersion }, "移动清单排序"),
    })),
  });
  throwOnPostgrestError(error, "\u79fb\u52a8\u6e05\u5355");
  return ((data ?? []) as Array<{ id: string; updated_at: string; lock_version: number; sort_order: number }>).map((item) => ({
    id: item.id,
    updatedAt: new Date(item.updated_at).getTime(),
    lockVersion: Number(item.lock_version),
    sortOrder: Number(item.sort_order),
  }));
}

async function remoteReorderKnowledgeFolders(items: VersionedOrderItem[]): Promise<SavedKnowledgeOrderEntity[]> {
  const { data, error } = await supabase.rpc("reorder_knowledge_base_folders_v3", {
    p_items: items.map(({ id, sortOrder, lockVersion }) => ({ id, sort_order: sortOrder, lock_version: requireLockVersion({ id, lockVersion }, "排序清单") })),
  });
  throwOnPostgrestError(error, "\u6392\u5e8f\u6e05\u5355");
  return ((data ?? []) as Array<{ id: string; updated_at: string; lock_version: number; sort_order: number }>).map((item) => ({ id: item.id, updatedAt: new Date(item.updated_at).getTime(), lockVersion: Number(item.lock_version), sortOrder: item.sort_order }));
}

async function remoteUpsertGroup(group: NoteGroup): Promise<SavedKnowledgeEntity> {
  const { data, error } = await supabase.rpc("save_folder_note_group_v2", {
    p_id: group.id, p_folder_id: group.folderId, p_name: group.name,
    p_sort_order: group.sortOrder ?? 0,
    p_expected_lock_version: group.lockVersion ?? null,
  });
  throwOnPostgrestError(error, "\u4fdd\u5b58\u5206\u7ec4");
  const saved = (data as Array<{ updated_at: string; lock_version: number; sort_order: number }>)[0];
  return { updatedAt: new Date(saved.updated_at).getTime(), lockVersion: Number(saved.lock_version), sortOrder: saved.sort_order };
}

async function remoteDeleteGroup(entity: VersionedEntity): Promise<void> {
  const { error } = await supabase.rpc("soft_delete_folder_note_group_v3", { p_id: entity.id, p_expected_lock_version: requireLockVersion(entity, "删除分组") });
  throwOnPostgrestError(error, "\u5220\u9664\u5206\u7ec4");
}

async function remoteReorderNotes(items: VersionedOrderItem[]): Promise<Array<{ id: string; updatedAt: number; lockVersion: number; sortOrder: number }>> {
  const { data, error } = await supabase.rpc("reorder_notes_v3", {
    p_items: items.map(({ id, sortOrder, lockVersion }) => ({ id, sort_order: sortOrder, lock_version: requireLockVersion({ id, lockVersion }, "排序笔记") })),
  });
  throwOnPostgrestError(error, "\u6392\u5e8f\u7b14\u8bb0");
  return ((data ?? []) as Array<{ id: string; updated_at: string; lock_version: number; sort_order: number }>).map((item) => ({
    id: item.id,
    updatedAt: new Date(item.updated_at).getTime(),
    lockVersion: Number(item.lock_version),
    sortOrder: item.sort_order,
  }));
}

export type NoteStructuralMove = Pick<Note, "id" | "folderId" | "groupId" | "title" | "content" | "contentLoaded" | "lockVersion"> & {
  items?: VersionedOrderItem[];
};

async function remoteMoveNote(note: NoteStructuralMove): Promise<SavedKnowledgeOrderEntity[]> {
  const { data, error } = await supabase.rpc("move_and_reorder_notes_v3", {
    p_id: note.id,
    p_folder_id: note.folderId,
    p_group_id: note.groupId ?? null,
    p_title: note.title,
    p_content: note.content,
    p_content_loaded: note.contentLoaded === true,
    p_expected_lock_version: requireLockVersion(note, "移动笔记"),
    p_items: note.items === undefined ? null : note.items.map(({ id, sortOrder, lockVersion }) => ({
      id,
      sort_order: sortOrder,
      lock_version: requireLockVersion({ id, lockVersion }, "移动笔记排序"),
    })),
  });
  throwOnPostgrestError(error, "\u79fb\u52a8\u7b14\u8bb0");
  return ((data ?? []) as Array<{ id: string; updated_at: string; lock_version: number; sort_order: number }>).map((item) => ({
    id: item.id,
    updatedAt: new Date(item.updated_at).getTime(),
    lockVersion: Number(item.lock_version),
    sortOrder: Number(item.sort_order),
  }));
}

async function remoteSaveNote(note: Note): Promise<SavedNote> {
  if (note.lockVersion !== undefined && note.contentLoaded !== true) {
    throw new Error("笔记正文尚未加载，已阻止空内容覆盖");
  }
  if (note.lockVersion === undefined && !note.isNew) {
    throw new Error("笔记版本尚未加载，已阻止非条件更新");
  }
  const { data, error } = await supabase.rpc("save_note_v2", {
    p_id: note.id, p_folder_id: note.folderId, p_group_id: note.groupId ?? null,
    p_title: note.title, p_content: note.content,
    p_sort_order: note.sortOrder ?? 0,
    p_expected_lock_version: note.isNew ? null : note.lockVersion,
  });
  throwOnPostgrestError(error, "\u4fdd\u5b58\u7b14\u8bb0");
  const saved = (data as Array<{ updated_at: string; lock_version: number; sort_order: number }>)[0];
  return { updatedAt: new Date(saved.updated_at).getTime(), lockVersion: Number(saved.lock_version), sortOrder: saved.sort_order };
}

async function remotePatchNote(patch: ListNotePatch): Promise<SavedNoteVersion> {
  if (patch.lockVersion === undefined) throw new Error("缺少笔记版本，已阻止非条件更新");
  const { data, error } = await supabase.rpc("patch_note_v2", {
    p_id: patch.id,
    p_expected_lock_version: patch.lockVersion,
    p_title: patch.title, p_content: patch.content,
    p_sort_order: patch.sortOrder, p_folder_id: patch.folderId, p_group_id: patch.groupId,
    p_set_group: patch.groupId !== undefined,
  });
  throwOnPostgrestError(error, "\u66f4\u65b0\u7b14\u8bb0");
  const saved = (data as Array<{ updated_at: string; lock_version: number }>)[0];
  return { updatedAt: new Date(saved.updated_at).getTime(), lockVersion: Number(saved.lock_version) };
}

async function remoteDeleteNote(entity: VersionedEntity): Promise<void> {
  const { error } = await supabase.rpc("soft_delete_note_v3", { p_id: entity.id, p_expected_lock_version: requireLockVersion(entity, "删除笔记") });
  throwOnPostgrestError(error, "\u5220\u9664\u7b14\u8bb0");
}

async function remoteUpsertTemplate(template: KnowledgeTemplate): Promise<SavedNoteVersion> {
  const { data, error } = await supabase.rpc("save_knowledge_base_template_v2", {
    p_id: template.id, p_name: template.name,
    p_content: { raw: template.content },
    p_expected_lock_version: template.lockVersion ?? null,
  });
  throwOnPostgrestError(error, "\u4fdd\u5b58\u6a21\u677f");
  const saved = (data as Array<{ updated_at: string; lock_version: number }>)[0];
  return { updatedAt: new Date(saved.updated_at).getTime(), lockVersion: Number(saved.lock_version) };
}

async function remoteDeleteTemplate(entity: VersionedEntity): Promise<void> {
  const { error } = await supabase.rpc("soft_delete_knowledge_base_template_v3", { p_id: entity.id, p_expected_lock_version: requireLockVersion(entity, "删除模板") });
  throwOnPostgrestError(error, "\u5220\u9664\u6a21\u677f");
}

// ---------------------------------------------------------------------------
// Offline executor registrations
// ---------------------------------------------------------------------------

registerOfflineExecutor("list-folder:save", async (p) => { await remoteUpsertKnowledgeBase(p as KnowledgeBase); });
registerOfflineExecutor("list-folder:delete", async (p) => remoteDeleteKnowledgeBase(p as VersionedEntity));
registerOfflineExecutor("list-folder:reorder", async (p) => { await remoteReorderKnowledgeBases(p as VersionedOrderItem[]); });

registerOfflineExecutor("list:save", async (p) => { await remoteUpsertKnowledgeFolder(p as KnowledgeFolder); });
registerOfflineExecutor("list:delete", async (p) => remoteDeleteKnowledgeFolder(p as VersionedEntity));
registerOfflineExecutor("list:move", async (p) => {
  await remoteMoveKnowledgeFolder(p as KnowledgeFolderStructuralMove);
});
registerOfflineExecutor("list:reorder", async (p) => { await remoteReorderKnowledgeFolders(p as VersionedOrderItem[]); });

registerOfflineExecutor("list-group:save", async (p) => { await remoteUpsertGroup(p as NoteGroup); });
registerOfflineExecutor("list-group:delete", async (p) => remoteDeleteGroup(p as VersionedEntity));

registerOfflineExecutor("note:save", async (p) => { await remoteSaveNote(p as Note); });
registerOfflineExecutor("note:patch", async (p) => { await remotePatchNote(p as ListNotePatch); });
registerOfflineExecutor("note:delete", async (p) => remoteDeleteNote(p as VersionedEntity));
registerOfflineExecutor("note:reorder", async (p) => { await remoteReorderNotes(p as VersionedOrderItem[]); });
registerOfflineExecutor("note:move", async (p) => {
  await remoteMoveNote(p as NoteStructuralMove);
});

registerOfflineExecutor("template:save", async (p) => { await remoteUpsertTemplate(p as KnowledgeTemplate); });
registerOfflineExecutor("template:delete", async (p) => remoteDeleteTemplate(p as VersionedEntity));

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

/** Module shell: folders + lists only (no note content). */
export async function loadAll(): Promise<ListLoadAllPayload> {
  const [foldersRes, listsRes] = await Promise.all([
    supabase.from("knowledge_bases")
      .select("id,name,sort_order,lock_version")
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase.from("knowledge_base_folders")
      .select("id,knowledge_base_id,name,sort_order,lock_version")
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (foldersRes.error || listsRes.error) {
    throwOnPostgrestError(foldersRes.error ?? listsRes.error, "\u52a0\u8f7d\u6e05\u5355\u5bb9\u5668");
  }

  const folders: KnowledgeBase[] = (foldersRes.data ?? []).map((f) => ({
    id: f.id, name: f.name, sortOrder: f.sort_order, lockVersion: Number(f.lock_version),
  }));

  const lists: KnowledgeFolder[] = (listsRes.data ?? []).map((l) => ({
    id: l.id, name: l.name,
    knowledgeBaseId: l.knowledge_base_id ?? null,
    sortOrder: l.sort_order, lockVersion: Number(l.lock_version),
  }));

  return { folders, lists, noteGroups: [], notes: [] };
}

/** Per-list content: groups + note metadata (no body). */
export async function loadKnowledgeFolderContents(folderId: string): Promise<Pick<ListLoadAllPayload, "noteGroups" | "notes">> {
  const [groupsRes, notesRes] = await Promise.all([
    supabase.from("folder_note_groups")
      .select("id,folder_id,name,sort_order,lock_version")
      .eq("folder_id", folderId).is("deleted_at", null)
      .order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
    supabase.from("notes")
      .select("id,folder_id,group_id,title,sort_order,created_at,updated_at,lock_version")
      .eq("folder_id", folderId).is("deleted_at", null)
      .order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
  ]);

  if (groupsRes.error || notesRes.error) {
    throwOnPostgrestError(groupsRes.error ?? notesRes.error, "\u52a0\u8f7d\u6e05\u5355\u5185\u5bb9");
  }

  const noteGroups: NoteGroup[] = (groupsRes.data ?? []).map((g) => ({
    id: g.id, folderId: g.folder_id, name: g.name, sortOrder: g.sort_order, lockVersion: Number(g.lock_version),
  }));

  const notes: Note[] = (notesRes.data ?? []).map((n) => ({
    id: n.id, folderId: n.folder_id, groupId: n.group_id ?? null,
    title: n.title ?? "", content: "", contentLoaded: false,
    sortOrder: n.sort_order,
    createdAt: n.created_at ? new Date(n.created_at).getTime() : Date.now(),
    updatedAt: n.updated_at ? new Date(n.updated_at).getTime() : Date.now(),
    lockVersion: Number(n.lock_version),
  }));

  return { noteGroups, notes };
}

/** Full note body - fetched on demand before editing or exporting. */
export async function loadNote(id: string): Promise<Note | null> {
  const { data, error } = await supabase.from("notes")
    .select("id,folder_id,group_id,title,content,sort_order,created_at,updated_at,lock_version")
    .eq("id", id).is("deleted_at", null).maybeSingle();
  throwOnPostgrestError(error, "\u52a0\u8f7d\u7b14\u8bb0\u6b63\u6587");
  if (!data) return null;
  const n = data;
  return {
    id: n.id, folderId: n.folder_id, groupId: n.group_id ?? null,
    title: n.title ?? "", content: n.content ?? "", contentLoaded: true,
    sortOrder: n.sort_order,
    createdAt: n.created_at ? new Date(n.created_at).getTime() : Date.now(),
    updatedAt: n.updated_at ? new Date(n.updated_at).getTime() : Date.now(),
    lockVersion: Number(n.lock_version),
  };
}

export async function loadTemplates(): Promise<KnowledgeTemplate[]> {
  const { data, error } = await supabase.from("knowledge_base_templates")
    .select("id,name,content,lock_version")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  throwOnPostgrestError(error, "\u52a0\u8f7d\u6a21\u677f");
  return (data ?? []).map((t) => ({
    id: t.id, name: t.name,
    content: typeof t.content === "string" ? t.content : JSON.stringify(t.content), lockVersion: Number(t.lock_version),
  }));
}

// ---------------------------------------------------------------------------
// Write operations (all queue-safe via runOrQueue)
// ---------------------------------------------------------------------------

export function upsertKnowledgeBase(folder: KnowledgeBase): Promise<SavedKnowledgeEntity | undefined> {
  return runOrQueue(
    { kind: "list-folder:save", key: "list-folder:" + folder.id, payload: folder },
    () => remoteUpsertKnowledgeBase(folder),
  );
}

export function deleteKnowledgeBase(entity: VersionedEntity): Promise<void | undefined> {
  return runOrQueue(
    { kind: "list-folder:delete", key: "list-folder:" + entity.id, payload: entity },
    () => remoteDeleteKnowledgeBase(entity),
  );
}

export function reorderKnowledgeBases(items: VersionedOrderItem[]): Promise<SavedKnowledgeOrderEntity[] | undefined> {
  return runOrQueue(
    { kind: "list-folder:reorder", key: "list-folder:reorder", payload: items },
    () => remoteReorderKnowledgeBases(items),
  );
}

export function upsertKnowledgeFolder(list: KnowledgeFolder): Promise<SavedKnowledgeEntity | undefined> {
  return runOrQueue(
    { kind: "list:save", key: "list:" + list.id, payload: list },
    () => remoteUpsertKnowledgeFolder(list),
  );
}

export function deleteKnowledgeFolder(entity: VersionedEntity): Promise<void | undefined> {
  return runOrQueue(
    { kind: "list:delete", key: "list:" + entity.id, payload: entity },
    () => remoteDeleteKnowledgeFolder(entity),
  );
}

export function moveKnowledgeFolder(entity: KnowledgeFolderStructuralMove): Promise<SavedKnowledgeOrderEntity[] | undefined> {
  return runOrQueue(
    { kind: "list:move", key: "list:move:" + entity.id, payload: entity },
    () => remoteMoveKnowledgeFolder(entity),
  );
}

export function reorderKnowledgeFolders(items: VersionedOrderItem[]): Promise<SavedKnowledgeOrderEntity[] | undefined> {
  return runOrQueue(
    { kind: "list:reorder", key: "list:reorder", payload: items },
    () => remoteReorderKnowledgeFolders(items),
  );
}

export async function duplicateKnowledgeFolder(sourceId: string, newName: string): Promise<KnowledgeFolder> {
  const { data, error } = await supabase.rpc("duplicate_knowledge_base_folder_v3", {
    p_source_id: sourceId,
    p_new_name: newName,
  });
  throwOnPostgrestError(error, "复制清单");
  const cloned = (data as Array<{
    id: string;
    knowledge_base_id: string | null;
    name: string;
    sort_order: number;
    lock_version: number;
  }>)[0];
  if (!cloned) throw new Error("复制清单未返回结果");
  return {
    id: cloned.id,
    knowledgeBaseId: cloned.knowledge_base_id ?? null,
    name: cloned.name,
    sortOrder: Number(cloned.sort_order),
    lockVersion: Number(cloned.lock_version),
  };
}

export function upsertGroup(group: NoteGroup): Promise<SavedKnowledgeEntity | undefined> {
  return runOrQueue(
    { kind: "list-group:save", key: "list-group:" + group.id, payload: group },
    () => remoteUpsertGroup(group),
  );
}

export function deleteGroup(entity: VersionedEntity): Promise<void | undefined> {
  return runOrQueue(
    { kind: "list-group:delete", key: "list-group:" + entity.id, payload: entity },
    () => remoteDeleteGroup(entity),
  );
}

export function upsertNote(note: Note): Promise<SavedNote | undefined> {
  return runOrQueue(
    { kind: "note:save", key: "note:" + note.id, payload: note },
    () => remoteSaveNote(note),
  );
}

export function patchNote(patch: ListNotePatch): Promise<SavedNoteVersion | undefined> {
  return runOrQueue(
    { kind: "note:patch", key: "note:" + patch.id, payload: patch },
    () => remotePatchNote(patch),
  );
}

export async function deleteNote(entity: VersionedEntity): Promise<void> {
  await runOrQueue(
    { kind: "note:delete", key: "note:" + entity.id, payload: entity },
    () => remoteDeleteNote(entity),
  );
}

export function reorderNotes(items: VersionedOrderItem[]): Promise<Array<{ id: string; updatedAt: number; lockVersion: number; sortOrder: number }> | undefined> {
  return runOrQueue(
    { kind: "note:reorder", key: "note:reorder", payload: items },
    () => remoteReorderNotes(items),
  );
}

export function moveNote(note: NoteStructuralMove): Promise<SavedKnowledgeOrderEntity[] | undefined> {
  return runOrQueue(
    { kind: "note:move", key: "note:move:" + note.id, payload: note },
    () => remoteMoveNote(note),
  );
}

export function upsertTemplate(template: KnowledgeTemplate): Promise<SavedNoteVersion | undefined> {
  return runOrQueue(
    { kind: "template:save", key: "template:" + template.id, payload: template },
    () => remoteUpsertTemplate(template),
  );
}

export function deleteTemplate(entity: VersionedEntity): Promise<void | undefined> {
  return runOrQueue(
    { kind: "template:delete", key: "template:" + entity.id, payload: entity },
    () => remoteDeleteTemplate(entity),
  );
}

// ---------------------------------------------------------------------------
// Export / Import helpers (file I/O only)
// ---------------------------------------------------------------------------

export type ImportedMarkdownFile = { title: string; content: string };

export async function pickMarkdownFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".md,.txt";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => resolve(evt.target?.result as string);
        reader.readAsText(file);
      } else { resolve(null); }
    };
    input.click();
  });
}

export async function saveMarkdownFile(defaultName: string, content: string): Promise<void> {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.setAttribute("download", defaultName);
  document.body.appendChild(link); link.click();
  document.body.removeChild(link); URL.revokeObjectURL(url);
}

export async function pickMultipleMarkdownFiles(): Promise<ImportedMarkdownFile[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".md,.txt"; input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files ?? []);
      const results: ImportedMarkdownFile[] = [];
      for (const file of files) {
        const text = await file.text();
        results.push({ title: file.name.replace(/\.[^/.]+$/, ''), content: text });
      }
      resolve(results);
    };
    input.click();
  });
}

export async function saveMultipleMarkdownFiles(files: Array<{ title: string; content: string }>): Promise<void> {
  for (const file of files) {
    await saveMarkdownFile(file.title ? (file.title + ".md") : "\u672a\u547d\u540d\u7b14\u8bb0.md", file.content);
  }
}

export async function exportNotesToMarkdown(
  notes: Note[],
  selectedNoteIds: string[],
  convertJsonToMd: (content: string) => string,
): Promise<number> {
  const notesToExport = await Promise.all(
    notes
      .filter((n) => selectedNoteIds.includes(n.id))
      .map(async (note) => (note.contentLoaded ? note : loadNote(note.id))),
  );
  const completeNotes = notesToExport.filter((note): note is Note => Boolean(note));
  if (completeNotes.length === 0) return 0;
  const files = completeNotes.map((n) => ({ title: n.title, content: convertJsonToMd(n.content ?? "") }));
  await saveMultipleMarkdownFiles(files);
  return files.length;
}
