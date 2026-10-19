import type React from "react";

export type EditorPreset = "minimal" | "compact" | "full";

export interface NoteWikilinkItem {
  id: string;
  title: string;
}

export interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  preset?: EditorPreset;
  placeholder?: string;
  className?: string;
  editable?: boolean;
  showToolbar?: boolean;
  hideHighlight?: boolean;
  hideCallout?: boolean;
  autofocus?: "start" | "end" | "all" | boolean | number;
  onNavigateNote?: (noteId: string) => void;
  notesForWikilinks?: NoteWikilinkItem[];
  footerLeft?: React.ReactNode;
  collabExtensions?: any[];
}

export type EditorContentValue = string | Record<string, unknown>;

export const EMPTY_DOCUMENT = {
  type: "doc",
  content: [{ type: "paragraph" }],
};
