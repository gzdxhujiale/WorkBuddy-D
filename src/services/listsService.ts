/**
 * listsService - unified data-access layer for the Lists module.
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
import { ListNoteRow } from "@/types/database";
import type { List, Folder, Note, NoteGroup, Template } from "@/types/lists";

// ---------------------------------------------------------------------------
// Public data-shape types
// ---------------------------------------------------------------------------

export type ListLoadAllPayload = {
  folders: Folder[];
  lists: List[];
  noteGroups: NoteGroup[];
  notes: Note[];
};

export type ListNotePatch = {
  id: string;
  listId?: string;
  groupId?: string | null;
  title?: string;
  content?: string;
  sortOrder?: number;
  baseUpdatedAt?: number;
};

export type SavedNote = { updatedAt: number; sortOrder: number };

// ---------------------------------------------------------------------------
// Remote helpers (private)
// ---------------------------------------------------------------------------

async function remoteUpsertFolder(folder: Folder): Promise<void> {
  const { error } = await supabase.rpc("save_knowledge_base", {
    p_id: folder.id, p_name: folder.name,
    p_sort_order: folder.sortOrder ?? 0,
  });
  throwOnPostgrestError(error, "\u4fdd\u5b58\u77e5\u8bc6\u5e93");
}

async function remoteDeleteFolder(id: string): Promise<void> {
  const { error } = await supabase.rpc("soft_delete_knowledge_base", { p_id: id });
  throwOnPostgrestError(error, "\u5220\u9664\u77e5\u8bc6\u5e93");
}

async function remoteReorderFolders(items: Array<[string, number]>): Promise<void> {
  const { error } = await supabase.rpc("reorder_knowledge_bases", {
    p_items: items.map(([id, sort_order]) => ({ id, sort_order })),
  });
  throwOnPostgrestError(error, "\u6392\u5e8f\u77e5\u8bc6\u5e93");
}

async function remoteUpsertList(list: List): Promise<number> {
  const { data, error } = await supabase.rpc("save_knowledge_base_folder", {
    p_id: list.id, p_knowledge_base_id: list.folderId ?? null,
    p_name: list.name,
    p_sort_order: list.sortOrder ?? 0,
  });
  throwOnPostgrestError(error, "\u4fdd\u5b58\u6e05\u5355");
  return Number(data);
}

async function remoteDeleteList(id: string): Promise<void> {
  const { error } = await supabase.rpc("soft_delete_knowledge_base_folder", { p_id: id });
  throwOnPostgrestError(error, "\u5220\u9664\u6e05\u5355");
}

async function remoteMoveList(listId: string, folderId: string | null, sortOrder: number): Promise<void> {
  const { error } = await supabase.from("knowledge_base_folders")
    .update({ knowledge_base_id: folderId, sort_order: sortOrder })
    .eq("id", listId);
  throwOnPostgrestError(error, "\u79fb\u52a8\u6e05\u5355");
}

async function remoteReorderLists(items: Array<[string, number]>): Promise<void> {
  const { error } = await supabase.rpc("reorder_knowledge_base_folders", {
    p_items: items.map(([id, sort_order]) => ({ id, sort_order })),
  });
  throwOnPostgrestError(error, "\u6392\u5e8f\u6e05\u5355");
}

async function remoteUpsertGroup(group: NoteGroup): Promise<number> {
  const { data, error } = await supabase.rpc("save_folder_note_group", {
    p_id: group.id, p_folder_id: group.listId, p_name: group.name,
    p_sort_order: group.sortOrder ?? 0,
  });
  throwOnPostgrestError(error, "\u4fdd\u5b58\u5206\u7ec4");
  return Number(data);
}

async function remoteDeleteGroup(id: string): Promise<void> {
  const { error } = await supabase.rpc("soft_delete_folder_note_group", { p_id: id });
  throwOnPostgrestError(error, "\u5220\u9664\u5206\u7ec4");
}

async function remoteReorderNotes(items: Array<[string, number]>): Promise<Array<[string, number]>> {
  const { data, error } = await supabase.rpc("reorder_notes", {
    p_items: items.map(([id, sort_order]) => ({ id, sort_order })),
  });
  throwOnPostgrestError(error, "\u6392\u5e8f\u7b14\u8bb0");
  return ((data ?? []) as Array<{ id: string; updated_at: string }>).map((item) => [
    item.id,
    new Date(item.updated_at).getTime(),
  ]);
}

async function remoteMoveNote(noteId: string, listId: string, groupId: string | null, sortOrder: number, baseUpdatedAt: number | undefined): Promise<number> {
  const { data, error } = await supabase.rpc("move_note", {
    p_id: noteId, p_folder_id: listId, p_group_id: groupId, p_sort_order: sortOrder,
    p_expected_updated_at: baseUpdatedAt ? new Date(baseUpdatedAt).toISOString() : null,
  });
  throwOnPostgrestError(error, "\u79fb\u52a8\u7b14\u8bb0");
  return new Date(data as string).getTime();
}

async function remoteSaveNote(note: Note): Promise<SavedNote> {
  const { data, error } = await supabase.rpc("save_note", {
    p_id: note.id, p_folder_id: note.listId, p_group_id: note.groupId ?? null,
    p_title: note.title, p_content: note.content,
    p_sort_order: note.sortOrder ?? 0,
    p_expected_updated_at: note.baseUpdatedAt ? new Date(note.baseUpdatedAt).toISOString() : null,
  });
  throwOnPostgrestError(error, "\u4fdd\u5b58\u7b14\u8bb0");
  const saved = (data as Array<{ updated_at: string; sort_order: number }>)[0];
  return { updatedAt: new Date(saved.updated_at).getTime(), sortOrder: saved.sort_order };
}

async function remotePatchNote(patch: ListNotePatch): Promise<number> {
  const { data, error } = await supabase.rpc("patch_note", {
    p_id: patch.id,
    p_expected_updated_at: patch.baseUpdatedAt ? new Date(patch.baseUpdatedAt).toISOString() : null,
    p_title: patch.title, p_content: patch.content,
    p_sort_order: patch.sortOrder, p_folder_id: patch.listId, p_group_id: patch.groupId,
    p_set_group: patch.groupId !== undefined,
  });
  throwOnPostgrestError(error, "\u66f4\u65b0\u7b14\u8bb0");
  return new Date(data as string).getTime();
}

async function remoteDeleteNote(id: string): Promise<void> {
  const { error } = await supabase.rpc("soft_delete_note", { p_id: id });
  throwOnPostgrestError(error, "\u5220\u9664\u7b14\u8bb0");
}

async function remoteUpsertTemplate(template: Template): Promise<void> {
  const { error } = await supabase.rpc("save_knowledge_base_template", {
    p_id: template.id, p_name: template.name,
    p_content: { raw: template.content },
  });
  throwOnPostgrestError(error, "\u4fdd\u5b58\u6a21\u677f");
}

async function remoteDeleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.rpc("soft_delete_knowledge_base_template", { p_id: id });
  throwOnPostgrestError(error, "\u5220\u9664\u6a21\u677f");
}

// ---------------------------------------------------------------------------
// Offline executor registrations
// ---------------------------------------------------------------------------

registerOfflineExecutor("list-folder:save", async (p) => remoteUpsertFolder(p as Folder));
registerOfflineExecutor("list-folder:delete", async (p) => remoteDeleteFolder(p as string));
registerOfflineExecutor("list-folder:reorder", async (p) => remoteReorderFolders(p as Array<[string, number]>));

registerOfflineExecutor("list:save", async (p) => { await remoteUpsertList(p as List); });
registerOfflineExecutor("list:delete", async (p) => remoteDeleteList(p as string));
registerOfflineExecutor("list:move", async (p) => {
  const { listId, folderId, sortOrder } = p as { listId: string; folderId: string | null; sortOrder: number };
  await remoteMoveList(listId, folderId, sortOrder);
});
registerOfflineExecutor("list:reorder", async (p) => remoteReorderLists(p as Array<[string, number]>));

registerOfflineExecutor("list-group:save", async (p) => { await remoteUpsertGroup(p as NoteGroup); });
registerOfflineExecutor("list-group:delete", async (p) => remoteDeleteGroup(p as string));

registerOfflineExecutor("note:save", async (p) => { await remoteSaveNote(p as Note); });
registerOfflineExecutor("note:patch", async (p) => { await remotePatchNote(p as ListNotePatch); });
registerOfflineExecutor("note:delete", async (p) => remoteDeleteNote(p as string));
registerOfflineExecutor("note:reorder", async (p) => { await remoteReorderNotes(p as Array<[string, number]>); });
registerOfflineExecutor("note:move", async (p) => {
  const { noteId, listId, groupId, sortOrder, baseUpdatedAt } = p as {
    noteId: string; listId: string; groupId: string | null; sortOrder: number; baseUpdatedAt?: number;
  };
  await remoteMoveNote(noteId, listId, groupId, sortOrder, baseUpdatedAt);
});

registerOfflineExecutor("template:save", async (p) => remoteUpsertTemplate(p as Template));
registerOfflineExecutor("template:delete", async (p) => remoteDeleteTemplate(p as string));

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

/** Module shell: folders + lists only (no note content). */
export async function loadAll(): Promise<ListLoadAllPayload> {
  const [foldersRes, listsRes] = await Promise.all([
    supabase.from("knowledge_bases")
      .select("id,name,sort_order")
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase.from("knowledge_base_folders")
      .select("id,knowledge_base_id,name,sort_order")
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (foldersRes.error || listsRes.error) {
    throwOnPostgrestError(foldersRes.error ?? listsRes.error, "\u52a0\u8f7d\u6e05\u5355\u5bb9\u5668");
  }

  const folders: Folder[] = (foldersRes.data ?? []).map((f) => ({
    id: f.id, name: f.name, sortOrder: f.sort_order,
  }));

  const lists: List[] = (listsRes.data ?? []).map((l) => ({
    id: l.id, name: l.name,
    folderId: l.knowledge_base_id ?? null,
    sortOrder: l.sort_order,
  }));

  return { folders, lists, noteGroups: [], notes: [] };
}

/** Per-list content: groups + note metadata (no body). */
export async function loadListContents(listId: string): Promise<Pick<ListLoadAllPayload, "noteGroups" | "notes">> {
  const [groupsRes, notesRes] = await Promise.all([
    supabase.from("folder_note_groups")
      .select("id,folder_id,name,sort_order")
      .eq("folder_id", listId).is("deleted_at", null)
      .order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
    supabase.from("notes")
      .select("id,folder_id,group_id,title,sort_order,created_at,updated_at")
      .eq("folder_id", listId).is("deleted_at", null)
      .order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
  ]);

  if (groupsRes.error || notesRes.error) {
    throwOnPostgrestError(groupsRes.error ?? notesRes.error, "\u52a0\u8f7d\u6e05\u5355\u5185\u5bb9");
  }

  const noteGroups: NoteGroup[] = (groupsRes.data ?? []).map((g) => ({
    id: g.id, listId: g.folder_id, name: g.name, sortOrder: g.sort_order,
  }));

  const notes: Note[] = (notesRes.data ?? []).map((n) => ({
    id: n.id, listId: n.folder_id, groupId: n.group_id ?? null,
    title: n.title ?? "", content: "", contentLoaded: false,
    sortOrder: n.sort_order,
    createdAt: n.created_at ? new Date(n.created_at).getTime() : Date.now(),
    updatedAt: n.updated_at ? new Date(n.updated_at).getTime() : Date.now(),
    baseUpdatedAt: n.updated_at ? new Date(n.updated_at).getTime() : undefined,
  }));

  return { noteGroups, notes };
}

/** Full note body - fetched on demand before editing or exporting. */
export async function loadNote(id: string): Promise<Note | null> {
  const { data, error } = await supabase.from("notes")
    .select("id,folder_id,group_id,title,content,sort_order,created_at,updated_at")
    .eq("id", id).is("deleted_at", null).maybeSingle();
  throwOnPostgrestError(error, "\u52a0\u8f7d\u7b14\u8bb0\u6b63\u6587");
  if (!data) return null;
  const n = data as ListNoteRow;
  return {
    id: n.id, listId: n.folder_id, groupId: n.group_id ?? null,
    title: n.title ?? "", content: n.content ?? "", contentLoaded: true,
    sortOrder: n.sort_order,
    createdAt: n.created_at ? new Date(n.created_at).getTime() : Date.now(),
    updatedAt: n.updated_at ? new Date(n.updated_at).getTime() : Date.now(),
    baseUpdatedAt: n.updated_at ? new Date(n.updated_at).getTime() : undefined,
  };
}

export async function loadTemplates(): Promise<Template[]> {
  const { data, error } = await supabase.from("knowledge_base_templates")
    .select("id,name,content")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  throwOnPostgrestError(error, "\u52a0\u8f7d\u6a21\u677f");
  return (data ?? []).map((t) => ({
    id: t.id, name: t.name,
    content: typeof t.content === "string" ? t.content : JSON.stringify(t.content),
  }));
}

// ---------------------------------------------------------------------------
// Write operations (all queue-safe via runOrQueue)
// ---------------------------------------------------------------------------

export function upsertFolder(folder: Folder): Promise<void | undefined> {
  return runOrQueue(
    { kind: "list-folder:save", key: "list-folder:" + folder.id, payload: folder },
    () => remoteUpsertFolder(folder),
  );
}

export function deleteFolder(id: string): Promise<void | undefined> {
  return runOrQueue(
    { kind: "list-folder:delete", key: "list-folder:" + id, payload: id },
    () => remoteDeleteFolder(id),
  );
}

export function reorderFolders(items: Array<[string, number]>): Promise<void | undefined> {
  return runOrQueue(
    { kind: "list-folder:reorder", key: "list-folder:reorder", payload: items },
    () => remoteReorderFolders(items),
  );
}

export function upsertList(list: List): Promise<number | undefined> {
  return runOrQueue(
    { kind: "list:save", key: "list:" + list.id, payload: list },
    () => remoteUpsertList(list),
  );
}

export function deleteList(id: string): Promise<void | undefined> {
  return runOrQueue(
    { kind: "list:delete", key: "list:" + id, payload: id },
    () => remoteDeleteList(id),
  );
}

export function moveList(listId: string, folderId: string | null, sortOrder: number): Promise<void | undefined> {
  return runOrQueue(
    { kind: "list:move", key: "list:move:" + listId, payload: { listId, folderId, sortOrder } },
    () => remoteMoveList(listId, folderId, sortOrder),
  );
}

export function reorderLists(items: Array<[string, number]>): Promise<void | undefined> {
  return runOrQueue(
    { kind: "list:reorder", key: "list:reorder", payload: items },
    () => remoteReorderLists(items),
  );
}

export async function duplicateList(_sourceId: string, newList: List): Promise<void> {
  await remoteUpsertList(newList);
}

export function upsertGroup(group: NoteGroup): Promise<number | undefined> {
  return runOrQueue(
    { kind: "list-group:save", key: "list-group:" + group.id, payload: group },
    () => remoteUpsertGroup(group),
  );
}

export function deleteGroup(id: string): Promise<void | undefined> {
  return runOrQueue(
    { kind: "list-group:delete", key: "list-group:" + id, payload: id },
    () => remoteDeleteGroup(id),
  );
}

export function upsertNote(note: Note): Promise<SavedNote | undefined> {
  return runOrQueue(
    { kind: "note:save", key: "note:" + note.id, payload: note },
    () => remoteSaveNote(note),
  );
}

export function patchNote(patch: ListNotePatch): Promise<number | undefined> {
  return runOrQueue(
    { kind: "note:patch", key: "note:" + patch.id, payload: patch },
    () => remotePatchNote(patch),
  );
}

export async function deleteNote(id: string): Promise<void> {
  await runOrQueue(
    { kind: "note:delete", key: "note:" + id, payload: id },
    () => remoteDeleteNote(id),
  );
}

export function reorderNotes(items: Array<[string, number]>): Promise<Array<[string, number]> | undefined> {
  return runOrQueue(
    { kind: "note:reorder", key: "note:reorder", payload: items },
    () => remoteReorderNotes(items),
  );
}

export function moveNote(noteId: string, listId: string, groupId: string | null, sortOrder: number, baseUpdatedAt: number | undefined): Promise<number | undefined> {
  return runOrQueue(
    { kind: "note:move", key: "note:move:" + noteId, payload: { noteId, listId, groupId, sortOrder, baseUpdatedAt } },
    () => remoteMoveNote(noteId, listId, groupId, sortOrder, baseUpdatedAt),
  );
}

export function upsertTemplate(template: Template): Promise<void | undefined> {
  return runOrQueue(
    { kind: "template:save", key: "template:" + template.id, payload: template },
    () => remoteUpsertTemplate(template),
  );
}

export function deleteTemplate(id: string): Promise<void | undefined> {
  return runOrQueue(
    { kind: "template:delete", key: "template:" + id, payload: id },
    () => remoteDeleteTemplate(id),
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
