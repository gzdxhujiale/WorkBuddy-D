import React from "react";
import type { Editor } from "@tiptap/core";
import {
  Undo,
  Redo,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  RemoveFormatting,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface CompactToolbarProps {
  editor: Editor | null;
  isPixelTheme?: boolean;
}

export function CompactToolbar({ editor, isPixelTheme }: CompactToolbarProps) {
  if (!editor) return null;

  const btn = (action: () => void, isActive: boolean, title: string, icon: React.ReactNode, disabled = false) => (
    <button
      type="button"
      onClick={action}
      disabled={disabled}
      title={title}
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-md text-xs transition-colors disabled:opacity-35",
        isActive
          ? isPixelTheme
            ? "bg-amber-200 text-amber-950 dark:bg-amber-900/80 dark:text-amber-100 font-bold border border-amber-800"
            : "bg-accent text-accent-foreground font-semibold"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        isPixelTheme && "rounded-xs"
      )}
    >
      {icon}
    </button>
  );

  return (
    <div
      role="toolbar"
      aria-label="编辑器简易工具栏"
      className={cn(
        "flex h-9 shrink-0 items-center gap-0.5 overflow-x-auto overflow-y-hidden no-scrollbar border-b border-border bg-muted/30 px-2 py-1 select-none",
        isPixelTheme && "font-mono border-b-2 border-border/90 bg-amber-50/40 dark:bg-amber-950/40"
      )}
    >
      {btn(() => editor.chain().focus().undo().run(), false, "撤销 (Mod-Z)", <Undo size={14} />, !editor.can().undo())}
      {btn(() => editor.chain().focus().redo().run(), false, "重做 (Mod-Shift-Z)", <Redo size={14} />, !editor.can().redo())}
      <div className="mx-1 h-4 w-px bg-border/60" />

      {btn(() => editor.chain().focus().toggleBold().run(), editor.isActive("bold"), "粗体 (Mod-B)", <Bold size={14} />)}
      {btn(() => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"), "斜体 (Mod-I)", <Italic size={14} />)}
      {btn(() => editor.chain().focus().toggleUnderline().run(), editor.isActive("underline"), "下划线 (Mod-U)", <UnderlineIcon size={14} />)}
      <div className="mx-1 h-4 w-px bg-border/60" />

      {btn(() => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"), "无序列表 (Mod-7)", <List size={14} />)}
      {btn(() => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList"), "有序列表 (Mod-8)", <ListOrdered size={14} />)}
      {btn(() => editor.chain().focus().toggleTaskList().run(), editor.isActive("taskList"), "任务清单 (Mod-9)", <CheckSquare size={14} />)}
      <div className="mx-1 h-4 w-px bg-border/60" />

      {btn(() => editor.chain().focus().toggleBlockquote().run(), editor.isActive("blockquote"), "引用", <Quote size={14} />)}
      {btn(() => editor.chain().focus().toggleCode().run(), editor.isActive("code"), "行内代码", <Code size={14} />)}
      {btn(() => editor.chain().focus().unsetAllMarks().clearNodes().run(), false, "清除格式", <RemoveFormatting size={14} />)}
    </div>
  );
}
