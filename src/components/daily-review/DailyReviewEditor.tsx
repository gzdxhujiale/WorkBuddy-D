import { useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { Selection } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extension-placeholder";
import { RichTextProvider } from "reactjs-tiptap-editor";
import { localeActions } from "reactjs-tiptap-editor/locale-bundle";
import { Color, RichTextColor } from "reactjs-tiptap-editor/color";
import { Highlight, RichTextHighlight } from "reactjs-tiptap-editor/highlight";
import { RichTextAlign, TextAlign } from "reactjs-tiptap-editor/textalign";
import { Clear, RichTextClear } from "reactjs-tiptap-editor/clear";
import { Heading } from "reactjs-tiptap-editor/heading";
import { Bold, RichTextBold } from "reactjs-tiptap-editor/bold";
import { Italic, RichTextItalic } from "reactjs-tiptap-editor/italic";
import { RichTextUnderline, TextUnderline } from "reactjs-tiptap-editor/textunderline";
import { RichTextStrike, Strike } from "reactjs-tiptap-editor/strike";
import { BulletList, RichTextBulletList } from "reactjs-tiptap-editor/bulletlist";
import { OrderedList, RichTextOrderedList } from "reactjs-tiptap-editor/orderedlist";
import { RichTextTaskList, TaskList } from "reactjs-tiptap-editor/tasklist";
import { Blockquote, RichTextBlockquote } from "reactjs-tiptap-editor/blockquote";
import { Drawer, RichTextDrawer } from "reactjs-tiptap-editor/drawer";
import { RichTextTable, Table } from "reactjs-tiptap-editor/table";
import { Code } from "reactjs-tiptap-editor/code";
import { CodeBlock, RichTextCodeBlock } from "reactjs-tiptap-editor/codeblock";
import { Link, RichTextLink } from "reactjs-tiptap-editor/link";
import { HorizontalRule, RichTextHorizontalRule } from "reactjs-tiptap-editor/horizontalrule";
import { RichTextUndo, RichTextRedo } from "reactjs-tiptap-editor/history";
import {
  RichTextSearchAndReplace,
  SearchAndReplace,
} from "reactjs-tiptap-editor/searchandreplace";
import { SlashCommand, SlashCommandList } from "reactjs-tiptap-editor/slashcommand";
import {
  RichTextBubbleCodeBlock,
  RichTextBubbleLink,
  RichTextBubbleMenuDragHandle,
  RichTextBubbleText,
} from "reactjs-tiptap-editor/bubble";
import "reactjs-tiptap-editor/style.css";

interface DailyReviewEditorProps {
  content: string;
  onChange: (content: string) => void;
}

type EditorContentValue = string | Record<string, unknown>;

const EMPTY_DOCUMENT = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const EDITOR_EXTENSIONS = [
  StarterKit.configure({
    heading: false,
    bold: false,
    italic: false,
    link: false,
    bulletList: false,
    orderedList: false,
    strike: false,
    blockquote: false,
    code: false,
    codeBlock: false,
    horizontalRule: false,
    underline: false,
  }),
  Selection,
  Heading.configure({ levels: [1, 2, 3] }),
  Bold,
  Italic,
  TextUnderline,
  BulletList,
  OrderedList,
  Strike,
  Blockquote,
  Code,
  CodeBlock,
  Link.configure({ openOnClick: false }),
  HorizontalRule,
  Placeholder.configure({
    placeholder: "写下今天的复盘感受、收获与反思，或输入 / 使用命令...",
  }),
  Clear,
  Color.configure({
    colors: ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6"],
  }),
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({ types: ["heading", "paragraph", "list_item"] }),
  TaskList,
  Table,
  Drawer,
  SearchAndReplace,
  SlashCommand,
];

function parseContent(raw: string): EditorContentValue {
  if (!raw.trim()) return EMPTY_DOCUMENT;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && (parsed as { type?: string }).type === "doc") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Legacy HTML/plain-text values are handled below.
  }

  if (/<[a-z][\s\S]*>/i.test(raw)) return raw;

  return {
    type: "doc",
    content: raw.split(/\r?\n/).map((line) => ({
      type: "paragraph",
      ...(line ? { content: [{ type: "text", text: line }] } : {}),
    })),
  };
}

function EditorToolbar() {
  return (
    <div
      className="flex min-h-11 shrink-0 flex-wrap items-center gap-0.5 overflow-x-auto border-b border-border bg-muted/45 px-2 py-1"
      role="toolbar"
      aria-label="复盘编辑工具栏"
    >
      <RichTextUndo />
      <RichTextRedo />
      <span className="mx-0.5 h-6 w-px shrink-0 bg-border" />
      <RichTextBold />
      <RichTextItalic />
      <RichTextUnderline />
      <RichTextStrike />
      <RichTextColor />
      <RichTextHighlight />
      <span className="mx-0.5 h-6 w-px shrink-0 bg-border" />
      <RichTextBulletList />
      <RichTextOrderedList />
      <RichTextTaskList />
      <RichTextAlign />
      <RichTextBlockquote />
      <RichTextTable />
      <RichTextDrawer />
      <RichTextCodeBlock />
      <RichTextLink />
      <RichTextHorizontalRule />
      <RichTextClear />
      <RichTextSearchAndReplace />
    </div>
  );
}

function EditorBubbles() {
  return (
    <>
      <RichTextBubbleMenuDragHandle />
      <RichTextBubbleText />
      <RichTextBubbleLink />
      <RichTextBubbleCodeBlock />
      <SlashCommandList />
    </>
  );
}

export function DailyReviewEditor({ content, onChange }: DailyReviewEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const isUpdatingFromEditorRef = useRef(false);
  const lastContentRef = useRef(content);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: EDITOR_EXTENSIONS,
    content: parseContent(content),
    onUpdate: ({ editor: currentEditor }) => {
      const jsonStr = JSON.stringify(currentEditor.getJSON());
      lastContentRef.current = jsonStr;
      isUpdatingFromEditorRef.current = true;
      onChangeRef.current(jsonStr);
      queueMicrotask(() => {
        isUpdatingFromEditorRef.current = false;
      });
    },
    editorProps: {
      attributes: {
        spellcheck: "true",
      },
    },
  });

  useEffect(() => {
    localeActions.setLang("zh_CN");
  }, []);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    if (isUpdatingFromEditorRef.current) return;
    if (content === lastContentRef.current) return;

    lastContentRef.current = content;

    const nextContent = parseContent(content);
    if (typeof nextContent === "string") return;

    const currentJson = JSON.stringify(editor.getJSON());
    if (currentJson !== JSON.stringify(nextContent)) {
      editor.commands.setContent(nextContent, { emitUpdate: false });
    }
  }, [content, editor]);

  if (!editor) {
    return <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">正在加载编辑器...</div>;
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-card selection:bg-[#bfdbfe] selection:text-slate-900 dark:selection:bg-blue-900/80 dark:selection:text-blue-100 [&>.reactjs-tiptap-editor]:flex [&>.reactjs-tiptap-editor]:min-h-0 [&>.reactjs-tiptap-editor]:flex-1 [&>.reactjs-tiptap-editor]:flex-col [&>.reactjs-tiptap-editor]:overflow-hidden">
      <RichTextProvider editor={editor}>
        <EditorToolbar />
        <EditorContent
          editor={editor}
          className={
            "flex min-h-0 min-w-0 flex-1 overflow-y-auto !bg-card " +
            "[&_*::selection]:!bg-[#bfdbfe] [&_*::selection]:!text-slate-900 dark:[&_*::selection]:!bg-blue-900/90 dark:[&_*::selection]:!text-blue-100 " +
            "[&_.selection]:!bg-[#bfdbfe] [&_.selection]:!text-slate-900 dark:[&_.selection]:!bg-blue-900/90 dark:[&_.selection]:!text-blue-100 " +
            "[&_.ProseMirror]:min-h-full [&_.ProseMirror]:w-full [&_.ProseMirror]:min-w-0 [&_.ProseMirror]:box-border [&_.ProseMirror]:!bg-card [&_.ProseMirror]:p-5 [&_.ProseMirror]:px-6 [&_.ProseMirror]:pb-12 [&_.ProseMirror]:outline-none " +
            "[&_.ProseMirror>*]:mx-0 [&_.ProseMirror>*]:max-w-none " +
            "[&_.ProseMirror_blockquote]:my-3 [&_.ProseMirror_blockquote]:rounded-md [&_.ProseMirror_blockquote]:rounded-l-none [&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-primary/45 [&_.ProseMirror_blockquote]:bg-muted/50 [&_.ProseMirror_blockquote]:px-4 [&_.ProseMirror_blockquote]:py-2 [&_.ProseMirror_blockquote]:text-muted-foreground [&_.ProseMirror_blockquote]:italic " +
            "[&_.ProseMirror_pre]:my-3 [&_.ProseMirror_pre]:overflow-x-auto [&_.ProseMirror_pre]:rounded-md [&_.ProseMirror_pre]:border [&_.ProseMirror_pre]:border-border [&_.ProseMirror_pre]:bg-muted [&_.ProseMirror_pre]:p-4 [&_.ProseMirror_pre]:font-mono [&_.ProseMirror_pre]:text-sm " +
            "[&_.ProseMirror_pre_code]:bg-transparent [&_.ProseMirror_pre_code]:p-0 [&_.ProseMirror_pre_code]:text-inherit " +
            "[&_.ProseMirror_.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_.is-editor-empty:first-child::before]:text-muted-foreground [&_.ProseMirror_.is-editor-empty:first-child::before]:opacity-65 [&_.ProseMirror_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]"
          }
        />
        <EditorBubbles />
      </RichTextProvider>
    </div>
  );
}

export function convertMarkdownToTipTapJson(markdown: string): string {
  if (!markdown) return JSON.stringify(EMPTY_DOCUMENT);

  const trimmed = markdown.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && parsed.type === "doc") return trimmed;
    } catch {
      // Treat invalid JSON as markdown.
    }
  }

  return JSON.stringify({
    type: "doc",
    content: markdown.split("\n").map((line) => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : [],
    })),
  });
}

export function convertTipTapJsonToMarkdown(jsonOrText: string): string {
  if (!jsonOrText) return "";

  try {
    const parsed = JSON.parse(jsonOrText);
    if (parsed && Array.isArray(parsed.content)) {
      return parsed.content
        .map((block: any) => {
          if (block.type === "heading") {
            const level = block.attrs?.level || 1;
            const text = block.content?.map((inline: any) => inline.text || "").join("") || "";
            return `${"#".repeat(level)} ${text}`;
          }
          if (block.type === "bulletList" || block.type === "orderedList") {
            return block.content?.map((item: any, index: number) => {
              const prefix = block.type === "orderedList" ? `${index + 1}. ` : "- ";
              const text = item.content?.[0]?.content?.map((inline: any) => inline.text || "").join("") || "";
              return prefix + text;
            }).join("\n") || "";
          }
          if (block.type === "taskList") {
            return block.content?.map((item: any) => {
              const checked = item.attrs?.checked ? "x" : " ";
              const text = item.content?.[0]?.content?.map((inline: any) => inline.text || "").join("") || "";
              return `- [${checked}] ${text}`;
            }).join("\n") || "";
          }
          if (block.type === "blockquote") {
            const text = block.content?.map((inner: any) => {
              if (inner.type === "paragraph") {
                return inner.content?.map((inline: any) => inline.text || "").join("") || "";
              }
              return "";
            }).join("\n") || "";
            return text.split("\n").map((line: string) => `> ${line}`).join("\n");
          }
          if (block.type === "codeBlock") {
            const language = block.attrs?.language || "";
            const text = block.content?.map((inline: any) => inline.text || "").join("") || "";
            return `\`\`\`${language}\n${text}\n\`\`\``;
          }
          if (block.type === "horizontalRule") return "---";
          if (Array.isArray(block.content)) {
            return block.content.map((inline: any) => inline.text || "").join("");
          }
          return "";
        })
        .join("\n\n");
    }
  } catch {
    // Return plain text when it is not JSON.
  }

  return jsonOrText;
}
