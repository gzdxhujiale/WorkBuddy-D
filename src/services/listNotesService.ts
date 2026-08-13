import { supabase } from "@/lib/supabase";
import {
  ListFolder,
  ListList,
  ListNoteGroup,
  ListNote,
  ListTemplate,
  ListNotesData,
} from "@/types/listNotes";
import { ListNoteRow } from "@/types/database";
import { throwOnPostgrestError } from "@/lib/sync";
import { registerOfflineExecutor, runOrQueue } from "@/lib/offlineSyncQueue";

export type ListNotePatch = {
  id: string;
  listId?: string;
  groupId?: string | null;
  title?: string;
  content?: string;
  isPinned?: boolean;
  sortOrder?: number;
  updatedAt?: number;
  baseUpdatedAt?: number;
};

async function saveRemoteNote(note: ListNote): Promise<number> {
  const { data, error } = await supabase.rpc("save_note", {
    p_id: note.id, p_folder_id: note.listId, p_group_id: note.groupId || null,
    p_title: note.title, p_content: note.content, p_is_pinned: note.isPinned,
    p_sort_order: note.sortOrder,
    p_created_at: note.createdAt ? new Date(note.createdAt).toISOString() : new Date().toISOString(),
    p_expected_updated_at: note.baseUpdatedAt ? new Date(note.baseUpdatedAt).toISOString() : null,
    p_next_updated_at: new Date(note.updatedAt ?? Date.now()).toISOString(),
  });
  throwOnPostgrestError(error, "保存笔记");
  return new Date(data as string).getTime();
}

async function patchRemoteNote(patch: ListNotePatch): Promise<number> {
  const updatePayload: Record<string, any> = {
    updated_at: new Date(patch.updatedAt ?? Date.now()).toISOString(),
  };

  if (patch.listId !== undefined) updatePayload.folder_id = patch.listId;
  if (patch.groupId !== undefined) updatePayload.group_id = patch.groupId;
  if (patch.title !== undefined) updatePayload.title = patch.title;
  if (patch.content !== undefined) updatePayload.content = patch.content;
  if (patch.isPinned !== undefined) updatePayload.is_pinned = patch.isPinned;
  if (patch.sortOrder !== undefined) updatePayload.sort_order = patch.sortOrder;

  let query = supabase.from("notes").update(updatePayload).eq("id", patch.id);
  if (patch.baseUpdatedAt) {
    query = query.eq("updated_at", new Date(patch.baseUpdatedAt).toISOString());
  }
  const { data, error } = await query.select("updated_at").maybeSingle();
  throwOnPostgrestError(error, "更新笔记");
  return data?.updated_at ? new Date(data.updated_at).getTime() : Date.now();
}

registerOfflineExecutor("note:save", async (payload) => { await saveRemoteNote(payload as ListNote); });
registerOfflineExecutor("note:patch", async (payload) => { await patchRemoteNote(payload as ListNotePatch); });
registerOfflineExecutor("note:delete", async (payload) => {
  const { error } = await supabase.from("notes").update({ deleted_at: new Date().toISOString() }).eq("id", payload as string);
  throwOnPostgrestError(error, "删除笔记");
});

export const listNotesApi = {
  // Module shell: containers only. Contents are loaded after a list is selected.
  loadAll: async (): Promise<ListNotesData> => {
    try {
      const [foldersRes, listsRes] = await Promise.all([
        supabase
          .from("knowledge_bases")
          .select("id,user_id,name,is_pinned,sort_order,created_at,updated_at")
          .is("deleted_at", null)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("knowledge_base_folders")
          .select("id,user_id,knowledge_base_id,name,icon,color,view_type,is_pinned,sort_order,created_at,updated_at")
          .is("deleted_at", null)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
      ]);

      if (foldersRes.error || listsRes.error) {
        throwOnPostgrestError(foldersRes.error || listsRes.error, "加载清单容器");
      }

      const folders: ListFolder[] = (foldersRes.data || []).map((f) => ({
        id: f.id,
        userId: f.user_id,
        name: f.name,
        isPinned: Boolean(f.is_pinned),
        sortOrder: f.sort_order,
        createdAt: f.created_at ? new Date(f.created_at).getTime() : undefined,
        updatedAt: f.updated_at ? new Date(f.updated_at).getTime() : undefined,
      }));

      const lists: ListList[] = (listsRes.data || []).map((l) => ({
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

      return { folders, lists, groups: [], notes: [], templates: [] };
    } catch (err) { throw err; }
  },

  loadListContents: async (listId: string): Promise<Pick<ListNotesData, "groups" | "notes">> => {
    const [groupsRes, notesRes] = await Promise.all([
      supabase.from("folder_note_groups")
        .select("id,user_id,folder_id,name,sort_order,created_at,updated_at")
        .eq("folder_id", listId).is("deleted_at", null)
        .order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
      supabase.from("notes")
        .select("id,user_id,folder_id,group_id,title,is_pinned,sort_order,created_at,updated_at")
        .eq("folder_id", listId).is("deleted_at", null)
        .order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
    ]);
    if (groupsRes.error || notesRes.error) {
      throwOnPostgrestError(groupsRes.error || notesRes.error, "加载清单内容");
    }
    const groups: ListNoteGroup[] = (groupsRes.data || []).map((g) => ({
        id: g.id,
        userId: g.user_id,
        listId: g.folder_id,
        name: g.name,
        sortOrder: g.sort_order,
        createdAt: g.created_at ? new Date(g.created_at).getTime() : undefined,
        updatedAt: g.updated_at ? new Date(g.updated_at).getTime() : undefined,
      }));

    const notes: ListNote[] = (notesRes.data || []).map((n) => ({
        id: n.id,
        userId: n.user_id,
        listId: n.folder_id,
        groupId: n.group_id || undefined,
        title: n.title,
        content: "",
        contentLoaded: false,
        isPinned: Boolean(n.is_pinned),
        sortOrder: n.sort_order,
        createdAt: n.created_at ? new Date(n.created_at).getTime() : undefined,
        updatedAt: n.updated_at ? new Date(n.updated_at).getTime() : undefined,
        baseUpdatedAt: n.updated_at ? new Date(n.updated_at).getTime() : undefined,
      }));

    return { groups, notes };
  },

  loadTemplates: async (): Promise<ListTemplate[]> => {
    const { data, error } = await supabase
      .from("knowledge_base_templates")
      .select("id,user_id,name,content,created_at,updated_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    throwOnPostgrestError(error, "加载模板");
    return (data || []).map((t) => ({
        id: t.id,
        userId: t.user_id,
        name: t.name,
        content: t.content || {},
        createdAt: t.created_at ? new Date(t.created_at).getTime() : undefined,
        updatedAt: t.updated_at ? new Date(t.updated_at).getTime() : undefined,
      }));
  },

  loadNote: async (id: string): Promise<ListNote | null> => {
    const { data, error } = await supabase
      .from("notes")
      .select("id,user_id,folder_id,group_id,title,content,is_pinned,sort_order,created_at,updated_at")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    throwOnPostgrestError(error, "加载笔记正文");
    if (!data) return null;
    const n = data as ListNoteRow;
    return {
      id: n.id, userId: n.user_id, listId: n.folder_id, groupId: n.group_id || undefined,
      title: n.title, content: n.content, contentLoaded: true, isPinned: Boolean(n.is_pinned),
      sortOrder: n.sort_order,
      createdAt: n.created_at ? new Date(n.created_at).getTime() : undefined,
      updatedAt: n.updated_at ? new Date(n.updated_at).getTime() : undefined,
      baseUpdatedAt: n.updated_at ? new Date(n.updated_at).getTime() : undefined,
    };
  },

  // 2. 文件夹 CRUD
  upsertFolder: async (folder: ListFolder): Promise<void> => {
    const { error } = await supabase.rpc("save_knowledge_base", {
      p_id: folder.id, p_name: folder.name, p_is_pinned: folder.isPinned,
      p_sort_order: folder.sortOrder, p_updated_at: new Date().toISOString(),
    });
    throwOnPostgrestError(error, "保存知识库");
  },

  deleteFolder: async (id: string): Promise<void> => {
    const { error } = await supabase.rpc("soft_delete_knowledge_base", { p_id: id });
    throwOnPostgrestError(error, "删除知识库");
  },

  // 3. 清单 CRUD
  upsertList: async (list: ListList): Promise<void> => {
    const { error } = await supabase.rpc("save_knowledge_base_folder", {
      p_id: list.id, p_knowledge_base_id: list.folderId || null, p_name: list.name,
      p_icon: list.icon, p_color: list.color, p_view_type: list.viewType,
      p_is_pinned: list.isPinned, p_sort_order: list.sortOrder,
      p_updated_at: new Date().toISOString(),
    });
    throwOnPostgrestError(error, "保存清单");
  },

  deleteList: async (id: string): Promise<void> => {
      const { error } = await supabase.rpc("soft_delete_knowledge_base_folder", { p_id: id });
    throwOnPostgrestError(error, "删除清单");
  },

  // 4. 分组 CRUD
  upsertGroup: async (group: ListNoteGroup): Promise<void> => {
    const { error } = await supabase.rpc("save_folder_note_group", {
      p_id: group.id, p_folder_id: group.listId, p_name: group.name,
      p_sort_order: group.sortOrder, p_updated_at: new Date().toISOString(),
    });
    throwOnPostgrestError(error, "保存分组");
  },

  deleteGroup: async (id: string): Promise<void> => {
    const { error } = await supabase
        .from("folder_note_groups")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
    throwOnPostgrestError(error, "删除分组");
  },

  // 5. 笔记/条目 CRUD
  upsertNote: async (note: ListNote): Promise<number | undefined> => {
    return runOrQueue({ kind: "note:save", key: `note:${note.id}`, payload: note }, () => saveRemoteNote(note));
  },

  patchNote: async (patch: ListNotePatch): Promise<number | undefined> => {
    return runOrQueue({ kind: "note:patch", key: `note:${patch.id}`, payload: patch }, () => patchRemoteNote(patch));
  },

  deleteNote: async (id: string): Promise<void> => {
    await runOrQueue({ kind: "note:delete", key: `note:${id}`, payload: id }, async () => {
      const { error } = await supabase.from("notes").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      throwOnPostgrestError(error, "删除笔记");
    });
  },

  // 6. 模板 CRUD
  upsertTemplate: async (template: ListTemplate): Promise<void> => {
    const { error } = await supabase.rpc("save_knowledge_base_template", {
      p_id: template.id, p_name: template.name, p_content: template.content,
      p_updated_at: new Date().toISOString(),
    });
    throwOnPostgrestError(error, "保存模板");
  },

  deleteTemplate: async (id: string): Promise<void> => {
    const { error } = await supabase
        .from("knowledge_base_templates")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
    throwOnPostgrestError(error, "删除模板");
  },

  // 7. 排序与移动 Helper 方法
  reorderFolders: async (items: Array<[string, number]>): Promise<void> => {
    const { error } = await supabase.rpc("reorder_knowledge_bases", { p_items: items.map(([id, sort_order]) => ({ id, sort_order })) });
    throwOnPostgrestError(error, "排序知识库");
  },

  reorderLists: async (items: Array<[string, number]>): Promise<void> => {
    const { error } = await supabase.rpc("reorder_knowledge_base_folders", { p_items: items.map(([id, sort_order]) => ({ id, sort_order })) });
    throwOnPostgrestError(error, "排序清单");
  },

  moveList: async (listId: string, folderId: string | null, sortOrder: number): Promise<void> => {
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
    const { error } = await supabase.rpc("reorder_notes", { p_items: items.map(([id, sort_order]) => ({ id, sort_order })) });
    throwOnPostgrestError(error, "排序笔记");
  },

  moveNote: async (
    noteId: string,
    listId: string,
    groupId: string | null,
    sortOrder: number
  ): Promise<void> => {
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
