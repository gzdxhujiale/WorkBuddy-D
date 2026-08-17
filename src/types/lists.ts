export interface List {
  id: string;
  name: string;
  folderId: string | null;
  sortOrder?: number;
}

export interface Folder {
  id: string;
  name: string;
  sortOrder?: number;
}

export interface NoteGroup {
  id: string;
  listId: string;
  name: string;
  sortOrder?: number;
}

export interface Note {
  id: string;
  listId: string;
  groupId?: string | null;
  title: string;
  content: string;
  /** `false` means this is a list summary; load the body before editing/exporting. */
  contentLoaded?: boolean;
  sortOrder?: number;
  createdAt: number;
  updatedAt: number;
  /** Server version the pending edit was based on; omitted for a new note. */
  baseUpdatedAt?: number;
}

export interface Template {
  id: string;
  name: string;
  content: string;
}

export interface ListsData {
  lists: List[];
  folders: Folder[];
  noteGroups: NoteGroup[];
  notes: Note[];
  templates: Template[];
}
