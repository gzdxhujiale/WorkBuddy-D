import React, { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { BubbleMenuPlugin } from "@tiptap/extension-bubble-menu";
import { NodeSelection } from "@tiptap/pm/state";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Maximize2,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ImageLightbox } from "./ImageLightbox";

export interface ImageBubbleMenuProps {
  editor: Editor;
  isPixelTheme?: boolean;
}

const WIDTH_PRESETS = [
  { label: "25%", value: "25%" },
  { label: "50%", value: "50%" },
  { label: "75%", value: "75%" },
  { label: "100%", value: "100%" },
] as const;

export const ImageBubbleMenu: React.FC<ImageBubbleMenuProps> = ({
  editor,
  isPixelTheme,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [lightboxState, setLightboxState] = useState<{
    isOpen: boolean;
    src: string | null;
    alt: string | null;
  }>({
    isOpen: false,
    src: null,
    alt: null,
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed || !menuRef.current) return;

    const pluginKey = "customImageBubbleMenu";
    const plugin = BubbleMenuPlugin({
      pluginKey,
      editor,
      element: menuRef.current,
      shouldShow: ({ editor: currentEditor, state }) => {
        if (!currentEditor || currentEditor.isDestroyed || !currentEditor.isEditable) {
          return false;
        }
        if (state.selection instanceof NodeSelection && state.selection.node.type.name === "image") {
          return true;
        }
        return currentEditor.isActive("image");
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

  const getImageAttrs = () => {
    const { selection } = editor.state;
    if (selection instanceof NodeSelection && selection.node.type.name === "image") {
      return selection.node.attrs;
    }
    return editor.getAttributes("image") || {};
  };

  const currentAttrs = getImageAttrs();
  const currentWidth = (currentAttrs.width as string) || "100%";
  const currentAlign = (currentAttrs.align as string) || "center";

  const handleMouseDown = (e: React.MouseEvent) => {
    // Prevent ProseMirror selection blur
    e.preventDefault();
  };

  const setWidth = (width: string) => {
    const { selection, tr } = editor.state;
    if (selection instanceof NodeSelection && selection.node.type.name === "image") {
      editor.view.dispatch(
        tr.setNodeMarkup(selection.from, undefined, {
          ...selection.node.attrs,
          width,
        })
      );
      return;
    }
    editor.chain().focus().updateImageAttributes({ width }).run();
  };

  const setAlign = (align: "left" | "center" | "right") => {
    const { selection, tr } = editor.state;
    if (selection instanceof NodeSelection && selection.node.type.name === "image") {
      editor.view.dispatch(
        tr.setNodeMarkup(selection.from, undefined, {
          ...selection.node.attrs,
          align,
        })
      );
      return;
    }
    editor.chain().focus().updateImageAttributes({ align }).run();
  };

  const handleOpenLightbox = () => {
    const src = (currentAttrs.src as string) || null;
    const alt = (currentAttrs.alt as string) || null;
    if (src) {
      setLightboxState({ isOpen: true, src, alt });
    }
  };

  const handleDelete = () => {
    editor.chain().focus().deleteSelection().run();
  };

  const btnClass = (isActive: boolean) =>
    cn(
      "flex size-7 items-center justify-center rounded-md text-xs transition-colors",
      isActive
        ? isPixelTheme
          ? "bg-amber-200 text-amber-950 dark:bg-amber-900/80 dark:text-amber-100 font-bold border border-amber-800"
          : "bg-accent text-accent-foreground font-semibold"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
      isPixelTheme && "rounded-xs"
    );

  return (
    <>
      <div
        ref={menuRef}
        className={cn(
          "absolute z-50 flex items-center gap-1 rounded-lg border border-border bg-popover/95 p-1 shadow-lg backdrop-blur-md select-none pointer-events-auto",
          isPixelTheme && "font-mono border-2 border-border/90 rounded-xs shadow-[2px_2px_0px_#000]"
        )}
        style={{ visibility: "hidden" }}
      >
        {/* Alignment */}
        <button
          type="button"
          onMouseDown={handleMouseDown}
          onClick={() => setAlign("left")}
          className={btnClass(currentAlign === "left")}
          title="居左对齐"
        >
          <AlignLeft size={14} />
        </button>

        <button
          type="button"
          onMouseDown={handleMouseDown}
          onClick={() => setAlign("center")}
          className={btnClass(currentAlign === "center")}
          title="居中对齐"
        >
          <AlignCenter size={14} />
        </button>

        <button
          type="button"
          onMouseDown={handleMouseDown}
          onClick={() => setAlign("right")}
          className={btnClass(currentAlign === "right")}
          title="居右对齐"
        >
          <AlignRight size={14} />
        </button>

        <div className="mx-0.5 h-4 w-px bg-border/80" />

        {/* Width Presets */}
        <div className="flex items-center gap-0.5">
          {WIDTH_PRESETS.map((preset) => {
            const isSelected = currentWidth === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                onMouseDown={handleMouseDown}
                onClick={() => setWidth(preset.value)}
                className={cn(
                  "h-6 px-1.5 rounded text-[11px] font-medium transition-colors cursor-pointer",
                  isSelected
                    ? isPixelTheme
                      ? "bg-amber-200 text-amber-950 dark:bg-amber-900 font-bold border border-amber-800"
                      : "bg-accent text-accent-foreground font-semibold border border-primary/20 shadow-2xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  isPixelTheme && "rounded-xs font-mono"
                )}
                title={`调整为 ${preset.label} 宽度`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <div className="mx-0.5 h-4 w-px bg-border/80" />

        {/* Preview Lightbox */}
        <button
          type="button"
          onMouseDown={handleMouseDown}
          onClick={handleOpenLightbox}
          className={btnClass(false)}
          title="查看大图 (全屏画廊)"
        >
          <Maximize2 size={13} />
        </button>

        {/* Delete Image */}
        <button
          type="button"
          onMouseDown={handleMouseDown}
          onClick={handleDelete}
          className={cn(
            "flex size-7 items-center justify-center rounded-md text-xs text-destructive hover:bg-destructive/10 transition-colors cursor-pointer",
            isPixelTheme && "rounded-xs"
          )}
          title="删除图片"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Lightbox dialog */}
      <ImageLightbox
        src={lightboxState.src}
        alt={lightboxState.alt}
        isOpen={lightboxState.isOpen}
        onClose={() => setLightboxState((prev) => ({ ...prev, isOpen: false }))}
        isPixelTheme={isPixelTheme}
      />
    </>
  );
};
