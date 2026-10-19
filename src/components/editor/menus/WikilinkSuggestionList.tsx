import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import type { NoteWikilinkItem } from "../types";
import { cn } from "@/lib/utils";

export interface WikilinkSuggestionListProps {
  items: NoteWikilinkItem[];
  command: (item: NoteWikilinkItem) => void;
  isPixelTheme?: boolean;
}

export interface WikilinkSuggestionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const WikilinkSuggestionList = forwardRef<
  WikilinkSuggestionListRef,
  WikilinkSuggestionListProps
>(({ items, command, isPixelTheme }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((prev) => (prev + 1) % items.length);
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        const item = items[selectedIndex];
        if (item) {
          command(item);
          return true;
        }
        return false;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div
        className={cn(
          "z-50 min-w-[200px] max-w-[280px] rounded-lg border border-border bg-popover p-2 text-xs text-muted-foreground shadow-md",
          isPixelTheme && "font-mono border-2 border-border/90 rounded-xs shadow-[2px_2px_0px_#000]"
        )}
      >
        未找到匹配的笔记
      </div>
    );
  }

  return (
    <div
      className={cn(
        "z-50 max-h-56 min-w-[220px] max-w-[320px] overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-md select-none",
        isPixelTheme && "font-mono border-2 border-border/90 rounded-xs shadow-[2px_2px_0px_#000]"
      )}
    >
      <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">
        关联知识库笔记
      </div>
      {items.map((item, index) => {
        const isSelected = index === selectedIndex;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => command(item)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
              isSelected
                ? isPixelTheme
                  ? "bg-amber-200/90 text-amber-950 dark:bg-amber-900/80 dark:text-amber-100 font-bold"
                  : "bg-accent text-accent-foreground font-medium"
                : "text-foreground hover:bg-muted"
            )}
          >
            <span className="shrink-0 text-muted-foreground">📄</span>
            <span className="truncate">{item.title || "未命名笔记"}</span>
          </button>
        );
      })}
    </div>
  );
});

WikilinkSuggestionList.displayName = "WikilinkSuggestionList";
