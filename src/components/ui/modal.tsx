import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { cn } from "@/lib/utils";

export interface ModalProps {
  open?: boolean;
  visible?: boolean;
  title?: React.ReactNode;
  children?: React.ReactNode;
  onOk?: (e?: React.MouseEvent) => void | Promise<any>;
  onCancel?: (e?: React.MouseEvent) => void;
  okText?: React.ReactNode;
  cancelText?: React.ReactNode;
  okDisabled?: boolean;
  confirmLoading?: boolean;
  width?: number | string;
  style?: React.CSSProperties;
  className?: string;
  footer?: React.ReactNode | null;
  okButtonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  cancelButtonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  maskClosable?: boolean;
  unmountOnClose?: boolean;
  autoFocus?: boolean;
  focusLock?: boolean;
  getChildrenPopupContainer?: () => HTMLElement;
}

const ModalComponent: React.FC<ModalProps> = ({
  open,
  visible,
  title,
  children,
  onOk,
  onCancel,
  okText = "确定",
  cancelText = "取消",
  okDisabled = false,
  confirmLoading = false,
  width = 520,
  style,
  className,
  footer,
  okButtonProps,
  cancelButtonProps,
  maskClosable = true,
}) => {
  const { isPixelTheme } = useAppThemeStyle();
  const isVisible = visible ?? open ?? false;

  useEffect(() => {
    if (!isVisible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isVisible, onCancel]);

  if (!isVisible) return null;

  const widthStyle = typeof width === "number" ? `${width}px` : width;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={() => {
          if (maskClosable) {
            onCancel?.();
          }
        }}
      />

      {/* Modal Dialog Container */}
      <div
        style={{ width: widthStyle, maxWidth: "calc(100vw - 32px)", ...style }}
        className={cn(
          "relative z-50 flex flex-col bg-card text-card-foreground overflow-hidden max-h-[90vh] animate-in fade-in zoom-in-95 duration-200",
          isPixelTheme
            ? "rounded-xs border-2 border-border shadow-[5px_5px_0px_#000] font-mono"
            : "rounded-2xl border border-border shadow-2xl",
          className
        )}
      >
        {/* Header */}
        {title && (
          <div
            className={cn(
              "flex items-center justify-between px-6 py-4 border-b shrink-0",
              isPixelTheme
                ? "border-border bg-amber-50/60 dark:bg-amber-950/40 font-mono font-bold"
                : "border-border/60 font-semibold text-foreground"
            )}
          >
            <div className="text-base truncate flex items-center gap-2">{title}</div>
            <button
              type="button"
              onClick={onCancel}
              className={cn(
                "p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer",
                isPixelTheme
                  ? "rounded-xs border border-border bg-muted/80 hover:bg-muted shadow-[1px_1px_0px_#000]"
                  : "rounded-full hover:bg-muted"
              )}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Body Content */}
        <div className="px-6 py-4 overflow-y-auto flex-1 min-h-0">{children}</div>

        {/* Footer */}
        {footer !== null && (
          <div
            className={cn(
              "flex items-center justify-end gap-2 px-6 py-3.5 border-t shrink-0",
              isPixelTheme
                ? "border-border bg-amber-50/30 dark:bg-amber-950/20"
                : "border-border/60 bg-muted/20"
            )}
          >
            {footer !== undefined ? (
              footer
            ) : (
              <>
                <button
                  type="button"
                  onClick={onCancel}
                  className={cn(
                    "cursor-pointer font-medium transition-colors text-sm",
                    isPixelTheme
                      ? "rounded-xs border-2 border-border bg-muted/60 hover:bg-muted px-4 py-1.5 shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] font-mono"
                      : "rounded-lg border border-border bg-background hover:bg-accent px-4 py-2",
                    cancelButtonProps?.className
                  )}
                  {...cancelButtonProps}
                >
                  {cancelText}
                </button>
                <button
                  type="button"
                  onClick={onOk}
                  disabled={okDisabled || confirmLoading}
                  className={cn(
                    "cursor-pointer font-medium transition-colors text-sm flex items-center gap-1.5",
                    isPixelTheme
                      ? "rounded-xs border-2 border-amber-900 bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold px-4 py-1.5 shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                      : "rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed",
                    okButtonProps?.className
                  )}
                  {...okButtonProps}
                >
                  {confirmLoading && <Loader2 size={14} className="animate-spin" />}
                  {okText}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export const Modal = Object.assign(ModalComponent, {
  confirm: (config?: any) => {
    if (config?.onOk) {
      if (window.confirm(typeof config.title === "string" ? config.title : config.content || "确认执行该操作？")) {
        config.onOk();
      }
    }
    return { close: () => {} };
  },
  info: (config?: any) => {
    alert(config?.content || config?.title || "");
    return { close: () => {} };
  },
  success: (config?: any) => {
    alert(config?.content || config?.title || "");
    return { close: () => {} };
  },
  warning: (config?: any) => {
    alert(config?.content || config?.title || "");
    return { close: () => {} };
  },
  error: (config?: any) => {
    alert(config?.content || config?.title || "");
    return { close: () => {} };
  },
  useModal: () => [null, null] as any,
});

export type { ModalProps as ArcoModalProps };
