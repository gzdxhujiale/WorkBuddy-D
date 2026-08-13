import { listNotesApi } from "@/services/listNotesService";
import type { List, Folder, Note, NoteGroup } from "@/types/lists";

/**
 * listsService — the data-access seam for the Lists feature.
 * Connects directly to the Supabase-backed listNotesService.
 */

export type ListLoadAllPayload = {
  folders: Array<{ id: string; name: string; isPinned: boolean; sortOrder: number }>;
  lists: Array<{
    id: string;
    name: string;
    icon: string;
    color: string;
    viewType: string;
    folderId: string | null;
    isPinned: boolean;
    sortOrder: number;
    itemCount: number;
  }>;
  noteGroups: Array<{ id: string; listId: string; name: string; sortOrder: number }>;
  notes: Array<{
    id: string;
    listId: string;
    groupId: string | null;
    title: string;
    content: string;
    contentLoaded: boolean;
    isPinned: boolean;
    sortOrder: number;
    createdAt: number;
    updatedAt: number;
  }>;
  templates: Array<{ id: string; name: string; content: string }>;
};

export async function loadAll(): Promise<ListLoadAllPayload> {
  const data = await listNotesApi.loadAll();

  return {
    folders: data.folders.map((f) => ({
      id: f.id,
      name: f.name,
      isPinned: f.isPinned,
      sortOrder: f.sortOrder,
    })),
    lists: data.lists.map((l) => ({
      id: l.id,
      name: l.name,
      icon: l.icon || "BookOpen",
      color: l.color || "#6366f1",
      viewType: l.viewType || "list",
      folderId: l.folderId || null,
      isPinned: l.isPinned,
      sortOrder: l.sortOrder,
      itemCount: 0,
    })),
    noteGroups: data.groups.map((g) => ({
      id: g.id,
      listId: g.listId,
      name: g.name,
      sortOrder: g.sortOrder,
    })),
    notes: data.notes.map((n) => ({
      id: n.id,
      listId: n.listId,
      groupId: n.groupId || null,
      title: n.title || "",
      content: n.content || "",
      contentLoaded: Boolean(n.contentLoaded),
      isPinned: n.isPinned,
      sortOrder: n.sortOrder,
      createdAt: n.createdAt || Date.now(),
      updatedAt: n.updatedAt || Date.now(),
    })),
    templates: data.templates.map((t) => ({
      id: t.id,
      name: t.name,
      content: typeof t.content === "string" ? t.content : JSON.stringify(t.content),
    })),
  };
}

// ── Lists ────────────────────────────────────────────────────────────────────

export function upsertList(list: List): Promise<void> {
  return listNotesApi.upsertList({
    id: list.id,
    folderId: list.folderId || undefined,
    name: list.name,
    icon: list.icon || "BookOpen",
    color: list.color || "#6366f1",
    viewType: (list.viewType as any) || "list",
    isPinned: list.isPinned || false,
    sortOrder: list.sortOrder || 0,
  });
}

export function deleteList(id: string): Promise<void> {
  return listNotesApi.deleteList(id);
}

export async function duplicateList(_sourceId: string, newList: List): Promise<void> {
  await listNotesApi.upsertList({
    id: newList.id,
    folderId: newList.folderId || undefined,
    name: newList.name,
    icon: newList.icon || "BookOpen",
    color: newList.color || "#6366f1",
    viewType: (newList.viewType as any) || "list",
    isPinned: newList.isPinned || false,
    sortOrder: newList.sortOrder || 0,
  });
}

export function reorderLists(items: Array<[string, number]>): Promise<void> {
  return listNotesApi.reorderLists(items);
}

export function moveList(listId: string, folderId: string | null, sortOrder: number): Promise<void> {
  return listNotesApi.moveList(listId, folderId, sortOrder);
}

// ── Folders ──────────────────────────────────────────────────────────────────

export function upsertFolder(folder: Folder): Promise<void> {
  return listNotesApi.upsertFolder({
    id: folder.id,
    name: folder.name,
    isPinned: folder.isPinned || false,
    sortOrder: folder.sortOrder || 0,
  });
}

export function deleteFolder(id: string): Promise<void> {
  return listNotesApi.deleteFolder(id);
}

export function reorderFolders(items: Array<[string, number]>): Promise<void> {
  return listNotesApi.reorderFolders(items);
}

// ── Notes ────────────────────────────────────────────────────────────────────

export function upsertNote(note: Note): Promise<number | undefined> {
  return listNotesApi.upsertNote({
    id: note.id,
    listId: note.listId,
    groupId: note.groupId || undefined,
    title: note.title,
    content: note.content,
    isPinned: note.isPinned || false,
    sortOrder: note.sortOrder || 0,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    baseUpdatedAt: note.baseUpdatedAt,
  });
}

export function patchNote(patch: import("./listNotesService").ListNotePatch): Promise<number | undefined> {
  return listNotesApi.patchNote(patch);
}

export function deleteNote(id: string): Promise<void> {
  return listNotesApi.deleteNote(id);
}

export function moveNote(
  noteId: string,
  listId: string,
  groupId: string | null,
  sortOrder: number
): Promise<void> {
  return listNotesApi.moveNote(noteId, listId, groupId, sortOrder);
}

export function reorderNotes(items: Array<[string, number]>): Promise<void> {
  return listNotesApi.reorderNotes(items);
}

// ── Note Groups ──────────────────────────────────────────────────────────────

export function upsertGroup(group: NoteGroup): Promise<void> {
  return listNotesApi.upsertGroup({
    id: group.id,
    listId: group.listId,
    name: group.name,
    sortOrder: group.sortOrder || 0,
  });
}

export function deleteGroup(id: string): Promise<void> {
  return listNotesApi.deleteGroup(id);
}

// ── Templates ────────────────────────────────────────────────────────────────

export function upsertTemplate(id: string, name: string, content: string): Promise<void> {
  return listNotesApi.upsertTemplate({
    id,
    name,
    content: { raw: content },
  });
}

export function deleteTemplate(id: string): Promise<void> {
  return listNotesApi.deleteTemplate(id);
}

// ── Export / Import Helpers ──────────────────────────────────────────────────

export type ImportedMarkdownFile = { title: string; content: string };

export async function pickMarkdownFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".md,.txt";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => resolve(evt.target?.result as string);
        reader.readAsText(file);
      } else {
        resolve(null);
      }
    };
    input.click();
  });
}

export async function saveMarkdownFile(defaultName: string, content: string): Promise<void> {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", defaultName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function pickMultipleMarkdownFiles(): Promise<ImportedMarkdownFile[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".md,.txt";
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      const results: ImportedMarkdownFile[] = [];
      for (const file of files) {
        const text = await file.text();
        results.push({ title: file.name.replace(/\.[^/.]+$/, ""), content: text });
      }
      resolve(results);
    };
    input.click();
  });
}

export async function saveMultipleMarkdownFiles(
  files: Array<{ title: string; content: string }>
): Promise<void> {
  for (const file of files) {
    await saveMarkdownFile(`${file.title || "未命名笔记"}.md`, file.content);
  }
}

export async function exportNotesToMarkdown(
  notes: Note[],
  selectedNoteIds: string[],
  convertJsonToMd: (content: string) => string
): Promise<number> {
  const notesToExport = await Promise.all(
    notes
      .filter((n) => selectedNoteIds.includes(n.id))
      .map(async (note) => (note.contentLoaded ? note : loadNote(note.id)))
  );
  const completeNotes = notesToExport.filter((note): note is Note => Boolean(note));
  if (completeNotes.length === 0) return 0;

  const files = completeNotes.map((n) => ({
    title: n.title,
    content: convertJsonToMd(n.content || ""),
  }));

  await saveMultipleMarkdownFiles(files);
  return files.length;
}

export async function loadListContents(listId: string): Promise<Pick<ListLoadAllPayload, 'noteGroups' | 'notes'>> {
  const data = await listNotesApi.loadListContents(listId);
  return {
    noteGroups: data.groups.map(g => ({ id: g.id, listId: g.listId, name: g.name, sortOrder: g.sortOrder })),
    notes: data.notes.map(n => ({
      id: n.id, listId: n.listId, groupId: n.groupId || null, title: n.title,
      content: '', contentLoaded: false, isPinned: n.isPinned, sortOrder: n.sortOrder,
      createdAt: n.createdAt || Date.now(), updatedAt: n.updatedAt || Date.now(),
    })),
  };
}

export async function loadNote(id: string): Promise<Note | null> {
  const note = await listNotesApi.loadNote(id);
  if (!note) return null;
  return {
    id: note.id, listId: note.listId, groupId: note.groupId || null,
    title: note.title, content: note.content, contentLoaded: true,
    isPinned: note.isPinned, sortOrder: note.sortOrder,
    createdAt: note.createdAt || Date.now(), updatedAt: note.updatedAt || Date.now(),
    baseUpdatedAt: note.baseUpdatedAt,
  };
}
