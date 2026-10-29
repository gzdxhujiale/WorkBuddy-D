import { useEffect, useRef } from "react";
import type { Editor } from "@tiptap/core";
import { BubbleMenuPlugin } from "@tiptap/extension-bubble-menu";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Highlighter,
  Code,
  Link as LinkIcon,
  RemoveFormatting,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface EditorBubbleMenuProps {
  editor: Editor;
  isPixelTheme?: boolean;
  suppress?: boolean;
}

export function EditorBubbleMenu({ editor, isPixelTheme, suppress = false }: EditorBubbleMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const suppressRef = useRef(suppress);
  suppressRef.current = suppress;

  useEffect(() => {
    if (!editor || editor.isDestroyed || !menuRef.current) return;

    const pluginKey = "customEditorBubbleMenu";
    const plugin = BubbleMenuPlugin({
      pluginKey,
      editor,
      element: menuRef.current,
      shouldShow: ({ state, from, to }) => {
        if (suppressRef.current) {
          return false;
        }
        const { doc, selection } = state;
        const { empty } = selection;
        if (empty || from === to || editor.isDestroyed || !editor.isEditable) {
          return false;
        }
        // Don't show in code blocks
        if (editor.isActive("codeBlock")) {
          return false;
        }
        const text = doc.textBetween(from, to).trim();
        return text.length > 0;
      },
      options: {
        placement: "top",
      },
    });

    editor.registerPlugin(plugin);

    return () => {
      try {
        editor.unregisterPlugin(pluginKey);
      } catch {
        // Safe unregister
      }
    };
  }, [editor]);

  const toggleLink = () => {
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const previousUrl = editor.getAttributes("link").href || "";
    const url = window.prompt("输入链接地址 (URL):", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const buttonClass = (isActive: boolean) =>
    cn(
      "flex size-7 items-center justify-center rounded-md text-xs transition-colors",
      isActive
        ? isPixelTheme
          ? "bg-amber-200 text-amber-950 dark:bg-amber-900/80 dark:text-amber-100 font-bold border border-amber-800"
          : "bg-accent text-accent-foreground font-semibold"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
      isPixelTheme && "rounded-xs"
    );

  const handleMouseDown = (e: React.MouseEvent) => {
    // Prevent ProseMirror selection blur on button mousedown
    e.preventDefault();
  };

  return (
    <div
      ref={menuRef}
      className={cn(
        "absolute z-50 flex items-center gap-0.5 rounded-lg border border-border bg-popover/95 p-1 shadow-lg backdrop-blur-md select-none pointer-events-auto",
        isPixelTheme && "font-mono border-2 border-border/90 rounded-xs shadow-[2px_2px_0px_#000]"
      )}
      style={{ visibility: "hidden", display: suppress ? "none" : undefined }}
    >
      <button
        type="button"
        onMouseDown={handleMouseDown}
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={buttonClass(editor.isActive("bold"))}
        title="粗体 (Mod-B)"
      >
        <Bold size={14} />
      </button>

      <button
        type="button"
        onMouseDown={handleMouseDown}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={buttonClass(editor.isActive("italic"))}
        title="斜体 (Mod-I)"
      >
        <Italic size={14} />
      </button>

      <button
        type="button"
        onMouseDown={handleMouseDown}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={buttonClass(editor.isActive("underline"))}
        title="下划线 (Mod-U)"
      >
        <UnderlineIcon size={14} />
      </button>

      <button
        type="button"
        onMouseDown={handleMouseDown}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={buttonClass(editor.isActive("strike"))}
        title="删除线"
      >
        <Strikethrough size={14} />
      </button>

      <button
        type="button"
        onMouseDown={handleMouseDown}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        className={buttonClass(editor.isActive("highlight"))}
        title="高亮"
      >
        <Highlighter size={14} />
      </button>

      <button
        type="button"
        onMouseDown={handleMouseDown}
        onClick={() => editor.chain().focus().toggleCode().run()}
        className={buttonClass(editor.isActive("code"))}
        title="行内代码"
      >
        <Code size={14} />
      </button>

      <button
        type="button"
        onMouseDown={handleMouseDown}
        onClick={toggleLink}
        className={buttonClass(editor.isActive("link"))}
        title="添加链接"
      >
        <LinkIcon size={14} />
      </button>

      <div className="mx-0.5 h-4 w-px bg-border/80" />

      <button
        type="button"
        onMouseDown={handleMouseDown}
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        className={buttonClass(false)}
        title="清除格式"
      >
        <RemoveFormatting size={14} />
      </button>
    </div>
  );
}
