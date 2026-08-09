import { useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extension-placeholder";
import { RichTextProvider } from "reactjs-tiptap-editor";
import { localeActions } from "reactjs-tiptap-editor/locale-bundle";
import { Color, RichTextColor } from "reactjs-tiptap-editor/color";
import { Highlight, RichTextHighlight } from "reactjs-tiptap-editor/highlight";
import { RichTextAlign, TextAlign } from "reactjs-tiptap-editor/textalign";
import { Clear, RichTextClear } from "reactjs-tiptap-editor/clear";
import { RichTextHeading } from "reactjs-tiptap-editor/heading";
import { RichTextBold } from "reactjs-tiptap-editor/bold";
import { RichTextItalic } from "reactjs-tiptap-editor/italic";
import { RichTextUnderline } from "reactjs-tiptap-editor/textunderline";
import { RichTextStrike } from "reactjs-tiptap-editor/strike";
import { RichTextBulletList } from "reactjs-tiptap-editor/bulletlist";
import { RichTextOrderedList } from "reactjs-tiptap-editor/orderedlist";
import { RichTextTaskList, TaskList } from "reactjs-tiptap-editor/tasklist";
import { RichTextBlockquote } from "reactjs-tiptap-editor/blockquote";
import { RichTextCode } from "reactjs-tiptap-editor/code";
import { RichTextCodeBlock } from "reactjs-tiptap-editor/codeblock";
import { RichTextLink } from "reactjs-tiptap-editor/link";
import { RichTextHorizontalRule } from "reactjs-tiptap-editor/horizontalrule";
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
    heading: { levels: [1, 2, 3] },
    link: { openOnClick: false },
  }),
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
      <RichTextHeading />
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
      <RichTextCode />
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
