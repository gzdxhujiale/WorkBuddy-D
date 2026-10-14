/**
 * knowledgeService - modular facade for the Lists & Notes module.
 *
 * Re-exports domain operations partitioned into:
 * - ./folders: Knowledge bases, folders, reordering and structural moves
 * - ./notes: Notes, groups, batch ops, patching, and content hydration
 * - ./templates: Template loading, saving, and deletion
 * - ./markdownIo: Markdown import/export helpers
 */

import { apiClient } from "@/lib/apiClient";
import type { KnowledgeBase, KnowledgeFolder } from "../types";
import type { ListLoadAllPayload } from "./types";

export * from "./types";
export * from "./folders";
export * from "./notes";
export * from "./templates";
export * from "./markdownIo";

/** Module shell: folders + lists only (no note content). */
export async function loadAll(): Promise<ListLoadAllPayload> {
  const [foldersRes, listsRes] = await Promise.all([
    apiClient.get<any[]>("/api/v1/knowledge-bases"),
    apiClient.get<any[]>("/api/v1/folders"),
  ]);

  const folders: KnowledgeBase[] = (foldersRes ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    sortOrder: f.sort_order ?? f.sortOrder ?? 0,
    lockVersion: Number(f.lock_version ?? f.lockVersion ?? 1),
  }));

  const lists: KnowledgeFolder[] = (listsRes ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    knowledgeBaseId: l.knowledge_base_id ?? l.knowledgeBaseId ?? null,
    sortOrder: l.sort_order ?? l.sortOrder ?? 0,
    lockVersion: Number(l.lock_version ?? l.lockVersion ?? 1),
  }));

  return { folders, lists, noteGroups: [], notes: [] };
}
