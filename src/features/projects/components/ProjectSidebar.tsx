import { useMemo, useState, useDeferredValue } from "react";
import { Plus, Search, FolderKanban, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { PixelShield, PixelScroll } from "@/components/pixel/PixelIcons";
import { formatDateYMD, todayYMD } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import {
  PRIORITY_LABELS,
  getProjectComputedStatus,
  type Priority,
  type Project,
  type ProjectStatus,
  type ProjectTask,
} from "@/types/project";

export type SidebarStatusFilter = "all" | "in_progress" | "completed" | "archived";

const priorityClasses: Record<Priority, string> = {
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
  medium: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 border-sky-200 dark:border-sky-800",
  high: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  urgent: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800",
};

const PRIORITY_ORDER: Record<Priority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function ProgressRing({ completed, total, isPixelTheme }: { completed: number; total: number; isPixelTheme?: boolean }) {
  const percent = total ? Math.round((completed / total) * 100) : 0;
  if (isPixelTheme) {
    return (
      <div
        className="relative size-10 rounded-xs border-2 border-amber-900/60 dark:border-amber-600 bg-amber-100/90 dark:bg-amber-950/80 shadow-[1px_1px_0px_#000] text-[10px] font-mono font-black text-amber-950 dark:text-amber-100 flex flex-col items-center justify-center shrink-0 select-none"
        title={`任务完成率 ${percent}% (${completed}/${total})`}
      >
        <span>{percent}%</span>
      </div>
    );
  }
  return (
    <div
      className="relative grid size-11 place-items-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200 shrink-0"
      title={`任务完成率 ${percent}%`}
    >
      <span className="absolute inset-1 rounded-full bg-card" />
      <span className="relative">{percent}%</span>
    </div>
  );
}

export interface ProjectTaskMetrics {
  tasks: ProjectTask[];
  doneCount: number;
  overdueCount: number;
  approachingCount: number;
}

export interface ProjectSidebarProps {
  projects: Project[];
  allTasks: ProjectTask[];
  selectedId: string | undefined;
  onSelectProject: (id: string) => void;
  statusFilter: SidebarStatusFilter;
  onStatusFilterChange: (status: SidebarStatusFilter) => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  onCreateProject: () => void;
  onManageTemplates: () => void;
}

export function ProjectSidebar({
  projects,
  allTasks,
  selectedId,
  onSelectProject,
  statusFilter,
  onStatusFilterChange,
  searchQuery: searchQueryProp,
  onSearchQueryChange: onSearchQueryChangeProp,
  onCreateProject,
  onManageTemplates,
}: ProjectSidebarProps) {
  const { isPixelTheme } = useAppThemeStyle();
  const todayStr = useMemo(() => todayYMD(), []);

  // Localized search state with fallback to prop if controlled
  const [internalSearchQuery, setInternalSearchQuery] = useState("");
  const searchQuery = searchQueryProp !== undefined ? searchQueryProp : internalSearchQuery;
  const handleSearchQueryChange = (val: string) => {
    if (onSearchQueryChangeProp) {
      onSearchQueryChangeProp(val);
    } else {
      setInternalSearchQuery(val);
    }
  };
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const todayMidnightMs = useMemo(() => {
    const [y, m, d] = todayStr.split("-").map(Number);
    return new Date(y, m - 1, d).getTime();
  }, [todayStr]);

  // Single-pass O(Tasks) aggregation map: pre-aggregates tasks, done count, overdue count, and approaching count per project
  const taskMetricsByProjectId = useMemo(() => {
    const map = new Map<string, ProjectTaskMetrics>();
    for (const p of projects) {
      map.set(p.id, { tasks: [], doneCount: 0, overdueCount: 0, approachingCount: 0 });
    }
    for (const task of allTasks) {
      if (!task.projectId) continue;
      let metrics = map.get(task.projectId);
      if (!metrics) {
        metrics = { tasks: [], doneCount: 0, overdueCount: 0, approachingCount: 0 };
        map.set(task.projectId, metrics);
      }
      metrics.tasks.push(task);
      if (task.completed) {
        metrics.doneCount++;
      } else {
        const tTime = task.scheduledEndAt || task.scheduledStartAt;
        if (tTime) {
          const dStr = formatDateYMD(new Date(tTime));
          if (dStr < todayStr) {
            metrics.overdueCount++;
          } else {
            const diffDays = (new Date(dStr).getTime() - todayMidnightMs) / (24 * 3600 * 1000);
            if (diffDays >= 0 && diffDays <= 3) {
              metrics.approachingCount++;
            }
          }
        }
      }
    }
    return map;
  }, [projects, allTasks, todayStr, todayMidnightMs]);

  // Dynamically compute project status map using pre-grouped tasks (avoids repeated filtering)
  const statusMap = useMemo(() => {
    const map = new Map<string, ProjectStatus>();
    for (const p of projects) {
      const pTasks = taskMetricsByProjectId.get(p.id)?.tasks ?? [];
      map.set(p.id, getProjectComputedStatus(p, pTasks));
    }
    return map;
  }, [projects, taskMetricsByProjectId]);

  // Smart dynamic status derivation with pre-aggregated counts
  const getProjectSmartStatus = (proj: Project) => {
    const computedStatus = statusMap.get(proj.id) || "in_progress";
    if (computedStatus === "archived") {
      return {
        key: "archived" as const,
        label: "已归档",
        sidebarLabel: "已归档",
        sidebarBadgeClasses: isPixelTheme
          ? "rounded-xs bg-muted text-muted-foreground border border-border/80 font-mono"
          : "rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700",
      };
    }

    if (computedStatus === "completed") {
      return {
        key: "completed" as const,
        label: "已完成",
        sidebarLabel: "已完成",
        sidebarBadgeClasses: isPixelTheme
          ? "rounded-xs bg-emerald-200 text-emerald-950 border border-emerald-800 shadow-[1px_1px_0px_#064e3b] font-mono"
          : "rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60",
      };
    }

    // For in_progress project, check pre-aggregated risk & deadlines
    const metrics = taskMetricsByProjectId.get(proj.id);
    const overdueCount = metrics?.overdueCount ?? 0;
    const approachingCount = metrics?.approachingCount ?? 0;

    const isProjectOverdue = Boolean(proj.endDate && proj.endDate < todayStr);
    const isProjectApproaching = Boolean(
      !isProjectOverdue &&
      proj.endDate &&
      (new Date(proj.endDate).getTime() - todayMidnightMs) / (24 * 3600 * 1000) <= 3
    );

    if (overdueCount > 0 || isProjectOverdue) {
      const count = overdueCount > 0 ? overdueCount : 1;
      return {
        key: "overdue" as const,
        label: `进行中 · 逾期（${count}）`,
        sidebarLabel: `逾期 ${count}`,
        sidebarBadgeClasses: isPixelTheme
          ? "rounded-xs bg-red-200 text-red-950 border border-red-800 shadow-[1px_1px_0px_#7f1d1d] font-mono animate-pulse"
          : "rounded bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60",
      };
    }

    if (approachingCount > 0 || isProjectApproaching) {
      const count = approachingCount > 0 ? approachingCount : 1;
      return {
        key: "approaching" as const,
        label: `进行中 · 临近预期（${count}）`,
        sidebarLabel: `临近 ${count}`,
        sidebarBadgeClasses: isPixelTheme
          ? "rounded-xs bg-amber-200 text-amber-950 border border-amber-800 shadow-[1px_1px_0px_#000] font-mono"
          : "rounded bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60",
      };
    }

    return {
      key: "healthy" as const,
      label: "进行中 · 正常推进",
      sidebarLabel: "进行中",
      sidebarBadgeClasses: isPixelTheme
        ? "rounded-xs bg-sky-200 text-sky-950 border border-sky-800 shadow-[1px_1px_0px_#000] font-mono"
        : "rounded bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60",
    };
  };

  // Status Filter counts
  const inProgressCount = useMemo(
    () =>
      projects.filter((p) => {
        const st = statusMap.get(p.id);
        return st === "in_progress" || !st;
      }).length,
    [projects, statusMap]
  );
  const completedProjectsCount = useMemo(
    () => projects.filter((p) => statusMap.get(p.id) === "completed").length,
    [projects, statusMap]
  );
  const archivedCount = useMemo(
    () => projects.filter((p) => statusMap.get(p.id) === "archived").length,
    [projects, statusMap]
  );

  // Filtered projects using deferred search query for non-blocking concurrent input
  const filteredProjects = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    return projects
      .filter((project) => {
        const st = statusMap.get(project.id) || "in_progress";
        if (statusFilter === "in_progress") return st === "in_progress";
        if (statusFilter === "completed") return st === "completed";
        if (statusFilter === "archived") return st === "archived";
        return true;
      })
      .filter((project) => {
        if (!q) return true;
        return (
          project.name.toLowerCase().includes(q) ||
          (project.description?.toLowerCase().includes(q) ?? false) ||
          project.tags.some((tag) => tag.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        const pDiff = (PRIORITY_ORDER[b.priority] ?? 0) - (PRIORITY_ORDER[a.priority] ?? 0);
        if (pDiff !== 0) return pDiff;

        if (a.endDate && b.endDate) {
          const dateDiff = a.endDate.localeCompare(b.endDate);
          if (dateDiff !== 0) return dateDiff;
        } else if (a.endDate && !b.endDate) {
          return -1;
        } else if (!a.endDate && b.endDate) {
          return 1;
        }

        const timeA = a.createdAt || a.updatedAt || 0;
        const timeB = b.createdAt || b.updatedAt || 0;
        return timeB - timeA;
      });
  }, [projects, statusFilter, deferredSearchQuery, statusMap]);

  return (
    <aside
      className={cn(
        "flex flex-col h-full w-[310px] shrink-0 border-r overflow-hidden",
        isPixelTheme ? "border-r-2 border-border/90 bg-muted/40 font-mono" : "border-border bg-muted/20"
      )}
    >
      {/* Sidebar Header */}
      <div
        className={cn(
          "flex h-12 shrink-0 items-center justify-between border-b px-3.5 select-none",
          isPixelTheme ? "border-b-2 border-border/90" : "border-border"
        )}
      >
        <div className="flex items-center gap-2">
          {isPixelTheme && <PixelShield size={18} className="shrink-0" />}
          <h3 className="text-sm font-bold text-foreground">{isPixelTheme ? "⚔️ 冒险项目公会" : "项目中心"}</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "size-7.5 cursor-pointer",
              isPixelTheme
                ? "rounded-xs border-2 border-border bg-muted hover:bg-card text-foreground shadow-[1px_1px_0px_#000]"
                : "rounded-md text-muted-foreground hover:text-foreground"
            )}
            onClick={onManageTemplates}
            aria-label="管理模板"
            title="配置项目模板"
          >
            <PixelScroll size={14} className="opacity-80" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "size-7.5 cursor-pointer",
              isPixelTheme
                ? "rounded-xs border-2 border-amber-900 bg-amber-500 hover:bg-amber-600 text-amber-950 shadow-[1px_1px_0px_#000]"
                : "rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
            )}
            onClick={onCreateProject}
            aria-label="新建项目"
            title="新建项目"
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      {/* Status Filter Pills */}
      <div
        className={cn(
          "p-2.5 border-b flex flex-col gap-2 shrink-0 select-none",
          isPixelTheme ? "border-b-2 border-border/80 bg-amber-50/20 dark:bg-amber-950/20" : "border-border/60"
        )}
      >
        {/* Filter Pills Grid */}
        <div className="grid grid-cols-4 gap-1 p-0.5 rounded-lg bg-muted/40 border border-border/50">
          {[
            { key: "in_progress", label: "进行中", count: inProgressCount },
            { key: "all", label: "全部", count: projects.length },
            { key: "completed", label: "已完成", count: completedProjectsCount },
            { key: "archived", label: "已归档", count: archivedCount },
          ].map((tab) => {
            const isActive = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onStatusFilterChange(tab.key as SidebarStatusFilter)}
                className={cn(
                  "py-1 px-1 text-[11px] font-medium text-center transition-all cursor-pointer flex items-center justify-center gap-1 min-w-0 select-none",
                  isActive
                    ? isPixelTheme
                      ? "rounded-xs bg-amber-500 text-amber-950 border border-amber-900 shadow-[1px_1px_0px_#000] font-black active:translate-x-[1px] active:translate-y-[1px]"
                      : "rounded-md bg-card text-foreground shadow-2xs font-bold border border-border/80"
                    : isPixelTheme
                    ? "rounded-xs text-muted-foreground hover:text-foreground hover:bg-amber-100/30 active:translate-x-[1px] active:translate-y-[1px]"
                    : "rounded-md text-muted-foreground hover:text-foreground hover:bg-card/40"
                )}
                title={`${tab.label} (${tab.count})`}
              >
                <span className="truncate">{tab.label}</span>
                <span
                  className={cn(
                    "text-[9px] px-1 py-0.2 rounded-full tabular-nums shrink-0 leading-none",
                    isActive
                      ? isPixelTheme
                        ? "bg-amber-950 text-amber-200 font-bold"
                        : "bg-primary/10 text-primary font-bold"
                      : "bg-muted/80 text-muted-foreground"
                  )}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div
          className={cn(
            "flex items-center gap-1.5 h-7.5 px-2 bg-background border",
            isPixelTheme ? "rounded-xs border-2 border-border/80 shadow-[1px_1px_0px_#000]" : "rounded-lg border-border/80"
          )}
        >
          <Search size={13} className="text-muted-foreground shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => handleSearchQueryChange(e.target.value)}
            placeholder="搜索项目名称、标签..."
            className="w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/60"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => handleSearchQueryChange("")}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Project List */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5">
        {filteredProjects.map((project) => {
          const metrics = taskMetricsByProjectId.get(project.id);
          const taskCount = metrics?.tasks.length ?? 0;
          const done = metrics?.doneCount ?? 0;
          const isCurrent = selectedId === project.id;
          const smart = getProjectSmartStatus(project);

          return (
            <button
              key={project.id}
              type="button"
              onClick={() => onSelectProject(project.id)}
              className={cn(
                "w-full border p-2.5 text-left transition-all cursor-pointer select-none relative",
                isPixelTheme ? "rounded-xs font-mono" : "rounded-xl",
                isCurrent
                  ? isPixelTheme
                    ? "border-2 border-amber-800 dark:border-amber-500 bg-amber-200/95 dark:bg-amber-950/80 shadow-[3px_3px_0px_#000] pl-5"
                    : "border-sky-300 bg-sky-50/80 shadow-sm dark:border-sky-800 dark:bg-sky-950/40"
                  : isPixelTheme
                  ? "border-2 border-border/80 bg-card hover:bg-amber-100/60 dark:hover:bg-amber-950/40 shadow-[2px_2px_0px_rgba(0,0,0,0.06)] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                  : "border-border/60 hover:bg-accent/60"
              )}
            >
              {isPixelTheme && isCurrent && (
                <span
                  className="absolute left-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center select-none pointer-events-none"
                  aria-hidden="true"
                >
                  <span className="text-amber-800 dark:text-amber-400 text-[8px] leading-none font-mono font-black animate-pixel-hop block">
                    ▶
                  </span>
                </span>
              )}
              <div className="flex items-start gap-2.5">
                <ProgressRing completed={done} total={taskCount} isPixelTheme={isPixelTheme} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className={cn("truncate text-xs font-bold text-foreground", isPixelTheme && "font-mono")}>
                      {project.name}
                    </span>
                    <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span
                      className={cn(
                        "inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold border",
                        isPixelTheme ? "rounded-xs font-mono border-black/40 shadow-[1px_1px_0px_#000]" : "rounded-md",
                        priorityClasses[project.priority]
                      )}
                    >
                      {PRIORITY_LABELS[project.priority]}
                    </span>

                    <span
                      className={cn(
                        "inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold shrink-0 border",
                        smart.sidebarBadgeClasses
                      )}
                    >
                      <span>{smart.sidebarLabel}</span>
                    </span>

                    {project.endDate && (
                      <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">
                        {project.endDate.slice(5)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}

        {filteredProjects.length === 0 && (
          <div className="px-3 py-12 text-center text-xs text-muted-foreground space-y-1">
            <FolderKanban className="mx-auto mb-2 size-7 opacity-40" />
            <p>{searchQuery || statusFilter !== "all" ? "未找到符合条件的项目" : "还没有项目"}</p>
          </div>
        )}
      </div>
    </aside>
  );
}
