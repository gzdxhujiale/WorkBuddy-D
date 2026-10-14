import type { KnowledgeFolder, KnowledgeBase, Note, NoteGroup } from "../types";

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

export function requireLockVersion(entity: VersionedEntity, action: string): number {
  if (entity.lockVersion === undefined) {
    throw new Error(`${action}缺少版本，已阻止非条件写入`);
  }
  return entity.lockVersion;
}
