import { Node, mergeAttributes } from "@tiptap/core";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import type { NoteWikilinkItem } from "../types";

export const WikilinkPluginKey = new PluginKey("wikilinkSuggestion");

export interface WikilinkOptions {
  suggestion: Omit<SuggestionOptions<NoteWikilinkItem>, "editor">;
  onNavigateNote?: (noteId: string) => void;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    wikilink: {
      insertWikilink: (attributes: { noteId: string; noteTitle: string }) => ReturnType;
    };
  }
}

export const WikilinkExtension = Node.create<WikilinkOptions>({
  name: "wikilink",
  group: "inline",
  inline: true,
  selectable: true,
  atom: true,

  addOptions() {
    return {
      suggestion: {
        char: "[[",
        pluginKey: WikilinkPluginKey,
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              {
                type: this.name,
                attrs: {
                  noteId: props.id,
                  noteTitle: props.title,
                },
              },
              {
                type: "text",
                text: " ",
              },
            ])
            .run();
        },
      },
    };
  },

  addAttributes() {
    return {
      noteId: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-note-id") || "",
        renderHTML: (attributes) => ({
          "data-note-id": attributes.noteId,
          "data-type": "wikilink",
        }),
      },
      noteTitle: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-note-title") || element.textContent || "",
        renderHTML: (attributes) => ({
          "data-note-title": attributes.noteTitle,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="wikilink"]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const title = node.attrs.noteTitle || "未命名笔记";
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class:
          "wikilink inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold select-none cursor-pointer border border-primary/20 transition-colors align-baseline",
      }),
      `📄 ${title}`,
    ];
  },

  addCommands() {
    return {
      insertWikilink:
        (attributes) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: attributes,
          });
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
