import { useEffect, useMemo, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { Editor } from "@tiptap/core";
import { Markdown } from "@tiptap/markdown";
import { TaskList as TiptapTaskList } from "@tiptap/extension-task-list";
import { TaskItem as TiptapTaskItem } from "@tiptap/extension-task-item";
import { Table as TiptapTable } from "@tiptap/extension-table";
import { TableRow as TiptapTableRow } from "@tiptap/extension-table-row";
import { TableHeader as TiptapTableHeader } from "@tiptap/extension-table-header";
import { TableCell as TiptapTableCell } from "@tiptap/extension-table-cell";
import { Selection } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extension-placeholder";
import { RichTextProvider } from "reactjs-tiptap-editor";
import { localeActions, useLocale } from "reactjs-tiptap-editor/locale-bundle";
import { RichTextAlign, TextAlign } from "reactjs-tiptap-editor/textalign";
import { Clear, RichTextClear } from "reactjs-tiptap-editor/clear";
import { Heading } from "reactjs-tiptap-editor/heading";
import { Bold, RichTextBold } from "reactjs-tiptap-editor/bold";
import { Italic, RichTextItalic } from "reactjs-tiptap-editor/italic";
import { RichTextUnderline, TextUnderline } from "reactjs-tiptap-editor/textunderline";
import { RichTextStrike, Strike } from "reactjs-tiptap-editor/strike";
import { Highlight, RichTextHighlight } from "reactjs-tiptap-editor/highlight";
import { BulletList, RichTextBulletList } from "reactjs-tiptap-editor/bulletlist";
import { OrderedList, RichTextOrderedList } from "reactjs-tiptap-editor/orderedlist";
import { RichTextTaskList, TaskList } from "reactjs-tiptap-editor/tasklist";
import { Blockquote, RichTextBlockquote } from "reactjs-tiptap-editor/blockquote";
import { Callout, RichTextCallout } from "reactjs-tiptap-editor/callout";
import { Table, RichTextTable } from "reactjs-tiptap-editor/table";
import { Details, RichTextDetails } from "reactjs-tiptap-editor/details";
import { Code } from "reactjs-tiptap-editor/code";
import { CodeBlock, RichTextCodeBlock } from "reactjs-tiptap-editor/codeblock";
import { Link, RichTextLink } from "reactjs-tiptap-editor/link";
import { HorizontalRule, RichTextHorizontalRule } from "reactjs-tiptap-editor/horizontalrule";
import { RichTextUndo, RichTextRedo } from "reactjs-tiptap-editor/history";
import {
  RichTextSearchAndReplace,
  SearchAndReplace,
} from "reactjs-tiptap-editor/searchandreplace";
import {
  SlashCommand,
  SlashCommandList,
  renderCommandListDefault,
} from "reactjs-tiptap-editor/slashcommand";
import { RichTextBubbleText } from "reactjs-tiptap-editor/bubble/text";
import { RichTextBubbleLink } from "reactjs-tiptap-editor/bubble/link";
import { RichTextBubbleCodeBlock } from "reactjs-tiptap-editor/bubble/codeblock";
import { RichTextBubbleTable } from "reactjs-tiptap-editor/bubble/table";
import { RichTextBubbleCallout } from "reactjs-tiptap-editor/bubble/callout";
import "reactjs-tiptap-editor/style.css";
import { cn } from "@/lib/utils";

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

const CustomHeading = Heading.extend({
  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      "Mod-1": () => this.editor.commands.toggleHeading({ level: 1 }),
      "Mod-2": () => this.editor.commands.toggleHeading({ level: 2 }),
      "Mod-3": () => this.editor.commands.toggleHeading({ level: 3 }),
      "Mod-4": () => this.editor.commands.toggleHeading({ level: 4 }),
      "Mod-5": () => this.editor.commands.toggleHeading({ level: 5 }),
      "Mod-6": () => this.editor.commands.toggleHeading({ level: 6 }),
      "Mod-0": () => this.editor.commands.setParagraph(),
    };
  },
});

const CustomBulletList = BulletList.extend({
  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      "Mod-7": () => this.editor.commands.toggleBulletList(),
      "Mod-Shift-8": () => this.editor.commands.toggleBulletList(),
    };
  },
});

const CustomOrderedList = OrderedList.extend({
  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      "Mod-8": () => this.editor.commands.toggleOrderedList(),
      "Mod-Shift-7": () => this.editor.commands.toggleOrderedList(),
    };
  },
});

const CustomTaskList = TaskList.extend({
  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      "Mod-9": () => this.editor.commands.toggleTaskList(),
      "Mod-Shift-9": () => this.editor.commands.toggleTaskList(),
    };
  },
});

export interface ReactjsTiptapEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
  showToolbar?: boolean;
  hideHighlight?: boolean;
  hideCallout?: boolean;
  autofocus?: "start" | "end" | "all" | boolean | number;
}

type EditorContentValue = string | Record<string, unknown>;

const EMPTY_DOCUMENT = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export function parseContent(raw: string): EditorContentValue {
  if (!raw || !raw.trim()) return EMPTY_DOCUMENT;

  const trimmed = raw.trim();
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object") {
      if ((parsed as { type?: string }).type === "doc") {
        return parsed as Record<string, unknown>;
      }
      // Defensive: unwrap legacy wrapper { text: "..." } or { raw: "..." } if passed directly
      const wrapper = parsed as Record<string, unknown>;
      for (const key of ["text", "raw", "html"]) {
        const val = wrapper[key];
        if (typeof val === "string") {
          const inner = parseContent(val);
          if (inner && typeof inner === "object" && (inner as { type?: string }).type === "doc") {
            return inner;
          }
        } else if (val && typeof val === "object" && (val as { type?: string }).type === "doc") {
          return val as Record<string, unknown>;
        }
      }
    }
  } catch {
    // Legacy HTML/plain-text/markdown values are handled below.
  }

  if (/<[a-z][\s\S]*>/i.test(trimmed)) return trimmed;

  try {
    const jsonStr = convertMarkdownToTipTapJson(raw);
    const parsed: unknown = JSON.parse(jsonStr);
    if (parsed && typeof parsed === "object" && (parsed as { type?: string }).type === "doc") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Fallback to line split below.
  }

  return {
    type: "doc",
    content: raw.split(/\r?\n/).map((line) => ({
      type: "paragraph",
      ...(line ? { content: [{ type: "text", text: line }] } : {}),
    })),
  };
}

function EditorToolbar({
  hideHighlight = false,
  hideCallout = false,
}: {
  hideHighlight?: boolean;
  hideCallout?: boolean;
}) {
  const releaseModalTriggerFocus = (target: EventTarget | null) => {
    const trigger = (target as HTMLElement | null)?.closest<HTMLButtonElement>(
      'button[aria-haspopup="dialog"]',
    );
    if (trigger && document.activeElement === trigger) trigger.blur();
  };

  return (
    <div
      className="flex min-h-11 shrink-0 flex-wrap items-center gap-0.5 overflow-x-auto border-b border-border bg-muted/45 px-2 py-1"
      role="toolbar"
      aria-label="编辑器工具栏"
      onPointerDownCapture={(event) => {
        const trigger = (event.target as HTMLElement).closest<HTMLButtonElement>(
          'button[aria-haspopup="dialog"]',
        );
        if (!trigger) return;
        event.preventDefault();
      }}
      onKeyDownCapture={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          releaseModalTriggerFocus(event.target);
        }
      }}
    >
      <RichTextUndo />
      <RichTextRedo />
      <RichTextBold />
      <RichTextItalic />
      <RichTextUnderline />
      <RichTextStrike />
      {!hideHighlight && <RichTextHighlight />}
      <span className="mx-0.5 h-6 w-px shrink-0 bg-border" />
      <RichTextBulletList />
      <RichTextOrderedList />
      <RichTextTaskList />
      <RichTextAlign />
      <RichTextBlockquote />
      {!hideCallout && <RichTextCallout />}
      <RichTextTable />
      <RichTextDetails />
      <RichTextCodeBlock />
      <RichTextLink />
      <RichTextHorizontalRule />
      <RichTextClear />
      <RichTextSearchAndReplace />
    </div>
  );
}

function EditorBubbles({ hideCallout = false }: { hideCallout?: boolean }) {
  const { t } = useLocale();

  const commandList = useMemo(() => {
    return renderCommandListDefault({ t });
  }, [t]);

  return (
    <>
      <RichTextBubbleText />
      <RichTextBubbleLink />
      <RichTextBubbleCodeBlock />
      <RichTextBubbleTable />
      {!hideCallout && <RichTextBubbleCallout />}
      <SlashCommandList commandList={commandList} />
    </>
  );
}

export function ReactjsTiptapEditor({
  content,
  onChange,
  placeholder = "写下内容，或输入 / 使用命令...",
  className,
  editable = true,
  showToolbar = true,
  hideHighlight = false,
  hideCallout = false,
  autofocus,
}: ReactjsTiptapEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const isUpdatingFromEditorRef = useRef(false);
  const lastContentRef = useRef(content);

  const extensions = useMemo(
    () => [
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
      CustomHeading.configure({
        levels: [1, 2, 3, 4, 5, 6] as HeadingLevel[],
        shortcutKeys: [
          [],
          ["mod", "1"],
          ["mod", "2"],
          ["mod", "3"],
          ["mod", "4"],
          ["mod", "5"],
          ["mod", "6"],
        ],
      }),
      Bold,
      Italic,
      TextUnderline,
      CustomBulletList.configure({
        shortcutKeys: ["mod", "7"],
      }),
      CustomOrderedList.configure({
        shortcutKeys: ["mod", "8"],
      }),
      Strike,
      Highlight,
      Blockquote,
      Callout,
      Code,
      CodeBlock,
      Link.configure({ openOnClick: false }),
      HorizontalRule,
      Placeholder.configure({
        placeholder,
      }),
      Clear,
      TextAlign.configure({ types: ["heading", "paragraph", "list_item"] }),
      CustomTaskList.configure({
        shortcutKeys: ["mod", "9"],
      }),
      Table,
      Details,
      SearchAndReplace,
      SlashCommand,
    ],
    [placeholder]
  );

  const editor = useEditor({
    immediatelyRender: true,
    editable,
    autofocus: autofocus ?? false,
    extensions,
    content: parseContent(content),
    onUpdate: ({ editor: currentEditor }) => {
      const jsonStr = JSON.stringify(currentEditor.getJSON());
      if (jsonStr === lastContentRef.current) return;
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
    if (editor.isEditable !== editable) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    if (isUpdatingFromEditorRef.current) return;
    if (content === lastContentRef.current) return;

    lastContentRef.current = content;

    const nextContent = parseContent(content);
    if (typeof nextContent === "string") {
      if (editor.getHTML() !== nextContent) {
        editor.commands.setContent(nextContent, { emitUpdate: false });
      }
      return;
    }

    const currentJson = JSON.stringify(editor.getJSON());
    if (currentJson !== JSON.stringify(nextContent)) {
      editor.commands.setContent(nextContent, { emitUpdate: false });
    }
  }, [content, editor]);

  if (!editor) {
    return <div className="flex min-h-0 flex-1 bg-card" />;
  }

  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-card selection:bg-[#bfdbfe] selection:text-slate-900 dark:selection:bg-blue-900/80 dark:selection:text-blue-100 [&>.reactjs-tiptap-editor]:flex [&>.reactjs-tiptap-editor]:min-h-0 [&>.reactjs-tiptap-editor]:flex-1 [&>.reactjs-tiptap-editor]:flex-col [&>.reactjs-tiptap-editor]:overflow-hidden",
        className
      )}
    >
      <RichTextProvider editor={editor}>
        {showToolbar && (
          <EditorToolbar
            hideHighlight={hideHighlight}
            hideCallout={hideCallout}
          />
        )}
        <EditorContent
          editor={editor}
          className={
            "flex min-h-0 min-w-0 flex-1 overflow-y-auto !bg-card " +
            "[&_*::selection]:!bg-[#bfdbfe] [&_*::selection]:!text-slate-900 dark:[&_*::selection]:!bg-blue-900/90 dark:[&_*::selection]:!text-blue-100 " +
            "[&_.selection]:!bg-[#bfdbfe] [&_.selection]:!text-slate-900 dark:[&_.selection]:!bg-blue-900/90 dark:[&_.selection]:!text-blue-100 " +
            "[&_.ProseMirror]:min-h-full [&_.ProseMirror]:w-full [&_.ProseMirror]:min-w-0 [&_.ProseMirror]:box-border [&_.ProseMirror]:!bg-card [&_.ProseMirror]:!p-4 [&_.ProseMirror]:!px-5 [&_.ProseMirror]:!pb-12 [&_.ProseMirror]:outline-none " +
            "[&_.ProseMirror>*]:mx-0 [&_.ProseMirror>*]:max-w-none " +
            "[&_.ProseMirror_p]:!text-[14px] [&_.ProseMirror_p]:!mt-0 [&_.ProseMirror_p]:!mb-1.5 " +
            "[&_.ProseMirror_h1]:!text-[20px] [&_.ProseMirror_h1]:!font-bold [&_.ProseMirror_h1]:!mt-1.5 [&_.ProseMirror_h1]:!mb-1.5 " +
            "[&_.ProseMirror_h2]:!text-[18px] [&_.ProseMirror_h2]:!font-bold [&_.ProseMirror_h2]:!mt-1.5 [&_.ProseMirror_h2]:!mb-1.5 " +
            "[&_.ProseMirror_h3]:!text-[16px] [&_.ProseMirror_h3]:!font-bold [&_.ProseMirror_h3]:!mt-1.5 [&_.ProseMirror_h3]:!mb-1.5 " +
            "[&_.ProseMirror_h4]:!text-[15px] [&_.ProseMirror_h4]:!font-bold [&_.ProseMirror_h4]:!mt-1.5 [&_.ProseMirror_h4]:!mb-1.5 " +
            "[&_.ProseMirror_h5]:!text-[14px] [&_.ProseMirror_h5]:!font-bold [&_.ProseMirror_h5]:!mt-1.5 [&_.ProseMirror_h5]:!mb-1.5 " +
            "[&_.ProseMirror_h6]:!text-[13px] [&_.ProseMirror_h6]:!font-bold [&_.ProseMirror_h6]:!mt-1.5 [&_.ProseMirror_h6]:!mb-1.5 " +
            "[&_.ProseMirror_ul]:!mt-1.5 [&_.ProseMirror_ul]:!mb-1.5 [&_.ProseMirror_ol]:!mt-1.5 [&_.ProseMirror_ol]:!mb-1.5 " +
            "[&_.ProseMirror_ul_ul]:!my-0.5 [&_.ProseMirror_ol_ol]:!my-0.5 [&_.ProseMirror_ul_ol]:!my-0.5 [&_.ProseMirror_ol_ul]:!my-0.5 " +
            "[&_.ProseMirror_li_p]:!my-0 " +
            "[&_.heading-1]:!text-[20px] [&_.heading-2]:!text-[18px] [&_.heading-3]:!text-[16px] [&_.heading-4]:!text-[15px] [&_.heading-5]:!text-[14px] [&_.heading-6]:!text-[13px] " +
            "[&_.ProseMirror_blockquote]:my-3 [&_.ProseMirror_blockquote]:rounded-md [&_.ProseMirror_blockquote]:rounded-l-none [&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-primary/45 [&_.ProseMirror_blockquote]:bg-muted/50 [&_.ProseMirror_blockquote]:px-4 [&_.ProseMirror_blockquote]:py-2 [&_.ProseMirror_blockquote]:text-muted-foreground [&_.ProseMirror_blockquote]:italic " +
            "[&_.ProseMirror_pre]:my-3 [&_.ProseMirror_pre]:overflow-x-auto [&_.ProseMirror_pre]:rounded-md [&_.ProseMirror_pre]:border [&_.ProseMirror_pre]:border-border [&_.ProseMirror_pre]:bg-muted [&_.ProseMirror_pre]:p-4 [&_.ProseMirror_pre]:font-mono [&_.ProseMirror_pre]:text-sm " +
            "[&_.ProseMirror_pre_code]:bg-transparent [&_.ProseMirror_pre_code]:p-0 [&_.ProseMirror_pre_code]:text-inherit " +
            "[&_.ProseMirror_details]:my-3 [&_.ProseMirror_details]:rounded-lg [&_.ProseMirror_details]:border [&_.ProseMirror_details]:border-border [&_.ProseMirror_details]:bg-muted/20 [&_.ProseMirror_details]:p-2.5 " +
            "[&_.ProseMirror_summary]:cursor-pointer [&_.ProseMirror_summary]:font-medium [&_.ProseMirror_summary]:select-none [&_.ProseMirror_summary]:rounded [&_.ProseMirror_summary]:px-2 [&_.ProseMirror_summary]:py-1 [&_.ProseMirror_summary]:hover:bg-muted/60 [&_.ProseMirror_summary]:transition-colors " +
            "[&_.ProseMirror_div[data-type='details-content']]:mt-2 [&_.ProseMirror_div[data-type='details-content']]:border-t [&_.ProseMirror_div[data-type='details-content']]:border-border/50 [&_.ProseMirror_div[data-type='details-content']]:pt-2 [&_.ProseMirror_div[data-type='details-content']]:pl-3 " +
            "[&_.ProseMirror_mark]:bg-amber-200/80 [&_.ProseMirror_mark]:rounded-xs [&_.ProseMirror_mark]:px-0.5 dark:[&_.ProseMirror_mark]:bg-amber-900/60 dark:[&_.ProseMirror_mark]:text-amber-100 " +
            "[&_.ProseMirror_.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_.is-editor-empty:first-child::before]:text-muted-foreground [&_.ProseMirror_.is-editor-empty:first-child::before]:opacity-65 [&_.ProseMirror_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]"
          }
        />
        <EditorBubbles hideCallout={hideCallout} />
      </RichTextProvider>
    </div>
  );
}

export function convertMarkdownToTipTapJson(markdown: string): string {
  if (!markdown || !markdown.trim()) return JSON.stringify(EMPTY_DOCUMENT);

  const trimmed = markdown.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && parsed.type === "doc") return trimmed;
    } catch {
      // Treat invalid JSON as markdown.
    }
  }

  try {
    const parserEditor = new Editor({
      extensions: [
        StarterKit,
        Markdown,
        TiptapTaskList,
        TiptapTaskItem,
        TiptapTable,
        TiptapTableRow,
        TiptapTableHeader,
        TiptapTableCell,
      ],
      content: markdown,
      contentType: "markdown",
    });
    const json = parserEditor.getJSON();
    parserEditor.destroy();
    if (json && json.type === "doc" && Array.isArray(json.content) && json.content.length > 0) {
      return JSON.stringify(json);
    }
  } catch (err) {
    console.warn("Failed to parse markdown with TipTap Markdown parser, falling back to line parser:", err);
  }

  return JSON.stringify({
    type: "doc",
    content: markdown.split(/\r?\n/).map((line) => ({
      type: "paragraph",
      ...(line ? { content: [{ type: "text", text: line }] } : {}),
    })),
  });
}

function formatInlineNode(inline: any): string {
  if (!inline) return "";
  if (inline.type === "hardBreak") return "\n";
  let text = inline.text ?? "";
  if (!text) return "";
  if (!Array.isArray(inline.marks) || inline.marks.length === 0) {
    return text;
  }

  const markMap = new Map<string, any>(inline.marks.map((m: any) => [m.type, m]));

  if (markMap.has("code")) {
    text = `\`${text}\``;
  }
  if (markMap.has("highlight")) {
    text = `==${text}==`;
  }
  if (markMap.has("underline")) {
    text = `<u>${text}</u>`;
  }
  if (markMap.has("strike")) {
    text = `~~${text}~~`;
  }
  if (markMap.has("italic")) {
    text = `*${text}*`;
  }
  if (markMap.has("bold")) {
    text = `**${text}**`;
  }
  const linkMark = markMap.get("link");
  if (linkMark?.attrs?.href) {
    text = `[${text}](${linkMark.attrs.href})`;
  }

  return text;
}

function formatInlineNodes(content?: any[]): string {
  if (!Array.isArray(content)) return "";
  return content.map(formatInlineNode).join("");
}

function renderMarkdownBlock(block: any, indent = ""): string {
  if (!block) return "";

  if (block.type === "heading") {
    const level = block.attrs?.level || 1;
    return `${indent}${"#".repeat(level)} ${formatInlineNodes(block.content)}`;
  }

  if (block.type === "paragraph") {
    return `${indent}${formatInlineNodes(block.content)}`;
  }

  if (block.type === "bulletList" || block.type === "orderedList") {
    const isOrdered = block.type === "orderedList";
    return (block.content || [])
      .map((item: any, idx: number) => {
        const marker = isOrdered ? `${idx + 1}. ` : "- ";
        const itemChildren: any[] = item.content || [];
        const lines: string[] = [];
        for (const child of itemChildren) {
          if (child.type === "paragraph") {
            lines.push(formatInlineNodes(child.content));
          } else {
            lines.push(renderMarkdownBlock(child, indent + "  "));
          }
        }
        const firstLine = lines[0] ?? "";
        const remainingLines = lines.slice(1);
        let result = `${indent}${marker}${firstLine}`;
        if (remainingLines.length > 0) {
          result += "\n" + remainingLines.join("\n");
        }
        return result;
      })
      .join("\n");
  }

  if (block.type === "taskList") {
    return (block.content || [])
      .map((item: any) => {
        const checked = item.attrs?.checked ? "x" : " ";
        const marker = `- [${checked}] `;
        const itemChildren: any[] = item.content || [];
        const lines: string[] = [];
        for (const child of itemChildren) {
          if (child.type === "paragraph") {
            lines.push(formatInlineNodes(child.content));
          } else {
            lines.push(renderMarkdownBlock(child, indent + "  "));
          }
        }
        const firstLine = lines[0] ?? "";
        const remainingLines = lines.slice(1);
        let result = `${indent}${marker}${firstLine}`;
        if (remainingLines.length > 0) {
          result += "\n" + remainingLines.join("\n");
        }
        return result;
      })
      .join("\n");
  }

  if (block.type === "codeBlock") {
    const lang = block.attrs?.language || "";
    const code = (block.content || []).map((inline: any) => inline.text || "").join("");
    return `${indent}\`\`\`${lang}\n${code}\n${indent}\`\`\``;
  }

  if (block.type === "blockquote") {
    const text = (block.content || [])
      .map((inner: any) => renderMarkdownBlock(inner, ""))
      .join("\n");
    return text
      .split("\n")
      .map((line: string) => `${indent}> ${line}`)
      .join("\n");
  }

  if (block.type === "callout") {
    const calloutType = (block.attrs?.type || "NOTE").toUpperCase();
    const title = block.attrs?.title || "";
    const header = title ? `> [!${calloutType}] **${title}**` : `> [!${calloutType}]`;
    const lines: string[] = [header];
    if (block.attrs?.body) {
      block.attrs.body.split("\n").forEach((l: string) => lines.push(`> ${l}`));
    } else if (Array.isArray(block.content)) {
      const contentText = block.content.map((c: any) => renderMarkdownBlock(c, "")).join("\n");
      contentText.split("\n").forEach((l: string) => lines.push(`> ${l}`));
    }
    return lines.map((l) => `${indent}${l}`).join("\n");
  }

  if (block.type === "details") {
    const summaryNode = (block.content || []).find((c: any) => c.type === "detailsSummary");
    const summaryText = formatInlineNodes(summaryNode?.content) || "详细信息";
    const contentNode = (block.content || []).find((c: any) => c.type === "detailsContent");
    const bodyText = (contentNode?.content || [])
      .map((c: any) => renderMarkdownBlock(c, ""))
      .filter(Boolean)
      .join("\n\n");
    return `${indent}<details>\n${indent}<summary>${summaryText}</summary>\n\n${bodyText}\n${indent}</details>`;
  }

  if (block.type === "table") {
    const rows = (block.content || []).map((row: any) => {
      const cells = (row.content || []).map((cell: any) => {
        const cellText = (cell.content || [])
          .map((p: any) => formatInlineNodes(p.content))
          .join(" ")
          .replace(/\|/g, "\\|")
          .trim();
        return cellText || " ";
      });
      return `${indent}| ${cells.join(" | ")} |`;
    });
    if (rows.length > 0) {
      const colCount = block.content?.[0]?.content?.length || 1;
      const separator = `${indent}| ${Array(colCount).fill("---").join(" | ")} |`;
      return [rows[0], separator, ...rows.slice(1)].join("\n");
    }
    return "";
  }

  if (block.type === "horizontalRule") {
    return `${indent}---`;
  }

  if (Array.isArray(block.content)) {
    return `${indent}${formatInlineNodes(block.content)}`;
  }

  return "";
}

export function convertTipTapJsonToMarkdown(jsonOrText: string): string {
  if (!jsonOrText || !jsonOrText.trim()) return "";

  try {
    const parsed = JSON.parse(jsonOrText);
    if (parsed && typeof parsed === "object" && parsed.type === "doc" && Array.isArray(parsed.content)) {
      // 1. Try TipTap Markdown serialization first if no custom nodes require manual formatting
      const hasCustomNodes = parsed.content.some((b: any) => b.type === "callout" || b.type === "details");

      if (!hasCustomNodes) {
        try {
          const editor = new Editor({
            extensions: [
              StarterKit,
              Markdown,
              TiptapTaskList,
              TiptapTaskItem,
              TiptapTable,
              TiptapTableRow,
              TiptapTableHeader,
              TiptapTableCell,
            ],
            content: parsed,
          });
          const md = editor.storage.markdown?.manager?.serialize(editor.getJSON());
          editor.destroy();
          if (md && md.trim()) {
            return md;
          }
        } catch {
          // Fall through to recursive AST renderer
        }
      }

      // 2. High-fidelity recursive AST renderer that properly retains multi-level nested lists, tasks, callouts, and details
      return parsed.content
        .map((block: any) => renderMarkdownBlock(block))
        .filter((text: string) => text.trim().length > 0)
        .join("\n\n");
    }
  } catch {
    // Return plain text when it is not JSON.
  }

  return jsonOrText;
}
