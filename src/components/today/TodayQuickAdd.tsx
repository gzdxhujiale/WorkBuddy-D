import React, { useState, useRef, useMemo } from "react";
import { Plus, FolderKanban, Check, ChevronDown } from "lucide-react";
import { QuadrantType } from "@/types/timeManagement";
import { useTaskActions } from "@/hooks/useTimeManagement";
import { useProjectsData } from "@/hooks/useProjects";
import { todayYMD } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface TodayQuickAddProps {
  className?: string;
  defaultQuadrant?: QuadrantType;
  onTaskCreated?: () => void;
}

const QUADRANT_OPTIONS: Array<{
  type: QuadrantType;
  title: string;
  desc: string;
  shortLabel: string;
  icon: string;
  bgClass: string;
}> = [
  {
    type: "Q1",
    title: "紧急讨伐",
    desc: "重要且紧急",
    shortLabel: "🔥 紧急讨伐",
    icon: "🔥",
    bgClass: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/60",
  },
  {
    type: "Q2",
    title: "核心修炼",
    desc: "重要不紧急",
    shortLabel: "🌿 核心修炼",
    icon: "🌿",
    bgClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60",
  },
  {
    type: "Q3",
    title: "突发委托",
    desc: "紧急不重要",
    shortLabel: "⚡ 突发委托",
    icon: "⚡",
    bgClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60",
  },
  {
    type: "Q4",
    title: "支线见闻",
    desc: "不重要不紧急",
    shortLabel: "💧 支线见闻",
    icon: "💧",
    bgClass: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  },
];

export const TodayQuickAdd: React.FC<TodayQuickAddProps> = ({
  className,
  defaultQuadrant = "Q2",
  onTaskCreated,
}) => {
  const { isPixelTheme } = useAppThemeStyle();
  const { addTask } = useTaskActions();
  const { data: projectsData } = useProjectsData();
  const projects = useMemo(() => projectsData?.projects?.filter((p) => p.status !== "archived") ?? [], [projectsData]);

  const [title, setTitle] = useState("");
  const [selectedQuadrant, setSelectedQuadrant] = useState<QuadrantType>(defaultQuadrant);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeQuadrant = QUADRANT_OPTIONS.find((q) => q.type === selectedQuadrant) || QUADRANT_OPTIONS[1];
  const activeProject = projects.find((p) => p.id === selectedProjectId);

  const handleSubmit = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const today = todayYMD();
      const todayEndAt = new Date(`${today}T23:59:59`).getTime();

      addTask(trimmedTitle, selectedQuadrant, {
        scheduleMode: "point",
        scheduledEndAt: todayEndAt,
        projectId: selectedProjectId || undefined,
      });

      setTitle("");
      onTaskCreated?.();
    } finally {
      setIsSubmitting(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      setTitle("");
      inputRef.current?.blur();
    }
  };

  return (
    <div
      className={cn(
        "relative flex items-center gap-2 px-3 py-2 transition-all duration-200",
        "bg-card border border-border/80 text-card-foreground",
        isPixelTheme
          ? "rounded-none border-2 shadow-[2px_2px_0px_#000]"
          : "rounded-xl shadow-xs hover:border-border focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/10",
        className
      )}
    >
      {/* Quick Add Icon / Plus */}
      <div className="flex items-center justify-center size-6 shrink-0 text-muted-foreground">
        {isPixelTheme ? (
          <span className="font-mono text-xs text-primary font-bold">▶</span>
        ) : (
          <Plus className="size-4 text-primary" />
        )}
      </div>

      {/* Main Task Title Input */}
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="⚡ 快速记录今日待办，按 Enter 提交..."
        className={cn(
          "flex-1 bg-transparent border-0 outline-hidden text-sm text-foreground placeholder:text-muted-foreground/60 min-w-[140px]",
          isPixelTheme && "font-mono"
        )}
      />

      {/* Quadrant Selector Pill */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border transition-colors cursor-pointer shrink-0 select-none",
            activeQuadrant.bgClass,
            isPixelTheme ? "rounded-xs shadow-[1px_1px_0px_#000]" : "rounded-lg"
          )}
          title="选择所属象限"
        >
          <span>{activeQuadrant.shortLabel}</span>
          <ChevronDown className="size-3 opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 p-1.5">
          <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground select-none">
            选择优先级象限
          </div>
          {QUADRANT_OPTIONS.map((q) => (
            <DropdownMenuItem
              key={q.type}
              onClick={() => setSelectedQuadrant(q.type)}
              className={cn(
                "flex items-center justify-between gap-2 px-2 py-1.5 my-0.5",
                selectedQuadrant === q.type && "bg-muted font-semibold"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{q.icon}</span>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-medium text-foreground">{q.title}</span>
                  <span className="text-[10px] text-muted-foreground">{q.desc}</span>
                </div>
              </div>
              {selectedQuadrant === q.type && (
                <Check className="size-3.5 text-primary shrink-0" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Project Selector Pill (Optional) */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 text-xs transition-colors cursor-pointer shrink-0 select-none",
            activeProject
              ? "bg-primary/10 text-primary border border-primary/30 dark:bg-primary/20 dark:border-primary/40 font-medium"
              : "bg-muted/40 text-muted-foreground hover:text-foreground border border-border hover:bg-muted/60",
            isPixelTheme ? "rounded-xs shadow-[1px_1px_0px_#000]" : "rounded-lg"
          )}
          title="关联项目 (可选)"
        >
          <FolderKanban className={cn("size-3.5", activeProject ? "text-primary" : "text-muted-foreground")} />
          <span className="max-w-[100px] truncate">
            {activeProject ? activeProject.name : "项目"}
          </span>
          <ChevronDown className="size-3 opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 p-1.5 max-h-64 overflow-y-auto">
          <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground select-none">
            所属项目 (可选)
          </div>
          <DropdownMenuItem
            onClick={() => setSelectedProjectId(null)}
            className={cn(
              "flex items-center justify-between gap-2 px-2 py-1.5 my-0.5",
              !selectedProjectId && "bg-muted font-semibold"
            )}
          >
            <span className="text-muted-foreground text-xs">不关联项目 (独立待办)</span>
            {!selectedProjectId && <Check className="size-3.5 text-primary shrink-0" />}
          </DropdownMenuItem>

          {projects.length > 0 && <DropdownMenuSeparator className="my-1" />}

          {projects.map((p) => (
            <DropdownMenuItem
              key={p.id}
              onClick={() => setSelectedProjectId(p.id)}
              className={cn(
                "flex items-center justify-between gap-2 px-2 py-1.5 my-0.5",
                selectedProjectId === p.id && "bg-muted font-semibold"
              )}
            >
              <div className="flex items-center gap-2 truncate">
                <FolderKanban className="size-3.5 text-sky-500 shrink-0" />
                <span className="truncate text-xs text-foreground">{p.name}</span>
              </div>
              {selectedProjectId === p.id && (
                <Check className="size-3.5 text-primary shrink-0" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Submit Button (Accessible for clickers) */}
      {title.trim() && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className={cn(
            "flex items-center justify-center size-7 shrink-0 text-xs font-medium cursor-pointer transition-all",
            "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95",
            isPixelTheme ? "rounded-none shadow-[1px_1px_0px_#000]" : "rounded-lg shadow-xs"
          )}
          title="添加今日待办 (Enter)"
        >
          <Plus className="size-4" />
        </button>
      )}
    </div>
  );
};
