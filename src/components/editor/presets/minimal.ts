import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extension-placeholder";
import { TaskList as TiptapTaskList } from "@tiptap/extension-task-list";
import { TaskItem as TiptapTaskItem } from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import CharacterCount from "@tiptap/extension-character-count";
import { CustomKeymap } from "../extensions/CustomKeymapExtensions";

export function createMinimalExtensions(placeholder = "添加备注...") {
  return [
    StarterKit.configure({
      heading: false,
      codeBlock: false,
      horizontalRule: false,
      blockquote: false,
    }),
    TiptapTaskList,
    TiptapTaskItem.configure({
      nested: true,
      HTMLAttributes: {
        class: "tiptap-task-item",
        "data-type": "taskItem",
      },
    }),
    CustomKeymap,
    Link.configure({
      openOnClick: false,
    }),
    CharacterCount,
    Placeholder.configure({
      placeholder,
    }),
  ];
}
