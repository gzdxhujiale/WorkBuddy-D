import React, { useRef } from "react";
import type { Editor } from "@tiptap/core";
import {
  Undo,
  Redo,
  Heading1,
  Heading2,
  Heading3,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Highlighter,
  List,
  ListOrdered,
  CheckSquare,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Quote,
  AlertCircle,
  Table as TableIcon,
  ChevronDownSquare,
  Code2,
  Link as LinkIcon,
  Minus,
  Image as ImageIcon,
  RemoveFormatting,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface FullToolbarProps {
  editor: Editor | null;
  isPixelTheme?: boolean;
  hideHighlight?: boolean;
  hideCallout?: boolean;
}

export function FullToolbar({
  editor,
  isPixelTheme,
  hideHighlight,
  hideCallout,
}: FullToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!editor) return null;

  const btn = (
    action: () => void,
    isActive: boolean,
    title: string,
    icon: React.ReactNode,
    disabled = false
  ) => (
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

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      if (src) {
        editor.chain().focus().setImage({ src, alt: file.name }).run();
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div
      role="toolbar"
      aria-label="编辑器完整工具栏"
      className={cn(
        "flex h-9 shrink-0 items-center gap-0.5 overflow-x-auto overflow-y-hidden no-scrollbar border-b border-border bg-muted/35 px-2 py-1 select-none",
        isPixelTheme && "font-mono border-b-2 border-border/90 bg-amber-50/40 dark:bg-amber-950/40"
      )}
    >
      {btn(() => editor.chain().focus().undo().run(), false, "撤销 (Mod-Z)", <Undo size={14} />, !editor.can().undo())}
      {btn(() => editor.chain().focus().redo().run(), false, "重做 (Mod-Shift-Z)", <Redo size={14} />, !editor.can().redo())}
      <div className="mx-1 h-4 w-px bg-border/60" />

      {btn(() => editor.chain().focus().toggleHeading({ level: 1 }).run(), editor.isActive("heading", { level: 1 }), "一级标题 (Mod-1)", <Heading1 size={14} />)}
      {btn(() => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive("heading", { level: 2 }), "二级标题 (Mod-2)", <Heading2 size={14} />)}
      {btn(() => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive("heading", { level: 3 }), "三级标题 (Mod-3)", <Heading3 size={14} />)}
      <div className="mx-1 h-4 w-px bg-border/60" />

      {btn(() => editor.chain().focus().toggleBold().run(), editor.isActive("bold"), "粗体 (Mod-B)", <Bold size={14} />)}
      {btn(() => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"), "斜体 (Mod-I)", <Italic size={14} />)}
      {btn(() => editor.chain().focus().toggleUnderline().run(), editor.isActive("underline"), "下划线 (Mod-U)", <UnderlineIcon size={14} />)}
      {btn(() => editor.chain().focus().toggleStrike().run(), editor.isActive("strike"), "删除线", <Strikethrough size={14} />)}
      {!hideHighlight && btn(() => editor.chain().focus().toggleHighlight().run(), editor.isActive("highlight"), "高亮", <Highlighter size={14} />)}
      <div className="mx-1 h-4 w-px bg-border/60" />

      {btn(() => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"), "无序列表 (Mod-7)", <List size={14} />)}
      {btn(() => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList"), "有序列表 (Mod-8)", <ListOrdered size={14} />)}
      {btn(() => editor.chain().focus().toggleTaskList().run(), editor.isActive("taskList"), "任务清单 (Mod-9)", <CheckSquare size={14} />)}
      <div className="mx-1 h-4 w-px bg-border/60" />

      {btn(() => editor.chain().focus().setTextAlign("left").run(), editor.isActive({ textAlign: "left" }), "左对齐", <AlignLeft size={14} />)}
      {btn(() => editor.chain().focus().setTextAlign("center").run(), editor.isActive({ textAlign: "center" }), "居中对齐", <AlignCenter size={14} />)}
      {btn(() => editor.chain().focus().setTextAlign("right").run(), editor.isActive({ textAlign: "right" }), "右对齐", <AlignRight size={14} />)}
      <div className="mx-1 h-4 w-px bg-border/60" />

      {btn(() => editor.chain().focus().toggleBlockquote().run(), editor.isActive("blockquote"), "引用块", <Quote size={14} />)}
      {!hideCallout && btn(() => editor.chain().focus().toggleCallout({ type: "NOTE" }).run(), editor.isActive("callout"), "提示块 (Callout)", <AlertCircle size={14} />)}
      {btn(() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), editor.isActive("table"), "插入表格", <TableIcon size={14} />)}
      {editor.isActive("table") && (
        <div className="flex items-center gap-0.5 rounded border border-border/70 bg-muted/60 px-1 py-0.5">
          {btn(() => editor.chain().focus().addRowAfter().run(), false, "在下方添加行", <span className="text-[10px] font-semibold">+行</span>)}
          {btn(() => editor.chain().focus().addColumnAfter().run(), false, "在右侧添加列", <span className="text-[10px] font-semibold">+列</span>)}
          {btn(() => editor.chain().focus().deleteRow().run(), false, "删除当前行", <span className="text-[10px] text-destructive font-semibold">-行</span>)}
          {btn(() => editor.chain().focus().deleteColumn().run(), false, "删除当前列", <span className="text-[10px] text-destructive font-semibold">-列</span>)}
          {btn(() => editor.chain().focus().deleteTable().run(), false, "删除表格", <span className="text-[10px] text-destructive font-semibold">删表</span>)}
        </div>
      )}
      {btn(() => editor.chain().focus().setDetails().run(), editor.isActive("details"), "折叠详情", <ChevronDownSquare size={14} />)}
      {btn(() => editor.chain().focus().toggleCodeBlock().run(), editor.isActive("codeBlock"), "代码块", <Code2 size={14} />)}
      {btn(toggleLink, editor.isActive("link"), "链接", <LinkIcon size={14} />)}
      {btn(() => fileInputRef.current?.click(), false, "插入图片", <ImageIcon size={14} />)}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFileChange}
      />
      {btn(() => editor.chain().focus().setHorizontalRule().run(), false, "分割线", <Minus size={14} />)}
      {btn(() => editor.chain().focus().unsetAllMarks().clearNodes().run(), false, "清除格式", <RemoveFormatting size={14} />)}
    </div>
  );
}
