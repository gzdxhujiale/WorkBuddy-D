import React, { useState, useRef, useMemo } from "react";
import { Plus, FolderKanban, Check, ChevronDown, AlertCircle, X } from "lucide-react";
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
  const stages = useMemo(() => projectsData?.stages ?? [], [projectsData]);

  const [title, setTitle] = useState("");
  const [selectedQuadrant, setSelectedQuadrant] = useState<QuadrantType>(defaultQuadrant);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProjectStageId, setSelectedProjectStageId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeQuadrant = QUADRANT_OPTIONS.find((q) => q.type === selectedQuadrant) || QUADRANT_OPTIONS[1];
  const activeProject = useMemo(
    () => (selectedProjectId ? projects.find((p) => p.id === selectedProjectId) : null),
    [projects, selectedProjectId]
  );
  const activeStage = useMemo(
    () =>
      selectedProjectId && selectedProjectStageId
        ? stages.find((s) => s.id === selectedProjectStageId && s.projectId === selectedProjectId)
        : null,
    [stages, selectedProjectId, selectedProjectStageId]
  );

  const projectButtonLabel = useMemo(() => {
    if (!selectedProjectId) return "项目";
    if (activeProject && activeStage) return `${activeProject.name} · ${activeStage.name}`;
    if (activeProject) return `${activeProject.name} · 未选阶段`;
    return "项目";
  }, [selectedProjectId, activeProject, activeStage]);

  const handleSubmit = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || isSubmitting) return;

    // 选择项目时必须指定具体活动阶段
    if (selectedProjectId) {
      if (!activeProject) {
        setValidationError("所选项目不存在或已被删除，请重新选择");
        return;
      }
      if (!selectedProjectStageId || !activeStage) {
        setValidationError("选择项目时必须指定具体阶段，请选择阶段后再提交");
        return;
      }
    }

    setValidationError(null);

    try {
      setIsSubmitting(true);
      const today = todayYMD();
      const todayEndAt = new Date(`${today}T23:59:59`).getTime();

      addTask(trimmedTitle, selectedQuadrant, {
        scheduleMode: "point",
        scheduledEndAt: todayEndAt,
        projectId: selectedProjectId || undefined,
        projectStageId: (selectedProjectId && selectedProjectStageId) || undefined,
      });

      setTitle("");
      onTaskCreated?.();
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : "创建任务失败，请稍后重试");
    } finally {
      setIsSubmitting(false);
      inputRef.current?.focus();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    if (validationError) {
      setValidationError(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      if (validationError) {
        setValidationError(null);
      }
      if (title) {
        setTitle("");
      }
      inputRef.current?.blur();
    }
  };

  return (
    <div className="flex flex-col gap-1.5 w-full">
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
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="⚡ 快速记录今日待办，按 Enter 提交..."
          aria-label="快速记录今日待办"
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

        {/* Project & Stage Selector Pill */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 text-xs transition-colors cursor-pointer shrink-0 select-none max-w-[180px]",
              selectedProjectId && activeProject && activeStage
                ? isPixelTheme
                  ? "bg-sky-100/90 text-sky-900 border border-sky-800/60 font-bold dark:bg-sky-950/80 dark:text-sky-300 shadow-[1px_1px_0px_#000] rounded-xs"
                  : "bg-primary/10 text-primary border border-primary/30 dark:bg-primary/20 dark:border-primary/40 font-medium rounded-lg"
                : selectedProjectId && activeProject && !activeStage
                ? isPixelTheme
                  ? "bg-amber-100 text-amber-900 border border-amber-600 font-bold dark:bg-amber-950/80 dark:text-amber-300 shadow-[1px_1px_0px_#000] rounded-xs"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-300 dark:border-amber-700 font-medium rounded-lg"
                : isPixelTheme
                ? "bg-muted/40 text-muted-foreground hover:text-foreground border border-border rounded-xs shadow-[1px_1px_0px_#000]"
                : "bg-muted/40 text-muted-foreground hover:text-foreground border border-border hover:bg-muted/60 rounded-lg"
            )}
            title={
              activeProject && activeStage
                ? `所属项目：${activeProject.name} · ${activeStage.name}`
                : activeProject
                ? `所属项目：${activeProject.name} (未选择阶段)`
                : "关联项目与阶段 (可选)"
            }
          >
            <FolderKanban
              className={cn(
                "size-3.5 shrink-0",
                activeProject ? "text-sky-500" : "text-muted-foreground"
              )}
            />
            <span className="truncate">{projectButtonLabel}</span>
            <ChevronDown className="size-3 opacity-60 shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 p-1.5 max-h-80 overflow-y-auto">
            <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground select-none">
              所属项目与阶段 (可选)
            </div>

            {/* 不关联项目选项 */}
            <DropdownMenuItem
              onClick={() => {
                setSelectedProjectId(null);
                setSelectedProjectStageId(null);
                setValidationError(null);
              }}
              className={cn(
                "flex items-center justify-between gap-2 px-2 py-1.5 my-0.5",
                !selectedProjectId && "bg-muted font-semibold"
              )}
            >
              <span className="text-muted-foreground text-xs">不关联项目 (独立待办)</span>
              {!selectedProjectId && <Check className="size-3.5 text-primary shrink-0" />}
            </DropdownMenuItem>

            {projects.length > 0 && <DropdownMenuSeparator className="my-1" />}

            {projects.map((p) => {
              const isCurrentProject = selectedProjectId === p.id;
              const pStages = stages
                .filter((s) => s.projectId === p.id)
                .sort((a, b) => a.sortOrder - b.sortOrder);
              const hasStages = pStages.length > 0;

              return (
                <div key={p.id} className="space-y-0.5 my-1">
                  {/* 项目标题栏 */}
                  <div
                    className={cn(
                      "flex items-center justify-between gap-1.5 px-2 py-1 text-[11px] font-semibold select-none",
                      isCurrentProject ? "text-primary font-bold" : "text-muted-foreground"
                    )}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <FolderKanban className="size-3.5 text-sky-500 shrink-0" />
                      <span className="truncate">{p.name}</span>
                    </div>
                    {!hasStages && (
                      <span className="text-[10px] text-muted-foreground/70 font-normal shrink-0">
                        (暂无阶段)
                      </span>
                    )}
                  </div>

                  {/* 阶段列表 */}
                  {hasStages && (
                    <div className="pl-3.5 pr-1 space-y-0.5 border-l-2 border-border/60 ml-2.5 my-0.5">
                      {pStages.map((stg) => {
                        const isStageSelected =
                          isCurrentProject && selectedProjectStageId === stg.id;
                        return (
                          <DropdownMenuItem
                            key={stg.id}
                            onClick={() => {
                              setSelectedProjectId(p.id);
                              setSelectedProjectStageId(stg.id);
                              setValidationError(null);
                            }}
                            className={cn(
                              "w-full flex items-center justify-between gap-1.5 px-2 py-1 text-xs text-left cursor-pointer transition-colors",
                              isPixelTheme ? "rounded-xs" : "rounded-md",
                              isStageSelected
                                ? isPixelTheme
                                  ? "bg-muted font-bold text-foreground border border-border/80"
                                  : "bg-accent font-semibold text-foreground"
                                : "text-foreground hover:bg-muted"
                            )}
                          >
                            <span className="truncate">{stg.name}</span>
                            {isStageSelected && (
                              <Check className="size-3 text-primary shrink-0" />
                            )}
                          </DropdownMenuItem>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Submit Button */}
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
            aria-label="添加今日待办"
          >
            <Plus className="size-4" />
          </button>
        )}
      </div>

      {/* Validation Error Inline Alert */}
      {validationError && (
        <div
          role="alert"
          className={cn(
            "flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-amber-800 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/80 animate-in fade-in slide-in-from-top-1 duration-150",
            isPixelTheme
              ? "rounded-none border-2 shadow-[2px_2px_0px_#000] font-mono"
              : "rounded-lg"
          )}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <AlertCircle className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="truncate">{validationError}</span>
          </div>
          <button
            type="button"
            onClick={() => setValidationError(null)}
            className="text-muted-foreground hover:text-foreground cursor-pointer p-0.5 shrink-0"
            title="关闭提示"
            aria-label="关闭提示"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
