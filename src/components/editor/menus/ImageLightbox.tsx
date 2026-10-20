import React, { useEffect } from "react";
import { X, ZoomIn, Download } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ImageLightboxProps {
  src: string | null;
  alt?: string | null;
  isOpen: boolean;
  onClose: () => void;
  isPixelTheme?: boolean;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({
  src,
  alt,
  isOpen,
  onClose,
  isPixelTheme,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !src) return null;

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = src;
    link.download = alt || "image";
    link.target = "_blank";
    link.rel = "noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      role="dialog"
      aria-label="图片全屏预览"
      aria-modal="true"
      onClick={onClose}
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-between p-4 bg-background/80 backdrop-blur-md select-none animate-in fade-in duration-200",
        isPixelTheme && "font-mono"
      )}
    >
      {/* Top Header Controls */}
      <header
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "flex w-full max-w-4xl items-center justify-between px-4 py-2 rounded-xl bg-card/90 border border-border shadow-lg",
          isPixelTheme && "border-2 border-border/90 rounded-xs shadow-[2px_2px_0px_#000]"
        )}
      >
        <div className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
          <ZoomIn size={16} className="text-muted-foreground shrink-0" />
          <span className="truncate max-w-[400px]">{alt || "图片全屏预览"}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleDownload}
            className={cn(
              "flex h-8 items-center gap-1 px-2.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer",
              isPixelTheme && "rounded-xs"
            )}
            title="下载/在新标签页打开原图"
          >
            <Download size={14} />
            <span>原图</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className={cn(
              "flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer",
              isPixelTheme && "rounded-xs"
            )}
            title="关闭 (Esc)"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* Main Image Stage */}
      <main
        onClick={(e) => e.stopPropagation()}
        className="flex-1 flex items-center justify-center w-full min-h-0 py-2 overflow-hidden"
      >
        <img
          src={src}
          alt={alt || "预览图片"}
          className={cn(
            "max-w-[92vw] max-h-[82vh] object-contain rounded-xl border border-border/80 shadow-2xl transition-transform",
            isPixelTheme && "border-2 border-border/90 rounded-xs shadow-[4px_4px_0px_#000]"
          )}
        />
      </main>

      {/* Footer hint */}
      <footer className="text-xs text-muted-foreground/75 pb-1">
        点击遮罩背景或按 <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">Esc</kbd> 退出预览
      </footer>
    </div>
  );
};
