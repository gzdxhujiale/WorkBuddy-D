import { supabase } from "@/lib/supabase";
import {
  ListFolder,
  ListList,
  ListNoteGroup,
  ListNote,
  ListTemplate,
  ListNotesData,
} from "@/types/listNotes";
import {
  ListFolderRow,
  ListListRow,
  ListNoteGroupRow,
  ListNoteRow,
  ListTemplateRow,
} from "@/types/database";
import { throwOnPostgrestError } from "@/lib/sync";
import { userStorageKey } from "@/lib/userStorage";

const LOCAL_STORAGE_FOLDERS_KEY = "fishbuddy_list_folders_v1";
const LOCAL_STORAGE_LISTS_KEY = "fishbuddy_list_lists_v1";
const LOCAL_STORAGE_GROUPS_KEY = "fishbuddy_list_groups_v1";
const LOCAL_STORAGE_NOTES_KEY = "fishbuddy_list_notes_v1";
const LOCAL_STORAGE_TEMPLATES_KEY = "fishbuddy_list_templates_v1";

function getLocalData(): ListNotesData {
  try {
    const rawFolders = localStorage.getItem(userStorageKey(LOCAL_STORAGE_FOLDERS_KEY));
    const rawLists = localStorage.getItem(userStorageKey(LOCAL_STORAGE_LISTS_KEY));
    const rawGroups = localStorage.getItem(userStorageKey(LOCAL_STORAGE_GROUPS_KEY));
    const rawNotes = localStorage.getItem(userStorageKey(LOCAL_STORAGE_NOTES_KEY));
    const rawTemplates = localStorage.getItem(userStorageKey(LOCAL_STORAGE_TEMPLATES_KEY));

    return {
      folders: rawFolders ? JSON.parse(rawFolders) : [],
      lists: rawLists ? JSON.parse(rawLists) : [],
      groups: rawGroups ? JSON.parse(rawGroups) : [],
      notes: rawNotes ? JSON.parse(rawNotes) : [],
      templates: rawTemplates ? JSON.parse(rawTemplates) : [],
    };
  } catch {
    return {
      folders: [],
      lists: [],
      groups: [],
      notes: [],
      templates: [],
    };
  }
}

function saveLocalData(data: Partial<ListNotesData>): void {
  try {
    if (data.folders !== undefined) {
      localStorage.setItem(userStorageKey(LOCAL_STORAGE_FOLDERS_KEY), JSON.stringify(data.folders));
    }
    if (data.lists !== undefined) {
      localStorage.setItem(userStorageKey(LOCAL_STORAGE_LISTS_KEY), JSON.stringify(data.lists));
    }
    if (data.groups !== undefined) {
      localStorage.setItem(userStorageKey(LOCAL_STORAGE_GROUPS_KEY), JSON.stringify(data.groups));
    }
    if (data.notes !== undefined) {
      localStorage.setItem(userStorageKey(LOCAL_STORAGE_NOTES_KEY), JSON.stringify(data.notes));
    }
    if (data.templates !== undefined) {
      localStorage.setItem(userStorageKey(LOCAL_STORAGE_TEMPLATES_KEY), JSON.stringify(data.templates));
    }
  } catch (e) {
    console.error("Failed to save local list notes data:", e);
  }
}

export const listNotesApi = {
  // 1. 全量加载数据
  loadAll: async (): Promise<ListNotesData> => {
    try {
      const [foldersRes, listsRes, groupsRes, notesRes, templatesRes] = await Promise.all([
        supabase
          .from("knowledge_bases")
          .select("*")
          .is("deleted_at", null)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("knowledge_base_folders")
          .select("*")
          .is("deleted_at", null)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("folder_note_groups")
          .select("*")
          .is("deleted_at", null)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("notes")
          .select("*")
          .is("deleted_at", null)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("knowledge_base_templates")
          .select("*")
          .is("deleted_at", null)
          .order("created_at", { ascending: true }),
      ]);

      if (foldersRes.error || listsRes.error || groupsRes.error || notesRes.error || templatesRes.error) {
        console.warn("Supabase list_notes query warning, fallback to local storage");
        return getLocalData();
      }

      const folders: ListFolder[] = (foldersRes.data || []).map((f: ListFolderRow) => ({
        id: f.id,
        userId: f.user_id,
        name: f.name,
        isPinned: Boolean(f.is_pinned),
        sortOrder: f.sort_order,
        createdAt: f.created_at ? new Date(f.created_at).getTime() : undefined,
        updatedAt: f.updated_at ? new Date(f.updated_at).getTime() : undefined,
      }));

      const lists: ListList[] = (listsRes.data || []).map((l: ListListRow) => ({
        id: l.id,
        userId: l.user_id,
        folderId: l.knowledge_base_id || undefined,
        name: l.name,
        icon: l.icon,
        color: l.color,
        viewType: l.view_type,
        isPinned: Boolean(l.is_pinned),
        sortOrder: l.sort_order,
        createdAt: l.created_at ? new Date(l.created_at).getTime() : undefined,
        updatedAt: l.updated_at ? new Date(l.updated_at).getTime() : undefined,
      }));

      const groups: ListNoteGroup[] = (groupsRes.data || []).map((g: ListNoteGroupRow) => ({
        id: g.id,
        userId: g.user_id,
        listId: g.folder_id,
        name: g.name,
        sortOrder: g.sort_order,
        createdAt: g.created_at ? new Date(g.created_at).getTime() : undefined,
        updatedAt: g.updated_at ? new Date(g.updated_at).getTime() : undefined,
      }));

      const notes: ListNote[] = (notesRes.data || []).map((n: ListNoteRow) => ({
        id: n.id,
        userId: n.user_id,
        listId: n.folder_id,
        groupId: n.group_id || undefined,
        title: n.title,
        content: n.content,
        isPinned: Boolean(n.is_pinned),
        sortOrder: n.sort_order,
        createdAt: n.created_at ? new Date(n.created_at).getTime() : undefined,
        updatedAt: n.updated_at ? new Date(n.updated_at).getTime() : undefined,
        baseUpdatedAt: n.updated_at ? new Date(n.updated_at).getTime() : undefined,
      }));

      const templates: ListTemplate[] = (templatesRes.data || []).map((t: ListTemplateRow) => ({
        id: t.id,
        userId: t.user_id,
        name: t.name,
        content: t.content || {},
        createdAt: t.created_at ? new Date(t.created_at).getTime() : undefined,
        updatedAt: t.updated_at ? new Date(t.updated_at).getTime() : undefined,
      }));

      const data: ListNotesData = { folders, lists, groups, notes, templates };
      saveLocalData(data);
      return data;
    } catch (err) {
      console.warn("Using local storage fallback for list notes:", err);
      return getLocalData();
    }
  },

  // 2. 文件夹 CRUD
  upsertFolder: async (folder: ListFolder): Promise<void> => {
    const local = getLocalData();
    const idx = local.folders.findIndex((f) => f.id === folder.id);
    if (idx >= 0) {
      local.folders[idx] = folder;
    } else {
      local.folders.push(folder);
    }
    saveLocalData({ folders: local.folders });

    const payload = {
        id: folder.id,
        name: folder.name,
        is_pinned: folder.isPinned,
        sort_order: folder.sortOrder,
        updated_at: new Date().toISOString(),
      };
    const { error } = await supabase.from("knowledge_bases").upsert(payload);
    throwOnPostgrestError(error, "保存知识库");
  },

  deleteFolder: async (id: string): Promise<void> => {
    const local = getLocalData();
    local.folders = local.folders.filter((f) => f.id !== id);
    // Detach lists from the folder (set folderId to null)
    local.lists = local.lists.map((l) => (l.folderId === id ? { ...l, folderId: undefined } : l));
    saveLocalData({ folders: local.folders, lists: local.lists });

    const now = new Date().toISOString();
      // Detach lists from the folder
    const detachResult = await supabase
        .from("knowledge_base_folders")
        .update({ knowledge_base_id: null, updated_at: now })
        .eq("knowledge_base_id", id)
        .is("deleted_at", null);
      const { error } = await supabase
        .from("knowledge_bases")
        .update({ deleted_at: now })
        .eq("id", id);
    throwOnPostgrestError(detachResult.error || error, "删除知识库");
  },

  // 3. 清单 CRUD
  upsertList: async (list: ListList): Promise<void> => {
    const local = getLocalData();
    const idx = local.lists.findIndex((l) => l.id === list.id);
    if (idx >= 0) {
      local.lists[idx] = list;
    } else {
      local.lists.push(list);
    }
    saveLocalData({ lists: local.lists });

    const payload = {
        id: list.id,
        knowledge_base_id: list.folderId || null,
        name: list.name,
        icon: list.icon,
        color: list.color,
        view_type: list.viewType,
        is_pinned: list.isPinned,
        sort_order: list.sortOrder,
        updated_at: new Date().toISOString(),
      };
    const { error } = await supabase.from("knowledge_base_folders").upsert(payload);
    throwOnPostgrestError(error, "保存清单");
  },

  deleteList: async (id: string): Promise<void> => {
    const local = getLocalData();
    // Soft-delete the list and all its associated notes & groups locally
    local.lists = local.lists.filter((l) => l.id !== id);
    local.notes = local.notes.filter((n) => n.listId !== id);
    local.groups = local.groups.filter((g) => g.listId !== id);
    saveLocalData({ lists: local.lists, notes: local.notes, groups: local.groups });

    const now = new Date().toISOString();
      // Database trigger cascade_soft_delete_list() handles cascading soft-delete
      // of associated notes and groups automatically
      const { error } = await supabase
        .from("knowledge_base_folders")
        .update({ deleted_at: now })
        .eq("id", id);
    throwOnPostgrestError(error, "删除清单");
  },

  // 4. 分组 CRUD
  upsertGroup: async (group: ListNoteGroup): Promise<void> => {
    const local = getLocalData();
    const idx = local.groups.findIndex((g) => g.id === group.id);
    if (idx >= 0) {
      local.groups[idx] = group;
    } else {
      local.groups.push(group);
    }
    saveLocalData({ groups: local.groups });

    const payload = {
        id: group.id,
        folder_id: group.listId,
        name: group.name,
        sort_order: group.sortOrder,
        updated_at: new Date().toISOString(),
      };
    const { error } = await supabase.from("folder_note_groups").upsert(payload);
    throwOnPostgrestError(error, "保存分组");
  },

  deleteGroup: async (id: string): Promise<void> => {
    const local = getLocalData();
    local.groups = local.groups.filter((g) => g.id !== id);
    saveLocalData({ groups: local.groups });

    const { error } = await supabase
        .from("folder_note_groups")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
    throwOnPostgrestError(error, "删除分组");
  },

  // 5. 笔记/条目 CRUD
  upsertNote: async (note: ListNote): Promise<number> => {
    const local = getLocalData();
    const idx = local.notes.findIndex((n) => n.id === note.id);
    if (idx >= 0) {
      local.notes[idx] = note;
    } else {
      local.notes.push(note);
    }
    saveLocalData({ notes: local.notes });

    const { data, error } = await supabase.rpc("save_note", {
      p_id: note.id,
      p_folder_id: note.listId,
      p_group_id: note.groupId || null,
      p_title: note.title,
      p_content: note.content,
      p_is_pinned: note.isPinned,
      p_sort_order: note.sortOrder,
      p_created_at: note.createdAt ? new Date(note.createdAt).toISOString() : new Date().toISOString(),
      p_expected_updated_at: note.baseUpdatedAt ? new Date(note.baseUpdatedAt).toISOString() : null,
      p_next_updated_at: new Date(note.updatedAt ?? Date.now()).toISOString(),
    });
    throwOnPostgrestError(error, "保存笔记");
    return new Date(data as string).getTime();
  },

  deleteNote: async (id: string): Promise<void> => {
    const local = getLocalData();
    local.notes = local.notes.filter((n) => n.id !== id);
    saveLocalData({ notes: local.notes });

    const { error } = await supabase
        .from("notes")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
    throwOnPostgrestError(error, "删除笔记");
  },

  // 6. 模板 CRUD
  upsertTemplate: async (template: ListTemplate): Promise<void> => {
    const local = getLocalData();
    const idx = local.templates.findIndex((t) => t.id === template.id);
    if (idx >= 0) {
      local.templates[idx] = template;
    } else {
      local.templates.push(template);
    }
    saveLocalData({ templates: local.templates });

    const payload = {
        id: template.id,
        name: template.name,
        content: template.content,
        updated_at: new Date().toISOString(),
      };
    const { error } = await supabase.from("knowledge_base_templates").upsert(payload);
    throwOnPostgrestError(error, "保存模板");
  },

  deleteTemplate: async (id: string): Promise<void> => {
    const local = getLocalData();
    local.templates = local.templates.filter((t) => t.id !== id);
    saveLocalData({ templates: local.templates });

    const { error } = await supabase
        .from("knowledge_base_templates")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
    throwOnPostgrestError(error, "删除模板");
  },

  // 7. 排序与移动 Helper 方法
  reorderFolders: async (items: Array<[string, number]>): Promise<void> => {
    const local = getLocalData();
    const orderMap = new Map(items);
    local.folders = local.folders.map((f) =>
      orderMap.has(f.id) ? { ...f, sortOrder: orderMap.get(f.id)! } : f
    );
    saveLocalData({ folders: local.folders });

    const { error } = await supabase.rpc("reorder_knowledge_bases", { p_items: items.map(([id, sort_order]) => ({ id, sort_order })) });
    throwOnPostgrestError(error, "排序知识库");
  },

  reorderLists: async (items: Array<[string, number]>): Promise<void> => {
    const local = getLocalData();
    const orderMap = new Map(items);
    local.lists = local.lists.map((l) =>
      orderMap.has(l.id) ? { ...l, sortOrder: orderMap.get(l.id)! } : l
    );
    saveLocalData({ lists: local.lists });

    const { error } = await supabase.rpc("reorder_knowledge_base_folders", { p_items: items.map(([id, sort_order]) => ({ id, sort_order })) });
    throwOnPostgrestError(error, "排序清单");
  },

  moveList: async (listId: string, folderId: string | null, sortOrder: number): Promise<void> => {
    const local = getLocalData();
    const idx = local.lists.findIndex((l) => l.id === listId);
    if (idx >= 0) {
      local.lists[idx] = { ...local.lists[idx], folderId: folderId || undefined, sortOrder };
      saveLocalData({ lists: local.lists });
    }

    const { error } = await supabase
      .from("knowledge_base_folders")
      .update({
        knowledge_base_id: folderId,
        sort_order: sortOrder,
        updated_at: new Date().toISOString(),
      })
      .eq("id", listId);
    throwOnPostgrestError(error, "移动清单");
  },

  reorderNotes: async (items: Array<[string, number]>): Promise<void> => {
    const local = getLocalData();
    const orderMap = new Map(items);
    local.notes = local.notes.map((n) =>
      orderMap.has(n.id) ? { ...n, sortOrder: orderMap.get(n.id)! } : n
    );
    saveLocalData({ notes: local.notes });

    const { error } = await supabase.rpc("reorder_notes", { p_items: items.map(([id, sort_order]) => ({ id, sort_order })) });
    throwOnPostgrestError(error, "排序笔记");
  },

  moveNote: async (
    noteId: string,
    listId: string,
    groupId: string | null,
    sortOrder: number
  ): Promise<void> => {
    const local = getLocalData();
    const idx = local.notes.findIndex((n) => n.id === noteId);
    if (idx >= 0) {
      local.notes[idx] = {
        ...local.notes[idx],
        listId,
        groupId: groupId || undefined,
        sortOrder,
      };
      saveLocalData({ notes: local.notes });
    }

    const { error } = await supabase
      .from("notes")
      .update({
        folder_id: listId,
        group_id: groupId,
        sort_order: sortOrder,
        updated_at: new Date().toISOString(),
      })
      .eq("id", noteId);
    throwOnPostgrestError(error, "移动笔记");
  },
};
