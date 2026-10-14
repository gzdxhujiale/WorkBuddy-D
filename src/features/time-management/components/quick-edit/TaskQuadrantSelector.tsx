import { Flag, Check } from "lucide-react";
import type { QuadrantType } from "../../types";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";

export const QUADRANT_META: Record<
  QuadrantType,
  { name: string; pixelName: string; color: string; priority: "urgent" | "high" | "medium" | "low" }
> = {
  Q1: { name: "重要且紧急", pixelName: "🔥 紧急讨伐", color: "#d32f2f", priority: "urgent" },
  Q2: { name: "重要不紧急", pixelName: "🌿 核心修炼", color: "#25845a", priority: "high" },
  Q3: { name: "紧急不重要", pixelName: "⚡ 突发委托", color: "#d97706", priority: "medium" },
  Q4: { name: "不重要不紧急", pixelName: "💧 支线见闻", color: "#697381", priority: "low" },
};

export interface TaskQuadrantSelectorProps {
  selectedQuadrant: QuadrantType;
  onSelectQuadrant: (quadrant: QuadrantType) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean | ((prev: boolean) => boolean)) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  menuRef: React.RefObject<HTMLDivElement | null>;
}

export function TaskQuadrantSelector({
  selectedQuadrant,
  onSelectQuadrant,
  isOpen,
  onOpenChange,
  triggerRef,
  menuRef,
}: TaskQuadrantSelectorProps) {
  const { isPixelTheme } = useAppThemeStyle();
  const meta = QUADRANT_META[selectedQuadrant];

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => onOpenChange((v) => !v)}
        className={`p-1 flex-shrink-0 grid place-items-center cursor-pointer transition-colors ${
          isPixelTheme
            ? "rounded-xs border border-border/60 bg-muted/40 hover:bg-muted shadow-[1px_1px_0px_#000]"
            : "rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
        }`}
        title={`优先级 / 所属象限：${isPixelTheme ? meta.pixelName : meta.name} (点击修改)`}
        aria-label={`优先级 / 所属象限：${meta.name}`}
        style={{ color: meta.color }}
      >
        <Flag size={17} fill="currentColor" />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className={`absolute right-0 top-full mt-1.5 z-50 min-w-44 p-1 shadow-xl animate-in fade-in zoom-in-95 ${
            isPixelTheme
              ? "bg-card border-2 border-border rounded-xs shadow-[3px_3px_0px_#000] font-mono"
              : "bg-popover border border-border rounded-xl shadow-lg"
          }`}
        >
          <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground">
            修改优先级 / 象限
          </div>
          {(["Q1", "Q2", "Q3", "Q4"] as QuadrantType[]).map((q) => {
            const qMeta = QUADRANT_META[q];
            const isSelected = selectedQuadrant === q;
            return (
              <button
                key={q}
                type="button"
                onClick={() => {
                  onSelectQuadrant(q);
                  onOpenChange(false);
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left cursor-pointer transition-colors ${
                  isPixelTheme ? "rounded-xs" : "rounded-lg"
                } ${
                  isSelected
                    ? isPixelTheme
                      ? "bg-muted font-bold text-foreground border border-border/60"
                      : "bg-accent font-semibold text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Flag size={14} fill="currentColor" style={{ color: qMeta.color }} />
                <span className="flex-1 truncate">
                  {isPixelTheme ? qMeta.pixelName : qMeta.name}
                </span>
                {isSelected && <Check size={12} className="text-foreground shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
