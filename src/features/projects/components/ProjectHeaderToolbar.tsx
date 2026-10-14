import { useMemo } from "react";
import {
  Calendar,
  Flag,
  Tag,
  Trash2,
  Users,
  Kanban,
  Table as TableIcon,
  Activity,
  Archive,
  ArchiveRestore,
  MoreHorizontal,
  ChevronDown,
  Check,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-picker";
import { InputTag } from "@/components/ui/input-tag";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  PRIORITY_LABELS,
  getProjectComputedStatus,
  type Priority,
  type Project,
  type ProjectStage,
  type ProjectTask,
} from "@/types/project";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { formatDateYMD, todayYMD } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";

export type ProjectViewMode = "kanban" | "gantt" | "table";

export interface ProjectHeaderToolbarProps {
  project: Project;
  allTasks: ProjectTask[];
  stages: ProjectStage[];
  viewMode: ProjectViewMode;
  onViewModeChange: (mode: ProjectViewMode) => void;
  onSaveProject: (project: Project) => void;
  onDeleteProject: () => void;
  onAddStage?: () => void;
  busy?: boolean;
}

export function ProjectHeaderToolbar({
  project,
  allTasks,
  stages,
  viewMode,
  onViewModeChange,
  onSaveProject,
  onDeleteProject,
  onAddStage,
  busy,
}: ProjectHeaderToolbarProps) {
  const { isPixelTheme } = useAppThemeStyle();
  const todayStr = useMemo(() => todayYMD(), []);

  // Compute smart dynamic status
  const smartStatus = useMemo(() => {
    const projTasks = allTasks.filter((t) => t.projectId === project.id);
    const computedStatus = getProjectComputedStatus(project, projTasks);

    if (computedStatus === "archived") {
      return {
        label: "已归档",
        badgeClasses: isPixelTheme
          ? "rounded-xs bg-muted text-muted-foreground border border-border shadow-[1px_1px_0px_#000] font-mono"
          : "rounded-lg bg-muted/70 text-muted-foreground border border-border/70",
      };
    }

    if (computedStatus === "completed") {
      return {
        label: "已完成",
        badgeClasses: isPixelTheme
          ? "rounded-xs bg-emerald-500 text-emerald-950 border border-emerald-800 shadow-[1px_1px_0px_#064e3b] font-mono"
          : "rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300/70",
      };
    }

    const overdueTasks = projTasks.filter((t) => {
      if (t.completed) return false;
      const tTime = t.scheduledEndAt || t.scheduledStartAt;
      return Boolean(tTime && formatDateYMD(new Date(tTime)) < todayStr);
    });

    const isProjectOverdue = Boolean(project.endDate && project.endDate < todayStr);

    const approachingTasks = projTasks.filter((t) => {
      if (t.completed) return false;
      const tTime = t.scheduledEndAt || t.scheduledStartAt;
      if (!tTime) return false;
      const dStr = formatDateYMD(new Date(tTime));
      return dStr >= todayStr && (new Date(dStr).getTime() - new Date(todayStr).getTime()) / (24 * 3600 * 1000) <= 3;
    });

    const isProjectApproaching = Boolean(
      !isProjectOverdue &&
      project.endDate &&
      (new Date(project.endDate).getTime() - new Date(todayStr).getTime()) / (24 * 3600 * 1000) <= 3
    );

    if (overdueTasks.length > 0 || isProjectOverdue) {
      const count = overdueTasks.length > 0 ? overdueTasks.length : 1;
      return {
        label: `进行中 · 逾期（${count}）`,
        badgeClasses: isPixelTheme
          ? "rounded-xs bg-red-200 text-red-950 border border-red-800 shadow-[1px_1px_0px_#7f1d1d] font-mono"
          : "rounded-lg bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-300 border border-red-300/70",
      };
    }

    if (approachingTasks.length > 0 || isProjectApproaching) {
      const count = approachingTasks.length > 0 ? approachingTasks.length : 1;
      return {
        label: `进行中 · 临近预期（${count}）`,
        badgeClasses: isPixelTheme
          ? "rounded-xs bg-amber-200 text-amber-950 border border-amber-800 shadow-[1px_1px_0px_#000] font-mono"
          : "rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300/70",
      };
    }

    return {
      label: "进行中 · 正常推进",
      badgeClasses: isPixelTheme
        ? "rounded-xs bg-amber-400 text-amber-950 border border-amber-800 shadow-[1px_1px_0px_#000] font-mono"
        : "rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border border-amber-200/90 dark:border-amber-800/70",
    };
  }, [project, allTasks, todayStr, isPixelTheme]);

  const projectTasks = useMemo(() => allTasks.filter((t) => t.projectId === project.id), [allTasks, project.id]);

  return (
    <div className="space-y-3">
      {/* Header: Title & Status & Actions */}
      <div
        className={cn(
          "flex items-center justify-between gap-3 border-b pb-2.5",
          isPixelTheme ? "border-b-2 border-border/80 font-mono" : "border-border"
        )}
      >
        <div className="min-w-0 flex-1">
          <input
            key={`name-${project.id}`}
            defaultValue={project.name}
            onBlur={(event) => {
              const val = event.target.value.trim();
              if (val && val !== project.name) {
                onSaveProject({ ...project, name: val });
              }
            }}
            className={cn(
              "w-full bg-transparent px-1.5 py-0.5 text-base sm:text-lg font-bold text-foreground outline-none transition-colors",
              isPixelTheme
                ? "rounded-xs border-2 border-transparent hover:border-border/60 focus:border-amber-600 focus:bg-background font-mono"
                : "rounded-lg hover:bg-muted/40 focus:bg-background focus:ring-2 focus:ring-ring"
            )}
            aria-label="项目名称"
            placeholder="项目名称"
          />
        </div>

        {/* Status Badge & 3-Dots Dropdown Menu */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            className={cn(
              "inline-flex h-8 items-center justify-center px-3 text-xs font-semibold select-none shadow-2xs",
              smartStatus.badgeClasses
            )}
            title={`项目状态：${smartStatus.label}`}
          >
            <span>{smartStatus.label}</span>
          </div>

          {/* 3-dots Dropdown Menu (Archive & Delete) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={busy}
                className={cn(
                  "size-8 text-muted-foreground hover:text-foreground cursor-pointer shrink-0",
                  isPixelTheme && "rounded-xs border border-border bg-muted shadow-[1px_1px_0px_#000]"
                )}
                title="更多项目操作"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={cn("min-w-28", isPixelTheme && "font-mono border-2")}>
              <DropdownMenuItem
                onClick={() =>
                  onSaveProject({
                    ...project,
                    status: project.status === "archived" ? "not_started" : "archived",
                  })
                }
                className="gap-1.5 cursor-pointer"
              >
                {project.status === "archived" ? (
                  <>
                    <ArchiveRestore className="size-3.5 text-amber-600 shrink-0" />
                    <span>移出归档</span>
                  </>
                ) : (
                  <>
                    <Archive className="size-3.5 shrink-0" />
                    <span>归档项目</span>
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onClick={onDeleteProject} className="gap-1.5 cursor-pointer">
                <Trash2 className="size-3.5 shrink-0" />
                <span>删除项目</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Description */}
      <div>
        <textarea
          key={`desc-${project.id}`}
          defaultValue={project.description}
          onBlur={(event) => {
            const val = event.target.value;
            if (val !== (project.description ?? "")) {
              onSaveProject({ ...project, description: val || undefined });
            }
          }}
          placeholder="添加项目说明或目标描述…"
          rows={2}
          className={cn(
            "w-full resize-y bg-transparent p-2 text-xs leading-relaxed text-muted-foreground outline-none transition-colors",
            isPixelTheme
              ? "rounded-xs border-2 border-transparent hover:border-border/60 focus:border-amber-600 focus:bg-background focus:text-foreground font-mono"
              : "rounded-lg border border-transparent hover:border-border/60 focus:border-border focus:bg-background focus:text-foreground"
          )}
        />
      </div>

      {/* Properties Bar: 2-Column Grid */}
      <div
        className={cn(
          "grid grid-cols-1 gap-2.5 p-3 sm:grid-cols-2",
          isPixelTheme
            ? "rounded-xs border-2 border-border/90 bg-amber-50/40 dark:bg-amber-950/20 shadow-[2px_2px_0px_rgba(0,0,0,0.06)] font-mono"
            : "rounded-xl border border-border/80 bg-muted/20"
        )}
      >
        {/* Priority */}
        <div className="flex items-center gap-2">
          <Flag className="size-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground shrink-0">优先级</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={busy}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer select-none",
                  isPixelTheme
                    ? "rounded-xs border-2 border-border bg-muted/60 hover:bg-muted font-mono shadow-[1px_1px_0px_#000]"
                    : "rounded-lg border border-border/80 bg-background hover:bg-accent shadow-2xs text-foreground"
                )}
              >
                <span
                  className={cn(
                    "size-2 rounded-full shrink-0",
                    project.priority === "urgent"
                      ? "bg-rose-500"
                      : project.priority === "high"
                      ? "bg-amber-500"
                      : project.priority === "medium"
                      ? "bg-sky-500"
                      : "bg-slate-400"
                  )}
                />
                <span>{PRIORITY_LABELS[project.priority]}优先级</span>
                <ChevronDown className="size-3 opacity-60 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-36">
              {(Object.entries(PRIORITY_LABELS) as [Priority, string][]).map(([val, label]) => {
                const isSelected = project.priority === val;
                return (
                  <DropdownMenuItem
                    key={val}
                    onClick={() => onSaveProject({ ...project, priority: val })}
                    className={cn(
                      "justify-between cursor-pointer",
                      isSelected && (isPixelTheme ? "bg-accent font-bold" : "bg-accent font-semibold")
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-2 rounded-full shrink-0",
                          val === "urgent"
                            ? "bg-rose-500"
                            : val === "high"
                            ? "bg-amber-500"
                            : val === "medium"
                            ? "bg-sky-500"
                            : "bg-slate-400"
                        )}
                      />
                      <span>{label}优先级</span>
                    </div>
                    {isSelected && <Check size={12} className="text-foreground shrink-0 ml-1" />}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Owner */}
        <div className="flex items-center gap-2">
          <Users className="size-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground shrink-0">负责人</span>
          <input
            key={`owner-${project.id}`}
            defaultValue={project.ownerName ?? ""}
            placeholder="未指定"
            disabled={busy}
            onBlur={(event) => {
              const val = event.target.value.trim();
              if (val !== (project.ownerName ?? "")) {
                onSaveProject({ ...project, ownerName: val || undefined });
              }
            }}
            className={cn(
              "h-6.5 min-w-0 flex-1 bg-transparent px-1.5 text-xs text-foreground outline-none",
              isPixelTheme
                ? "rounded-xs border border-transparent hover:border-border focus:border-amber-600 focus:bg-background font-mono"
                : "rounded-md border border-transparent hover:border-border focus:border-border focus:bg-background"
            )}
          />
        </div>

        {/* Timeline */}
        <div className="flex items-center gap-2">
          <Calendar className="size-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground shrink-0">周期</span>
          <DateRangePicker
            size="mini"
            disabled={busy}
            value={
              project.startDate || project.endDate
                ? [project.startDate ?? "", project.endDate ?? ""]
                : undefined
            }
            placeholder={["开始日期", "结束日期"]}
            onChange={(dateStrings) => {
              const [start, end] = dateStrings;
              onSaveProject({
                ...project,
                startDate: start || undefined,
                endDate: end || undefined,
              });
            }}
            className="h-6.5 text-xs flex-1 max-w-[220px]"
          />
        </div>

        {/* Tags */}
        <div className="flex items-center gap-2 min-w-0">
          <Tag className="size-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground shrink-0">标签</span>
          <div className="flex-1 min-w-0">
            <InputTag
              size="mini"
              allowClear
              saveOnBlur
              disabled={busy}
              value={project.tags}
              placeholder={project.tags.length === 0 ? "输入标签后按回车..." : ""}
              onChange={(nextTags) => {
                onSaveProject({ ...project, tags: nextTags });
              }}
              className={cn(
                "w-full text-xs min-h-[26px]",
                isPixelTheme && "font-mono rounded-xs border-2 border-border"
              )}
            />
          </div>
        </div>
      </div>

      {/* Unified View Control Bar */}
      <div
        className={cn(
          "flex items-center justify-between gap-3 border-b pb-2 pt-1 select-none",
          isPixelTheme ? "border-b-2 border-border/80 font-mono" : "border-border/70"
        )}
      >
        {/* Left: View Tabs */}
        <div
          className={cn(
            "inline-flex items-center gap-1 p-0.5 rounded-lg border",
            isPixelTheme
              ? "rounded-xs border border-border bg-muted/60 font-mono shadow-[1px_1px_0px_#000]"
              : "border-border/60 bg-muted/40"
          )}
        >
          {[
            { mode: "kanban" as ProjectViewMode, label: "阶段看板", icon: Kanban },
            { mode: "gantt" as ProjectViewMode, label: "单体甘特", icon: Activity },
            { mode: "table" as ProjectViewMode, label: "紧凑表格", icon: TableIcon },
          ].map((v) => {
            const Icon = v.icon;
            const isActive = viewMode === v.mode;
            return (
              <button
                key={v.mode}
                type="button"
                onClick={() => onViewModeChange(v.mode)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer",
                  isActive
                    ? isPixelTheme
                      ? "rounded-xs bg-amber-500 text-amber-950 font-bold border border-amber-900 shadow-[1px_1px_0px_#000]"
                      : "rounded-md bg-background text-foreground shadow-2xs font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                <Icon size={13} />
                <span>{v.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right: Summary + View Context Action (Add Stage) */}
        <div className="flex items-center gap-3">
          <div className="text-xs text-muted-foreground font-medium hidden sm:flex items-center gap-1.5 select-none">
            <span>{stages.length} 个阶段</span>
            <span>•</span>
            <span>{projectTasks.length} 项任务</span>
          </div>

          {viewMode === "kanban" && onAddStage && (
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={onAddStage}
              className={cn(
                "h-7 px-2.5 text-xs gap-1 cursor-pointer shrink-0",
                isPixelTheme
                  ? "rounded-xs border border-border bg-amber-400 text-amber-950 shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] font-mono font-bold"
                  : "rounded-lg hover:bg-accent border border-border/80"
              )}
              variant="outline"
            >
              <Plus className="size-3.5" />
              <span>添加阶段</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
