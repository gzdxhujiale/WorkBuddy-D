import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/core";
import {
  Copy,
  FileText,
  FileCode,
  Scissors,
  Clipboard,
  CheckSquare,
  ChevronRight,
} from "lucide-react";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { cn } from "@/lib/utils";
import {
  serializeSliceToMarkdown,
  serializeSelectionToMarkdown,
  serializeSelectionToPlainText,
  copyToClipboard,
} from "../utils/selectionClipboard";
import { toast } from "@/components/ui/toast";

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export interface EditorContextMenuProps {
  editor: Editor;
  isOpen: boolean;
  position: ContextMenuPosition;
  onClose: () => void;
}

export function EditorContextMenu({
  editor,
  isOpen,
  position,
  onClose,
}: EditorContextMenuProps) {
  const { isPixelTheme } = useAppThemeStyle();
  const [isSubmenuOpen, setIsSubmenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);

  // Snapshot selection range on open
  const savedSelectionRef = useRef<{ from: number; to: number } | null>(null);

  useEffect(() => {
    if (isOpen && editor && !editor.isDestroyed) {
      const { selection } = editor.state;
      if (selection && !selection.empty) {
        savedSelectionRef.current = { from: selection.from, to: selection.to };
      }
    } else {
      setIsSubmenuOpen(false);
    }
  }, [isOpen, editor]);

  // Click outside and escape key handling
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        (!submenuRef.current || !submenuRef.current.contains(target))
      ) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !editor || editor.isDestroyed) {
    return null;
  }

  const { selection } = editor.state;
  const hasSelection = Boolean(
    (selection && !selection.empty) || savedSelectionRef.current
  );
  const isEditable = editor.isEditable;

  const getSelectedPlainText = () => {
    if (!editor || editor.isDestroyed) return "";
    if (editor.state.selection && !editor.state.selection.empty) {
      return serializeSelectionToPlainText(editor);
    }
    if (savedSelectionRef.current) {
      const { from, to } = savedSelectionRef.current;
      return editor.state.doc.textBetween(from, to, "\n\n", "\n");
    }
    return "";
  };

  const getSelectedMarkdown = () => {
    if (!editor || editor.isDestroyed) return "";
    if (editor.state.selection && !editor.state.selection.empty) {
      return serializeSelectionToMarkdown(editor);
    }
    if (savedSelectionRef.current) {
      const { from, to } = savedSelectionRef.current;
      const slice = editor.state.doc.slice(from, to);
      return serializeSliceToMarkdown(slice);
    }
    return "";
  };

  const restoreEditorSelection = () => {
    if (savedSelectionRef.current && editor && !editor.isDestroyed) {
      const { from, to } = savedSelectionRef.current;
      editor.chain().focus().setTextSelection({ from, to }).run();
    } else if (editor && !editor.isDestroyed) {
      editor.commands.focus();
    }
  };

  const handleCopyPlainText = async () => {
    const text = getSelectedPlainText();
    if (!text) {
      onClose();
      return;
    }
    const ok = await copyToClipboard(text);
    if (ok) {
      toast.success("已复制纯文本");
    }
    onClose();
    restoreEditorSelection();
  };

  const handleCopyMarkdown = async () => {
    const md = getSelectedMarkdown();
    if (!md) {
      onClose();
      return;
    }
    const ok = await copyToClipboard(md);
    if (ok) {
      toast.success("已复制为 Markdown");
    }
    onClose();
    restoreEditorSelection();
  };

  const handleCut = async () => {
    if (!isEditable || !hasSelection) return;
    const text = getSelectedPlainText();
    if (!text) {
      onClose();
      return;
    }
    const ok = await copyToClipboard(text);
    if (ok) {
      if (savedSelectionRef.current) {
        const { from, to } = savedSelectionRef.current;
        editor.chain().focus().setTextSelection({ from, to }).deleteSelection().run();
      } else {
        editor.chain().focus().deleteSelection().run();
      }
      toast.success("已剪切");
    }
    onClose();
  };

  const handlePaste = async () => {
    if (!isEditable) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          editor.chain().focus().insertContent(text).run();
        }
      }
    } catch {
      toast.error("无法访问剪贴板，请使用 Ctrl+V 粘贴");
    }
    onClose();
  };

  const handleSelectAll = () => {
    onClose();
    editor.chain().focus().selectAll().run();
  };

  // Safe viewport boundaries calculation
  const menuWidth = 168;
  const menuHeight = isEditable ? 164 : 100;
  const submenuWidth = 148;

  const left =
    typeof window !== "undefined" && position.x + menuWidth > window.innerWidth - 12
      ? Math.max(12, position.x - menuWidth)
      : position.x;

  const top =
    typeof window !== "undefined" && position.y + menuHeight > window.innerHeight - 12
      ? Math.max(12, position.y - menuHeight)
      : position.y;

  // Submenu orientation: open to left if colliding with right window edge
  const openSubmenuLeft =
    typeof window !== "undefined" && left + menuWidth + submenuWidth > window.innerWidth - 12;

  const itemClass = (disabled = false) =>
    cn(
      "w-full text-left px-2.5 py-1.5 text-xs transition-colors flex items-center justify-between gap-2 select-none outline-none",
      disabled
        ? "opacity-50 pointer-events-none cursor-not-allowed"
        : "cursor-pointer hover:bg-muted active:bg-muted/80 text-foreground",
      isPixelTheme ? "rounded-xs font-mono" : "rounded-lg"
    );

  const menuElement = (
    <div
      ref={menuRef}
      onMouseDown={(e) => {
        // Tiptap / ProseMirror best practice:
        // Prevent default mousedown to stop browser from stealing focus and stripping selection highlight!
        e.preventDefault();
      }}
      style={{
        position: "fixed",
        left,
        top,
        zIndex: 1100,
      }}
      className={cn(
        "min-w-40 p-1 bg-popover text-popover-foreground flex flex-col shadow-lg select-none outline-none animate-in fade-in zoom-in-95 duration-100",
        isPixelTheme
          ? "rounded-xs border-2 border-border font-mono shadow-[3px_3px_0px_#000]"
          : "border border-border rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)]"
      )}
    >
      {isEditable && (
        <button
          type="button"
          disabled={!hasSelection}
          onClick={handleCut}
          className={itemClass(!hasSelection)}
        >
          <div className="flex items-center gap-2">
            <Scissors size={14} className="opacity-70" />
            <span>剪切</span>
          </div>
        </button>
      )}

      {/* Copy cascading menu */}
      <div
        className="relative"
        onMouseEnter={() => hasSelection && setIsSubmenuOpen(true)}
        onMouseLeave={() => setIsSubmenuOpen(false)}
      >
        <button
          type="button"
          disabled={!hasSelection}
          onClick={() => hasSelection && setIsSubmenuOpen((v) => !v)}
          className={cn(itemClass(!hasSelection), isSubmenuOpen && "bg-muted")}
        >
          <div className="flex items-center gap-2">
            <Copy size={14} className="opacity-70" />
            <span>复制</span>
          </div>
          <ChevronRight size={13} className="opacity-60 ml-auto" />
        </button>

        {isSubmenuOpen && (
          <div
            ref={submenuRef}
            style={{
              position: "absolute",
              top: 0,
              ...(openSubmenuLeft
                ? { right: "100%", marginRight: 4 }
                : { left: "100%", marginLeft: 4 }),
            }}
            className={cn(
              "min-w-36 p-1 bg-popover text-popover-foreground flex flex-col shadow-lg select-none outline-none animate-in fade-in zoom-in-95 duration-100",
              isPixelTheme
                ? "rounded-xs border-2 border-border font-mono shadow-[3px_3px_0px_#000]"
                : "border border-border rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)]"
            )}
          >
            <button
              type="button"
              onClick={handleCopyPlainText}
              className={itemClass(false)}
            >
              <div className="flex items-center gap-2">
                <FileText size={14} className="opacity-70" />
                <span>纯文本</span>
              </div>
            </button>
            <button
              type="button"
              onClick={handleCopyMarkdown}
              className={itemClass(false)}
            >
              <div className="flex items-center gap-2">
                <FileCode size={14} className="opacity-70" />
                <span>Markdown</span>
              </div>
            </button>
          </div>
        )}
      </div>

      {isEditable && (
        <button
          type="button"
          onClick={handlePaste}
          className={itemClass(false)}
        >
          <div className="flex items-center gap-2">
            <Clipboard size={14} className="opacity-70" />
            <span>粘贴</span>
          </div>
        </button>
      )}

      <div className="h-px bg-border my-1 -mx-1" />

      <button
        type="button"
        onClick={handleSelectAll}
        className={itemClass(false)}
      >
        <div className="flex items-center gap-2">
          <CheckSquare size={14} className="opacity-70" />
          <span>全选</span>
        </div>
      </button>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(menuElement, document.body)
    : menuElement;
}
