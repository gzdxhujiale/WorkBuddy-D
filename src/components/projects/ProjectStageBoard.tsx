import React, { useState, memo, useMemo } from "react";
import {
  Plus,
  CheckCircle2,
  Circle,
  AlignLeft,
  X,
  ChevronDown,
  ChevronRight,
  Check,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-picker";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { hasTaskDescription } from "@/lib/taskDescription";
import { openQuickEditWindow } from "@/services/quickEditWindow";
import { createTaskId } from "@/lib/entityIds";
import { PixelScroll } from "@/components/pixel/PixelIcons";
import type { ProjectStage, ProjectTask } from "@/types/projects";
import type { Task } from "@/types/timeManagement";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const getPixelGroupTitle = (group: string): string => {
  switch (group) {
    case "已过期":
      return "💀 逾期讨伐";
    case "一天内":
      return "⏳ 24H迫近";
    case "三天内":
      return "⚔️ 三日攻坚";
    case "一周内":
      return "📜 本周排期";
    case "一周外":
      return "🗺️ 远期探索";
    case "无日期":
      return "📦 待定委托";
    default:
      return group;
  }
};

interface CollapsibleGroupProps {
  title: string;
  count: number;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  isExpired?: boolean;
}

const CollapsibleGroup: React.FC<CollapsibleGroupProps> = memo(
  ({ title, count, children, defaultExpanded = true, isExpired = false }) => {
    const { isPixelTheme } = useAppThemeStyle();
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    if (count === 0) return null;

    return (
      <div className="mb-2 select-none">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-label={`${title}分组`}
          className="flex items-center gap-1.5 py-1 text-xs transition-colors w-full text-left font-medium cursor-pointer"
        >
          {isExpanded ? (
            <ChevronDown size={14} className="text-muted-foreground" />
          ) : (
            <ChevronRight size={14} className="text-muted-foreground" />
          )}
          <span
            className={
              isExpired
                ? "text-red-600 dark:text-red-400 font-semibold"
                : isPixelTheme
                  ? "text-muted-foreground hover:text-foreground font-semibold font-mono"
                  : "text-muted-foreground hover:text-foreground font-medium"
            }
          >
            {isPixelTheme ? getPixelGroupTitle(title) : title}
          </span>
          <span
            className={`px-1.5 py-0.5 text-[10px] font-semibold ${
              isPixelTheme
                ? "rounded-xs font-mono border border-border/80 shadow-[1px_1px_0px_#000]"
                : "rounded-full"
            } ${
              isExpired
                ? isPixelTheme
                  ? "bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border-red-800"
                  : "bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {count}
          </span>
        </button>

        {isExpanded && (
          <div className="flex flex-col gap-1.5 pl-2 mt-1">{children}</div>
        )}
      </div>
    );
  }
);

interface StageThemeConfig {
  accentBorder: string;
  bgGradient: string;
  badgeBgClass: string;
  textClass: string;
  iconTextClass: string;
}

const STAGE_THEME_PALETTE: StageThemeConfig[] = [
  {
    accentBorder: "border-t-4 border-t-emerald-500",
    bgGradient: "bg-gradient-to-b from-emerald-500/5 via-transparent to-transparent",
    badgeBgClass: "bg-emerald-500",
    textClass: "text-emerald-600 dark:text-emerald-400",
    iconTextClass: "text-emerald-500",
  },
  {
    accentBorder: "border-t-4 border-t-teal-500",
    bgGradient: "bg-gradient-to-b from-teal-500/5 via-transparent to-transparent",
    badgeBgClass: "bg-teal-500",
    textClass: "text-teal-600 dark:text-teal-400",
    iconTextClass: "text-teal-500",
  },
  {
    accentBorder: "border-t-4 border-t-cyan-500",
    bgGradient: "bg-gradient-to-b from-cyan-500/5 via-transparent to-transparent",
    badgeBgClass: "bg-cyan-500",
    textClass: "text-cyan-600 dark:text-cyan-400",
    iconTextClass: "text-cyan-500",
  },
  {
    accentBorder: "border-t-4 border-t-blue-500",
    bgGradient: "bg-gradient-to-b from-blue-500/5 via-transparent to-transparent",
    badgeBgClass: "bg-blue-500",
    textClass: "text-blue-600 dark:text-blue-400",
    iconTextClass: "text-blue-500",
  },
  {
    accentBorder: "border-t-4 border-t-indigo-500",
    bgGradient: "bg-gradient-to-b from-indigo-500/5 via-transparent to-transparent",
    badgeBgClass: "bg-indigo-500",
    textClass: "text-indigo-600 dark:text-indigo-400",
    iconTextClass: "text-indigo-500",
  },
  {
    accentBorder: "border-t-4 border-t-amber-500",
    bgGradient: "bg-gradient-to-b from-amber-500/5 via-transparent to-transparent",
    badgeBgClass: "bg-amber-500",
    textClass: "text-amber-600 dark:text-amber-400",
    iconTextClass: "text-amber-500",
  },
];

interface Props {
  stages: ProjectStage[];
  tasks: ProjectTask[];
  disabled?: boolean;
  onCreateStage: (name: string) => Promise<void>;
  onSaveStage: (stage: ProjectStage) => Promise<void>;
  onDeleteStage: (stage: ProjectStage) => Promise<void>;
  onSaveTask: (task: Task) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
}

interface StageQuadrantBoxProps {
  stage: ProjectStage;
  stageIndex: number;
  tasks: ProjectTask[];
  disabled?: boolean;
  onSaveStage: (stage: ProjectStage) => Promise<void>;
  onDeleteStage: (stage: ProjectStage) => Promise<void>;
  onSaveTask: (task: Task) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
}

const StageQuadrantBox: React.FC<StageQuadrantBoxProps> = ({
  stage,
  stageIndex,
  tasks,
  disabled,
  onSaveStage,
  onDeleteStage,
  onSaveTask,
  onDeleteTask,
}) => {
  const { isPixelTheme } = useAppThemeStyle();
  const [expanded, setExpanded] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(stage.name);

  const theme = STAGE_THEME_PALETTE[stageIndex % STAGE_THEME_PALETTE.length];

  const handleCreateTask = (anchorEl: HTMLElement) => {
    void openQuickEditWindow({
      anchorEl,
      quadrant: "Q2",
      onCreate: (_quadrant, draftData) => {
        void onSaveTask({
          id: createTaskId(),
          title: draftData.title,
          description: draftData.description,
          quadrant: draftData.quadrant || "Q2",
          priority:
            draftData.priority ||
            (draftData.quadrant === "Q1"
              ? "urgent"
              : draftData.quadrant === "Q3"
                ? "medium"
                : draftData.quadrant === "Q4"
                  ? "low"
                  : "high"),
          completed: false,
          projectId: stage.projectId,
          projectStageId: stage.id,
          scheduleMode: draftData.scheduleMode,
          scheduledStartAt: draftData.scheduledStartAt,
          scheduledEndAt: draftData.scheduledEndAt,
          reminder: draftData.reminder,
          assigneeName: stage.defaultAssigneeName,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      },
      onClosed: () => {},
    });
  };

  const handleOpenEditTask = (task: ProjectTask, e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    void openQuickEditWindow({
      task,
      anchorEl: e.currentTarget,
      onCommit: (taskId, updates) => {
        void onSaveTask({
          ...task,
          ...updates,
          id: taskId,
        });
      },
      onClosed: () => {},
    });
  };

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.completed === b.completed) return b.createdAt - a.createdAt;
      return a.completed ? 1 : -1;
    });
  }, [tasks]);

  const now = Date.now();
  const expired: ProjectTask[] = [];
  const noDate: ProjectTask[] = [];
  const within1Day: ProjectTask[] = [];
  const within3Days: ProjectTask[] = [];
  const within1Week: ProjectTask[] = [];
  const beyond1Week: ProjectTask[] = [];

  sortedTasks.forEach((t) => {
    if (!t.scheduledEndAt) {
      noDate.push(t);
    } else if (t.scheduledEndAt < now && !t.completed) {
      expired.push(t);
    } else {
      const diffDays = (t.scheduledEndAt - now) / MS_PER_DAY;
      if (diffDays <= 1) within1Day.push(t);
      else if (diffDays <= 3) within3Days.push(t);
      else if (diffDays <= 7) within1Week.push(t);
      else beyond1Week.push(t);
    }
  });

  const renderTaskList = (list: ProjectTask[]) => {
    return list.map((task) => {
      const hasContent = hasTaskDescription(task.description);
      const isExpired =
        Boolean(task.scheduledEndAt) && (task.scheduledEndAt ?? 0) < now && !task.completed;

      return (
        <div
          key={task.id}
          onClick={(e) => handleOpenEditTask(task, e)}
          className={`group flex items-center justify-between transition-all cursor-pointer select-none ${
            isPixelTheme
              ? "px-3 py-2 rounded-xs border-2 border-border/80 bg-card hover:bg-amber-100/60 dark:hover:bg-amber-950/40 shadow-[2px_2px_0px_rgba(0,0,0,0.06)] hover:shadow-[3px_3px_0px_rgba(217,119,6,0.25)] hover:-translate-x-0.5 hover:-translate-y-0.5 font-mono text-foreground"
              : "px-2.5 py-1.5 rounded-lg border-b border-slate-200/50 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 hover:bg-slate-100/80 dark:hover:bg-slate-800/80"
          } ${
            task.completed
              ? isPixelTheme
                ? "opacity-60 line-through bg-muted/40"
                : "opacity-60 line-through"
              : ""
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              type="button"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                void onSaveTask({ ...task, completed: !task.completed });
              }}
              className={`flex-shrink-0 cursor-pointer transition-all ${
                isPixelTheme
                  ? `size-4 rounded-xs flex items-center justify-center ${
                      task.completed
                        ? "bg-emerald-600 text-white border border-emerald-800 shadow-[1px_1px_0px_#064e3b]"
                        : "border-2 border-amber-900/60 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 hover:border-emerald-500 shadow-[1px_1px_0px_#000]"
                    }`
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              }`}
            >
              {isPixelTheme ? (
                task.completed && <Check size={11} className="stroke-[3]" />
              ) : task.completed ? (
                <CheckCircle2 size={16} className={theme.iconTextClass} />
              ) : (
                <Circle size={16} />
              )}
            </button>

            <span
              className={`text-xs font-medium truncate ${
                task.completed ? "line-through text-muted-foreground" : ""
              } ${
                isPixelTheme ? "font-mono text-foreground font-bold" : "text-slate-800 dark:text-slate-200"
              }`}
            >
              {task.title}
            </span>

            {isExpired && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const today = new Date();
                  today.setHours(23, 59, 59, 999);
                  void onSaveTask({
                    ...task,
                    scheduleMode: "point",
                    scheduledStartAt: undefined,
                    scheduledEndAt: today.getTime(),
                  });
                }}
                title="点击延期至今日"
                className={`text-[10px] font-medium flex-shrink-0 transition-colors cursor-pointer group/tag ${
                  isPixelTheme
                    ? "rounded-xs border-2 border-red-800 bg-red-100/90 dark:bg-red-950/70 text-red-700 dark:text-red-300 font-mono px-1.5 py-0.5 shadow-[1px_1px_0px_#7f1d1d] hover:bg-red-600 hover:text-white"
                    : "rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-600 px-1.5 py-0.5 hover:bg-red-600 hover:text-white"
                }`}
              >
                <span className="group-hover/tag:hidden">已过期</span>
                <span className="hidden group-hover/tag:inline">延期</span>
              </button>
            )}
          </div>

          <div className="flex items-center justify-end flex-shrink-0 ml-2 size-6">
            {hasContent ? (
              <span
                title="包含任务详情"
                className="flex items-center justify-center size-6 text-muted-foreground group-hover:hidden transition-all"
              >
                <AlignLeft size={13} />
              </span>
            ) : (
              <span
                aria-hidden="true"
                className="size-6 invisible group-hover:hidden pointer-events-none"
              />
            )}
            <Button
              variant="ghost"
              size="icon"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                void onDeleteTask(task.id);
              }}
              className={`hidden group-hover:flex h-6 w-6 cursor-pointer ${
                isPixelTheme
                  ? "rounded-xs border-2 border-border/80 bg-muted hover:bg-red-600 hover:text-white text-muted-foreground shadow-[1px_1px_0px_#000]"
                  : "text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
              }`}
              title="删除任务"
            >
              <X size={14} />
            </Button>
          </div>
        </div>
      );
    });
  };

  return (
    <div
      className={`flex flex-col w-full ${
        isPixelTheme
          ? "rounded-xs border-2 border-border/90 bg-card shadow-[4px_4px_0px_rgba(0,0,0,0.12)] font-mono"
          : "rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs"
      } ${theme.accentBorder} ${theme.bgGradient} overflow-hidden select-none`}
    >
      {/* Stage Header */}
      <div className={`flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 border-b ${isPixelTheme ? "border-b-2 border-border/70" : "border-border/60"}`}>
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "收起阶段" : "展开阶段"}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
          >
            <ChevronDown
              size={15}
              className={`transition-transform duration-200 ${expanded ? "" : "-rotate-90"}`}
            />
          </button>
          <span
            className={`size-5 ${
              isPixelTheme
                ? "rounded-xs font-mono font-black border border-black/40 shadow-[1px_1px_0px_#000]"
                : "rounded-full font-bold"
            } text-white text-xs flex items-center justify-center shadow-xs ${theme.badgeBgClass}`}
          >
            {stageIndex + 1}
          </span>
          {editingTitle ? (
            <input
              value={titleValue}
              autoFocus
              disabled={disabled}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={() => {
                setEditingTitle(false);
                const next = titleValue.trim();
                if (next && next !== stage.name) {
                  void onSaveStage({ ...stage, name: next });
                } else {
                  setTitleValue(stage.name);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                } else if (e.key === "Escape") {
                  setTitleValue(stage.name);
                  setEditingTitle(false);
                }
              }}
              className="h-6 rounded border border-border bg-background px-1.5 text-xs font-bold outline-none"
            />
          ) : (
            <h3
              onClick={() => {
                if (!disabled) setEditingTitle(true);
              }}
              title="点击修改阶段名称"
              className={`text-sm font-bold truncate max-w-[200px] sm:max-w-xs cursor-pointer hover:underline ${theme.textClass} ${
                isPixelTheme ? "font-mono" : ""
              }`}
            >
              {stage.name}
            </h3>
          )}
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
            {tasks.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="w-36 sm:w-44">
            <DateRangePicker
              size="mini"
              value={[stage.startDate ?? null, stage.endDate ?? null]}
              disabled={disabled}
              placeholder={["开始日期", "结束日期"]}
              onChange={(dates) => {
                void onSaveStage({
                  ...stage,
                  startDate: dates[0] || undefined,
                  endDate: dates[1] || undefined,
                });
              }}
            />
          </div>

          <Button
            variant="ghost"
            size="icon"
            disabled={disabled}
            onClick={() => void onDeleteStage(stage)}
            className={`h-7 w-7 cursor-pointer ${
              isPixelTheme
                ? "rounded-xs border border-border/80 bg-muted hover:bg-destructive hover:text-white text-muted-foreground shadow-[1px_1px_0px_#000]"
                : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            }`}
            title={`删除阶段“${stage.name}”`}
          >
            <Trash2 size={14} />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            disabled={disabled}
            onClick={(e) => handleCreateTask(e.currentTarget)}
            className={
              isPixelTheme
                ? "h-7 w-7 rounded-xs border-2 border-border bg-muted hover:bg-card text-foreground shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
                : "h-7 w-7 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 cursor-pointer"
            }
            title="使用任务编辑窗口新建"
          >
            <Plus size={16} strokeWidth={isPixelTheme ? 2.5 : 2} />
          </Button>
        </div>
      </div>

      {/* Task List / Grouped Content */}
      {expanded && (
        <>
          <div className="px-3.5 py-2.5 flex flex-col gap-1">
            {sortedTasks.length === 0 ? (
              <div
                onClick={(e) => handleCreateTask(e.currentTarget)}
                className={`py-6 flex flex-col items-center justify-center text-muted-foreground/60 hover:text-muted-foreground text-xs gap-1.5 cursor-pointer select-none transition-colors ${
                  isPixelTheme ? "font-mono" : ""
                }`}
                title="点击新建任务"
              >
                {isPixelTheme ? (
                  <PixelScroll size={24} className="opacity-60 mb-0.5" />
                ) : (
                  <span className="text-lg">✨</span>
                )}
                <span className={isPixelTheme ? "font-mono font-bold text-muted-foreground" : ""}>
                  {isPixelTheme ? "暂无阶段任务 · 点击添加" : "暂无阶段任务 · 点击添加"}
                </span>
              </div>
            ) : (
              <>
                {expired.length > 0 && (
                  <CollapsibleGroup title="已过期" count={expired.length} isExpired>
                    {renderTaskList(expired)}
                  </CollapsibleGroup>
                )}
                {within1Day.length > 0 && (
                  <CollapsibleGroup title="一天内" count={within1Day.length}>
                    {renderTaskList(within1Day)}
                  </CollapsibleGroup>
                )}
                {within3Days.length > 0 && (
                  <CollapsibleGroup title="三天内" count={within3Days.length}>
                    {renderTaskList(within3Days)}
                  </CollapsibleGroup>
                )}
                {within1Week.length > 0 && (
                  <CollapsibleGroup title="一周内" count={within1Week.length}>
                    {renderTaskList(within1Week)}
                  </CollapsibleGroup>
                )}
                {beyond1Week.length > 0 && (
                  <CollapsibleGroup title="一周外" count={beyond1Week.length}>
                    {renderTaskList(beyond1Week)}
                  </CollapsibleGroup>
                )}
                {noDate.length > 0 && (
                  <CollapsibleGroup title="无日期" count={noDate.length}>
                    {renderTaskList(noDate)}
                  </CollapsibleGroup>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export function ProjectStageBoard({
  stages,
  tasks,
  disabled,
  onCreateStage,
  onSaveStage,
  onDeleteStage,
  onSaveTask,
  onDeleteTask,
}: Props) {
  const { isPixelTheme } = useAppThemeStyle();

  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2
            className={`text-base font-bold text-foreground ${
              isPixelTheme ? "font-mono" : ""
            }`}
          >
            {isPixelTheme ? "⚔️ 阶段推进看板" : "流程阶段与任务看板"}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            每个阶段为一个任务象限卡片，支持设置阶段周期、任务时间段、详情备注与优先级。
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => void onCreateStage(`阶段 ${stages.length + 1}`)}
          className={`h-8 text-xs gap-1 cursor-pointer shrink-0 ${
            isPixelTheme
              ? "rounded-xs border-2 border-border shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] font-mono font-bold"
              : "rounded-lg hover:bg-accent"
          }`}
        >
          <Plus className="size-3.5" />
          添加阶段
        </Button>
      </div>

      {/* Vertical Stack of Stage Quadrant Cards */}
      <div className="flex flex-col gap-4">
        {stages.map((stage, index) => (
          <StageQuadrantBox
            key={stage.id}
            stage={stage}
            stageIndex={index}
            tasks={tasks.filter((task) => task.projectStageId === stage.id)}
            disabled={disabled}
            onSaveStage={onSaveStage}
            onDeleteStage={onDeleteStage}
            onSaveTask={onSaveTask}
            onDeleteTask={onDeleteTask}
          />
        ))}
      </div>

      {stages.length === 0 && (
        <div
          onClick={() => {
            if (!disabled) void onCreateStage(`阶段 1`);
          }}
          className={`p-8 text-center text-sm text-muted-foreground cursor-pointer hover:border-foreground/40 transition-colors ${
            isPixelTheme
              ? "rounded-xs font-mono border-2 border-dashed border-border/80 bg-amber-50/20 dark:bg-amber-950/10 shadow-[2px_2px_0px_rgba(0,0,0,0.06)]"
              : "rounded-2xl border border-dashed border-border"
          }`}
        >
          {isPixelTheme
            ? "⚔️ 暂无流程阶段，点击此处或右上角「添加阶段」开启征途。"
            : "暂无流程阶段，点击此处或右上角「添加阶段」新建。"}
        </div>
      )}
    </section>
  );
}
