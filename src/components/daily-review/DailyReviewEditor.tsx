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
    <div className="daily-review-editor-toolbar" role="toolbar" aria-label="复盘编辑工具栏">
      <RichTextUndo />
      <RichTextRedo />
      <span className="daily-review-editor-toolbar-divider" />
      <RichTextBold />
      <RichTextItalic />
      <RichTextUnderline />
      <RichTextStrike />
      <RichTextColor />
      <RichTextHighlight />
      <span className="daily-review-editor-toolbar-divider" />
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

  const editor = useEditor({
    immediatelyRender: false,
    extensions: EDITOR_EXTENSIONS,
    content: parseContent(content),
    onUpdate: ({ editor: currentEditor }) => {
      onChangeRef.current(JSON.stringify(currentEditor.getJSON()));
    },
    editorProps: {
      attributes: {
        class: "daily-review-prosemirror",
        spellcheck: "true",
      },
    },
  });

  useEffect(() => {
    localeActions.setLang("zh_CN");
  }, []);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    const nextContent = parseContent(content);
    if (typeof nextContent === "string") return;

    const currentJson = JSON.stringify(editor.getJSON());
    if (currentJson !== JSON.stringify(nextContent)) {
      editor.commands.setContent(nextContent, { emitUpdate: false });
    }
  }, [content, editor]);

  if (!editor) {
    return <div className="daily-review-editor-loading">正在加载编辑器...</div>;
  }

  return (
    <div className="daily-review-editor-shell">
      <RichTextProvider editor={editor}>
        <EditorToolbar />
        <div className="daily-review-editor-scroll-area">
          <EditorContent editor={editor} />
        </div>
        <EditorBubbles />
      </RichTextProvider>
    </div>
  );
}
