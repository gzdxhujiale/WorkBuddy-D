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
import { Selection } from "@tiptap/extensions";
import { CustomKeymap } from "../extensions/CustomKeymapExtensions";
import { ConsecutiveListJoin } from "../extensions/ConsecutiveListJoinPlugin";
import { CustomCallout } from "../extensions/CustomCallout";
import { CustomDetails, DetailsSummary, DetailsContent } from "../extensions/CustomDetails";
import { CustomCodeBlockLowlight } from "../extensions/CodeBlockWithLowlight";
import { CustomImage } from "../extensions/CustomImage";
import { PasteHandler } from "../extensions/paste-handler";
import { SnapshotExtension } from "../extensions/snapshot/snapshotExtension";

export function createCompactExtensions(placeholder = "输入 / 使用命令...") {
  return [
    StarterKit.configure({
      codeBlock: false,
    }),
    Selection,
    CustomKeymap,
    ConsecutiveListJoin,
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
    PasteHandler,
    SnapshotExtension,
    CharacterCount,
    Placeholder.configure({
      placeholder,
    }),
  ];
}
