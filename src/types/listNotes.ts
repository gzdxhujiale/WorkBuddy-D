import { ListViewType } from "./database";

export type { ListViewType };

export interface ListFolder {
  id: string;
  userId?: string;
  name: string;
  isPinned: boolean;
  sortOrder: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface ListList {
  id: string;
  userId?: string;
  folderId?: string;
  name: string;
  icon: string;
  color: string;
  viewType: ListViewType;
  isPinned: boolean;
  sortOrder: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface ListNoteGroup {
  id: string;
  userId?: string;
  listId: string;
  name: string;
  sortOrder: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface ListNote {
  id: string;
  userId?: string;
  listId: string;
  groupId?: string;
  title: string;
  content: string;
  isPinned: boolean;
  sortOrder: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface ListTemplate {
  id: string;
  userId?: string;
  name: string;
  content: Record<string, unknown>;
  createdAt?: number;
  updatedAt?: number;
}

export interface ListNotesData {
  folders: ListFolder[];
  lists: ListList[];
  groups: ListNoteGroup[];
  notes: ListNote[];
  templates: ListTemplate[];
}
