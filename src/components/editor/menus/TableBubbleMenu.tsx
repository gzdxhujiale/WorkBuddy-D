import React, { useEffect, useRef } from "react";
import type { Editor } from "@tiptap/core";
import { BubbleMenuPlugin } from "@tiptap/extension-bubble-menu";
import {
  ArrowUpToLine,
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  Merge,
  Split,
  TableProperties,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface TableBubbleMenuProps {
  editor: Editor;
  isPixelTheme?: boolean;
  suppress?: boolean;
}

export const TableBubbleMenu: React.FC<TableBubbleMenuProps> = ({
  editor,
  isPixelTheme,
  suppress = false,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const suppressRef = useRef(suppress);
  suppressRef.current = suppress;

  useEffect(() => {
    if (!editor || editor.isDestroyed || !menuRef.current) return;

    const pluginKey = "customTableBubbleMenu";
    const plugin = BubbleMenuPlugin({
      pluginKey,
      editor,
      element: menuRef.current,
      shouldShow: ({ editor: currentEditor, state }) => {
        if (suppressRef.current) {
          return false;
        }
        if (!currentEditor || currentEditor.isDestroyed || !currentEditor.isEditable) {
          return false;
        }
        if (!currentEditor.isActive("table")) {
          return false;
        }
        // If regular text is actively selected across characters within a cell,
        // yield to the text formatting bubble menu to avoid overlap.
        const { selection } = state;
        const isCellSelection =
          selection.constructor.name === "CellSelection" || "isRowSelection" in selection;
        if (!selection.empty && !isCellSelection) {
          return false;
        }
        return true;
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

  const handleMouseDown = (e: React.MouseEvent) => {
    // Prevent ProseMirror selection blur
    e.preventDefault();
  };

  const btnClass = (destructive = false, disabled = false) =>
    cn(
      "flex size-7 shrink-0 items-center justify-center rounded-md text-xs transition-colors select-none",
      destructive
        ? "text-destructive hover:bg-destructive/15 active:bg-destructive/25"
        : "text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted/80",
      disabled && "opacity-35 pointer-events-none cursor-not-allowed",
      isPixelTheme && "rounded-xs"
    );

  const divider = <div className="mx-0.5 h-4 w-px bg-border/70 shrink-0" />;

  const canMerge = editor.can().mergeCells();
  const canSplit = editor.can().splitCell();

  return (
    <div
      ref={menuRef}
      onMouseDown={handleMouseDown}
      className={cn(
        "flex items-center gap-0.5 p-1 bg-popover text-popover-foreground shadow-lg select-none outline-none animate-in fade-in zoom-in-95 duration-100",
        isPixelTheme
          ? "rounded-xs border-2 border-border font-mono shadow-[3px_3px_0px_#000]"
          : "border border-border rounded-xl shadow-[0_4px_14px_rgba(0,0,0,0.12)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
      )}
    >
      {/* Row operations */}
      <button
        type="button"
        title="在上方插入行"
        onClick={() => editor.chain().focus().addRowBefore().run()}
        className={btnClass()}
      >
        <ArrowUpToLine size={14} />
      </button>
      <button
        type="button"
        title="在下方插入行"
        onClick={() => editor.chain().focus().addRowAfter().run()}
        className={btnClass()}
      >
        <ArrowDownToLine size={14} />
      </button>

      {/* Column operations */}
      <button
        type="button"
        title="在左侧插入列"
        onClick={() => editor.chain().focus().addColumnBefore().run()}
        className={btnClass()}
      >
        <ArrowLeftToLine size={14} />
      </button>
      <button
        type="button"
        title="在右侧插入列"
        onClick={() => editor.chain().focus().addColumnAfter().run()}
        className={btnClass()}
      >
        <ArrowRightToLine size={14} />
      </button>

      {divider}

      {/* Cell merge / split */}
      <button
        type="button"
        title="合并选中单元格"
        disabled={!canMerge}
        onClick={() => editor.chain().focus().mergeCells().run()}
        className={btnClass(false, !canMerge)}
      >
        <Merge size={14} />
      </button>
      <button
        type="button"
        title="拆分单元格"
        disabled={!canSplit}
        onClick={() => editor.chain().focus().splitCell().run()}
        className={btnClass(false, !canSplit)}
      >
        <Split size={14} />
      </button>

      {/* Toggle header row */}
      <button
        type="button"
        title="切换表头行"
        onClick={() => editor.chain().focus().toggleHeaderRow().run()}
        className={btnClass()}
      >
        <TableProperties size={14} />
      </button>

      {divider}

      {/* Row / Column / Table deletions */}
      <button
        type="button"
        title="删除当前行"
        onClick={() => editor.chain().focus().deleteRow().run()}
        className={btnClass(true)}
      >
        <span className="text-[10px] font-bold text-destructive leading-none">-行</span>
      </button>
      <button
        type="button"
        title="删除当前列"
        onClick={() => editor.chain().focus().deleteColumn().run()}
        className={btnClass(true)}
      >
        <span className="text-[10px] font-bold text-destructive leading-none">-列</span>
      </button>
      <button
        type="button"
        title="删除整张表格"
        onClick={() => editor.chain().focus().deleteTable().run()}
        className={btnClass(true)}
      >
        <Trash2 size={13} className="text-destructive" />
      </button>
    </div>
  );
};
