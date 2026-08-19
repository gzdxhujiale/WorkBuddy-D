import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useLayoutEffect,
  ReactNode,
  cloneElement,
  isValidElement,
} from "react";
import { createPortal } from "react-dom";
import { AlertCircle, AlertTriangle, Info, CheckCircle2, LoaderCircle } from "lucide-react";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { cn } from "@/lib/utils";

export type PopconfirmPosition =
  | "top"
  | "topLeft"
  | "topRight"
  | "bottom"
  | "bottomLeft"
  | "bottomRight"
  | "left"
  | "leftTop"
  | "leftBottom"
  | "right"
  | "rightTop"
  | "rightBottom";

export type PopconfirmType = "info" | "warning" | "error" | "danger" | "success";

export interface PopconfirmProps {
  title: ReactNode;
  content?: ReactNode;
  description?: ReactNode;
  okText?: string;
  cancelText?: string;
  okType?: "primary" | "danger" | "secondary" | "outline";
  type?: PopconfirmType;
  icon?: ReactNode;
  position?: PopconfirmPosition;
  disabled?: boolean;
  onOk?: () => void | boolean | Promise<void | boolean>;
  onCancel?: () => void;
  popupVisible?: boolean;
  defaultPopupVisible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  children: React.ReactElement<any>;
  className?: string;
  showArrow?: boolean;
}

export function Popconfirm({
  title,
  content,
  description,
  okText = "确定",
  cancelText = "取消",
  okType = "danger",
  type = "danger",
  icon,
  position = "top",
  disabled = false,
  onOk,
  onCancel,
  popupVisible: controlledVisible,
  defaultPopupVisible = false,
  onVisibleChange,
  children,
  className,
  showArrow = true,
}: PopconfirmProps) {
  const { isPixelTheme } = useAppThemeStyle();
  const [uncontrolledVisible, setUncontrolledVisible] = useState(defaultPopupVisible);
  const isControlled = controlledVisible !== undefined;
  const isVisible = isControlled ? controlledVisible : uncontrolledVisible;

  const [loading, setLoading] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    actualPosition: PopconfirmPosition;
    arrowStyle: React.CSSProperties;
  }>({
    top: 0,
    left: 0,
    actualPosition: position,
    arrowStyle: {},
  });

  const setVisible = useCallback(
    (visible: boolean) => {
      if (disabled && visible) return;
      if (!isControlled) {
        setUncontrolledVisible(visible);
      }
      onVisibleChange?.(visible);
      if (!visible) {
        setLoading(false);
      }
    },
    [disabled, isControlled, onVisibleChange]
  );

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !popoverRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const popoverRect = popoverRef.current.getBoundingClientRect();
    const gap = 8;
    const arrowSize = 6;
    const padding = 8;

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    let targetPos = position;

    // Check collisions and flip if needed
    if (targetPos.startsWith("top") && triggerRect.top - popoverRect.height - gap < padding) {
      targetPos = targetPos.replace("top", "bottom") as PopconfirmPosition;
    } else if (
      targetPos.startsWith("bottom") &&
      triggerRect.bottom + popoverRect.height + gap > viewportH - padding
    ) {
      targetPos = targetPos.replace("bottom", "top") as PopconfirmPosition;
    } else if (
      targetPos.startsWith("left") &&
      triggerRect.left - popoverRect.width - gap < padding
    ) {
      targetPos = targetPos.replace("left", "right") as PopconfirmPosition;
    } else if (
      targetPos.startsWith("right") &&
      triggerRect.right + popoverRect.width + gap > viewportW - padding
    ) {
      targetPos = targetPos.replace("right", "left") as PopconfirmPosition;
    }

    let top = 0;
    let left = 0;
    let arrowStyle: React.CSSProperties = {};

    switch (targetPos) {
      case "top":
        top = triggerRect.top - popoverRect.height - gap;
        left = triggerRect.left + triggerRect.width / 2 - popoverRect.width / 2;
        arrowStyle = {
          bottom: -arrowSize / 2,
          left: "50%",
          transform: "translateX(-50%) rotate(45deg)",
          borderRight: "1px solid var(--color-border)",
          borderBottom: "1px solid var(--color-border)",
        };
        break;
      case "topLeft":
        top = triggerRect.top - popoverRect.height - gap;
        left = triggerRect.left;
        arrowStyle = {
          bottom: -arrowSize / 2,
          left: 16,
          transform: "rotate(45deg)",
          borderRight: "1px solid var(--color-border)",
          borderBottom: "1px solid var(--color-border)",
        };
        break;
      case "topRight":
        top = triggerRect.top - popoverRect.height - gap;
        left = triggerRect.right - popoverRect.width;
        arrowStyle = {
          bottom: -arrowSize / 2,
          right: 16,
          transform: "rotate(45deg)",
          borderRight: "1px solid var(--color-border)",
          borderBottom: "1px solid var(--color-border)",
        };
        break;
      case "bottom":
        top = triggerRect.bottom + gap;
        left = triggerRect.left + triggerRect.width / 2 - popoverRect.width / 2;
        arrowStyle = {
          top: -arrowSize / 2,
          left: "50%",
          transform: "translateX(-50%) rotate(45deg)",
          borderLeft: "1px solid var(--color-border)",
          borderTop: "1px solid var(--color-border)",
        };
        break;
      case "bottomLeft":
        top = triggerRect.bottom + gap;
        left = triggerRect.left;
        arrowStyle = {
          top: -arrowSize / 2,
          left: 16,
          transform: "rotate(45deg)",
          borderLeft: "1px solid var(--color-border)",
          borderTop: "1px solid var(--color-border)",
        };
        break;
      case "bottomRight":
        top = triggerRect.bottom + gap;
        left = triggerRect.right - popoverRect.width;
        arrowStyle = {
          top: -arrowSize / 2,
          right: 16,
          transform: "rotate(45deg)",
          borderLeft: "1px solid var(--color-border)",
          borderTop: "1px solid var(--color-border)",
        };
        break;
      case "left":
        top = triggerRect.top + triggerRect.height / 2 - popoverRect.height / 2;
        left = triggerRect.left - popoverRect.width - gap;
        arrowStyle = {
          right: -arrowSize / 2,
          top: "50%",
          transform: "translateY(-50%) rotate(45deg)",
          borderTop: "1px solid var(--color-border)",
          borderRight: "1px solid var(--color-border)",
        };
        break;
      case "leftTop":
        top = triggerRect.top;
        left = triggerRect.left - popoverRect.width - gap;
        arrowStyle = {
          right: -arrowSize / 2,
          top: 12,
          transform: "rotate(45deg)",
          borderTop: "1px solid var(--color-border)",
          borderRight: "1px solid var(--color-border)",
        };
        break;
      case "leftBottom":
        top = triggerRect.bottom - popoverRect.height;
        left = triggerRect.left - popoverRect.width - gap;
        arrowStyle = {
          right: -arrowSize / 2,
          bottom: 12,
          transform: "rotate(45deg)",
          borderTop: "1px solid var(--color-border)",
          borderRight: "1px solid var(--color-border)",
        };
        break;
      case "right":
        top = triggerRect.top + triggerRect.height / 2 - popoverRect.height / 2;
        left = triggerRect.right + gap;
        arrowStyle = {
          left: -arrowSize / 2,
          top: "50%",
          transform: "translateY(-50%) rotate(45deg)",
          borderBottom: "1px solid var(--color-border)",
          borderLeft: "1px solid var(--color-border)",
        };
        break;
      case "rightTop":
        top = triggerRect.top;
        left = triggerRect.right + gap;
        arrowStyle = {
          left: -arrowSize / 2,
          top: 12,
          transform: "rotate(45deg)",
          borderBottom: "1px solid var(--color-border)",
          borderLeft: "1px solid var(--color-border)",
        };
        break;
      case "rightBottom":
        top = triggerRect.bottom - popoverRect.height;
        left = triggerRect.right + gap;
        arrowStyle = {
          left: -arrowSize / 2,
          bottom: 12,
          transform: "rotate(45deg)",
          borderBottom: "1px solid var(--color-border)",
          borderLeft: "1px solid var(--color-border)",
        };
        break;
    }

    // Viewport bounds constraint
    if (left < padding) left = padding;
    if (left + popoverRect.width > viewportW - padding) {
      left = viewportW - popoverRect.width - padding;
    }
    if (top < padding) top = padding;
    if (top + popoverRect.height > viewportH - padding) {
      top = viewportH - popoverRect.height - padding;
    }

    setCoords({
      top,
      left,
      actualPosition: targetPos,
      arrowStyle,
    });
  }, [position]);

  useLayoutEffect(() => {
    if (isVisible) {
      calculatePosition();
    }
  }, [isVisible, calculatePosition]);

  useEffect(() => {
    if (!isVisible) return;

    const handleScrollOrResize = () => {
      calculatePosition();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setVisible(false);
        onCancel?.();
      }
    };

    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("scroll", handleScrollOrResize, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isVisible, calculatePosition, setVisible, onCancel]);

  const handleOk = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;

    if (onOk) {
      try {
        const result = onOk();
        if (result instanceof Promise) {
          setLoading(true);
          const ok = await result;
          if (ok !== false) {
            setVisible(false);
          }
        } else if (result !== false) {
          setVisible(false);
        }
      } catch (err) {
        setLoading(false);
      }
    } else {
      setVisible(false);
    }
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCancel?.();
    setVisible(false);
  };

  // Render Arco default icon based on type
  const renderIcon = () => {
    if (icon) return icon;
    switch (type) {
      case "danger":
      case "error":
        return <AlertCircle className="size-4 shrink-0 text-[#f53f3f] dark:text-[#f76560] mt-0.5" />;
      case "warning":
        return <AlertTriangle className="size-4 shrink-0 text-[#ff7d00] dark:text-[#ff9a2e] mt-0.5" />;
      case "success":
        return <CheckCircle2 className="size-4 shrink-0 text-[#00b42a] dark:text-[#23c343] mt-0.5" />;
      case "info":
      default:
        return <Info className="size-4 shrink-0 text-[#165dff] dark:text-[#3c7eff] mt-0.5" />;
    }
  };

  const descNode = description || content;

  // Clone children to attach ref and click listener
  const triggerElement = isValidElement(children) ? (
    (() => {
      const trigger = children as React.ReactElement<{ ref?: React.Ref<HTMLElement>; onClick?: React.MouseEventHandler }>;
      const childRef = trigger.props.ref;
      return cloneElement(trigger, {
      ref: (node: HTMLElement | null) => {
        triggerRef.current = node;
        if (typeof childRef === "function") {
          childRef(node);
        } else if (childRef) {
          childRef.current = node;
        }
      },
      onClick: (e: React.MouseEvent) => {
        if (!disabled) {
          setVisible(!isVisible);
        }
        trigger.props.onClick?.(e);
      },
      });
    })()
  ) : (
    <span
      ref={(el) => {
        triggerRef.current = el;
      }}
    >
      {children}
    </span>
  );

  return (
    <>
      {triggerElement}
      {isVisible &&
        createPortal(
          <div className="fixed inset-0 z-[1050] select-none" data-dropdown-menu-overlay>
            {/* Transparent backdrop for outside dismiss */}
            <div
              className="fixed inset-0 bg-transparent"
              onClick={(e) => {
                e.stopPropagation();
                handleCancel(e);
              }}
            />

            {/* Popconfirm Card */}
            <div
              ref={popoverRef}
              style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
              className={cn(
                "fixed z-[1060] min-w-[220px] max-w-[320px] p-3.5 animate-in fade-in zoom-in-95 duration-150",
                isPixelTheme
                  ? "rounded-xs border-2 border-border bg-popover text-popover-foreground shadow-[3px_3px_0px_#000] font-mono"
                  : "rounded-lg border border-border/80 bg-popover text-popover-foreground shadow-[0_4px_16px_rgba(0,0,0,0.1),0_2px_4px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.5)]",
                className
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Optional Arrow */}
              {showArrow && (
                <div
                  style={coords.arrowStyle}
                  className="absolute size-2 bg-popover z-10"
                />
              )}

              {/* Body: Icon + Title + Description */}
              <div className="flex items-start gap-2.5">
                {renderIcon()}
                <div className="flex-1 min-w-0">
                  <div className={cn("text-xs font-semibold text-foreground leading-snug break-words", isPixelTheme && "font-mono")}>
                    {title}
                  </div>
                  {descNode && (
                    <div className={cn("text-[12px] text-muted-foreground leading-relaxed mt-1 break-words", isPixelTheme && "font-mono")}>
                      {descNode}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons: Arco mini buttons */}
              <div className="flex items-center justify-end gap-2 mt-3 pt-1">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleCancel}
                  className={cn(
                    "inline-flex items-center justify-center h-6 px-2.5 text-xs transition-colors cursor-pointer select-none disabled:opacity-50",
                    isPixelTheme
                      ? "rounded-xs border border-border bg-muted hover:bg-accent text-foreground font-mono shadow-[1px_1px_0px_#000]"
                      : "rounded border border-border bg-transparent text-foreground hover:bg-muted active:bg-muted/80"
                  )}
                >
                  {cancelText}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleOk}
                  className={cn(
                    "inline-flex items-center justify-center gap-1 h-6 px-2.5 text-xs font-medium text-white transition-colors cursor-pointer select-none disabled:opacity-50",
                    isPixelTheme ? "rounded-xs font-mono shadow-[1px_1px_0px_#000]" : "rounded shadow-xs",
                    okType === "danger"
                      ? isPixelTheme
                        ? "bg-red-600 hover:bg-red-700 active:bg-red-800 border border-red-950 text-white font-bold"
                        : "bg-[#f53f3f] hover:bg-[#e03535] active:bg-[#cb2727] dark:bg-[#f76560] dark:hover:bg-[#f53f3f]"
                      : isPixelTheme
                        ? "bg-amber-500 hover:bg-amber-600 active:bg-amber-700 border border-amber-900 text-amber-950 font-bold"
                        : "bg-[#165dff] hover:bg-[#0e42d2] active:bg-[#0935b5] dark:bg-[#3c7eff] dark:hover:bg-[#165dff]"
                  )}
                >
                  {loading && <LoaderCircle size={12} className="animate-spin shrink-0" />}
                  <span>{okText}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
