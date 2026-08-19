/** A folder within a knowledge base. */
export interface KnowledgeFolder {
  id: string;
  name: string;
  knowledgeBaseId: string | null;
  sortOrder?: number;
}

/** The top-level container in the knowledge hierarchy. */
export interface KnowledgeBase {
  id: string;
  name: string;
  sortOrder?: number;
}

export interface NoteGroup {
  id: string;
  folderId: string;
  name: string;
  sortOrder?: number;
}

export interface Note {
  id: string;
  folderId: string;
  groupId?: string | null;
  title: string;
  content: string;
  /** `false` means this is a list summary; load the body before editing/exporting. */
  contentLoaded?: boolean;
  sortOrder?: number;
  createdAt: number;
  updatedAt: number;
  /** Monotonic database version used for optimistic concurrency; omitted for a new note. */
  lockVersion?: number;
  /** Local-only marker; cleared after the first successful database insert. */
  isNew?: boolean;
}

export interface KnowledgeTemplate {
  id: string;
  name: string;
  content: string;
}

export interface KnowledgeData {
  knowledgeFolders: KnowledgeFolder[];
  knowledgeBases: KnowledgeBase[];
  noteGroups: NoteGroup[];
  notes: Note[];
  templates: KnowledgeTemplate[];
}
