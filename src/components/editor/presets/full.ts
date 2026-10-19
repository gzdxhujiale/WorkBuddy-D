import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extension-placeholder";
import { TaskList as TiptapTaskList } from "@tiptap/extension-task-list";
import { TaskItem as TiptapTaskItem } from "@tiptap/extension-task-item";
import { Table as TiptapTable } from "@tiptap/extension-table";
import { TableRow as TiptapTableRow } from "@tiptap/extension-table-row";
import { TableHeader as TiptapTableHeader } from "@tiptap/extension-table-header";
import { TableCell as TiptapTableCell } from "@tiptap/extension-table-cell";
import Link from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import CharacterCount from "@tiptap/extension-character-count";
import Dropcursor from "@tiptap/extension-dropcursor";
import { Selection } from "@tiptap/extensions";
import { CustomKeymap } from "../extensions/CustomKeymapExtensions";
import { CustomCallout } from "../extensions/CustomCallout";
import { CustomDetails, DetailsSummary, DetailsContent } from "../extensions/CustomDetails";
import { CustomCodeBlockLowlight } from "../extensions/CodeBlockWithLowlight";
import { CustomImage } from "../extensions/CustomImage";
import { WikilinkExtension } from "../extensions/WikilinkExtension";
import type { NoteWikilinkItem } from "../types";

import type { SuggestionOptions } from "@tiptap/suggestion";

export interface FullPresetOptions {
  placeholder?: string;
  notesForWikilinks?: NoteWikilinkItem[];
  getNotesForWikilinks?: () => NoteWikilinkItem[];
  onNavigateNote?: (noteId: string) => void;
  renderWikilinkPopup?: SuggestionOptions<NoteWikilinkItem>["render"];
}

export function createFullExtensions(options: FullPresetOptions = {}) {
  const {
    placeholder = "开始撰写笔记，或输入 / 使用命令...",
    notesForWikilinks = [],
    getNotesForWikilinks,
    renderWikilinkPopup,
  } = options;

  return [
    StarterKit.configure({
      codeBlock: false,
    }),
    Selection,
    Dropcursor.configure({
      color: "var(--primary)",
      width: 2,
    }),
    CustomKeymap,
    TiptapTaskList,
    TiptapTaskItem.configure({
      nested: true,
      HTMLAttributes: {
        class: "tiptap-task-item",
        "data-type": "taskItem",
      },
    }),
    TiptapTable.configure({
      resizable: true,
    }),
    TiptapTableRow,
    TiptapTableHeader,
    TiptapTableCell,
    Link.configure({
      openOnClick: false,
    }),
    Highlight,
    Underline,
    TextAlign.configure({
      types: ["heading", "paragraph"],
    }),
    CustomCallout,
    CustomDetails,
    DetailsSummary,
    DetailsContent,
    CustomCodeBlockLowlight,
    CustomImage,
    CharacterCount,
    Placeholder.configure({
      placeholder,
    }),
    WikilinkExtension.configure({
      suggestion: {
        char: "[[",
        items: ({ query }) => {
          const list = getNotesForWikilinks ? getNotesForWikilinks() : notesForWikilinks;
          if (!query) return list.slice(0, 10);
          const q = query.toLowerCase();
          return list
            .filter((n) => n.title.toLowerCase().includes(q))
            .slice(0, 10);
        },
        render: renderWikilinkPopup || (() => ({})),
      },
    }),
  ];
}
