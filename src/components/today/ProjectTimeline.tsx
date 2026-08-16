import React, { useState, useMemo } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FolderKanban,
} from "lucide-react";
import { useProjectsData } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { formatDateYMD, todayYMD } from "@/lib/dateUtils";
import type { ProjectStage, Project } from "@/types/projects";

export type TimelineViewMode = "week" | "biweekly" | "month";

const VIEW_MODE_LABELS: Record<TimelineViewMode, string> = {
  week: "周视图",
  biweekly: "双周视图",
  month: "月视图",
};

const VIEW_MODE_DAYS: Record<TimelineViewMode, number> = {
  week: 7,
  biweekly: 14,
  month: 30,
};

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function parseDateStr(str?: string): Date | null {
  if (!str) return null;
  const parts = str.slice(0, 10).split("-").map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function formatMonthYearLabel(startDate: Date, endDate: Date): string {
  const sYear = startDate.getFullYear();
  const sMonth = startDate.getMonth() + 1;
  const eYear = endDate.getFullYear();
  const eMonth = endDate.getMonth() + 1;

  if (sYear === eYear) {
    if (sMonth === eMonth) {
      return `${sYear}年${sMonth}月`;
    }
    return `${sYear}年${sMonth}-${eMonth}月`;
  }
  return `${sYear}年${sMonth}月 - ${eYear}年${eMonth}月`;
}

function formatShortDate(d: Date): string {
  return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, "0")}`;
}

export const ProjectTimeline: React.FC = () => {
  const { data: projectsData } = useProjectsData();
  const projects = projectsData?.projects ?? [];
  const stages = projectsData?.stages ?? [];
  const tasks = projectsData?.tasks ?? [];

  const [viewMode, setViewMode] = useState<TimelineViewMode>("biweekly");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);

  // Active project selection
  const currentProject: Project | undefined = useMemo(() => {
    if (selectedProjectId) {
      const found = projects.find((p) => p.id === selectedProjectId);
      if (found) return found;
    }
    // Default to first in_progress project, or first project
    return projects.find((p) => p.status === "in_progress") ?? projects[0];
  }, [projects, selectedProjectId]);

  // Window start date (normalized to midnight)
  const todayStr = todayYMD();
  const todayDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [windowStartDate, setWindowStartDate] = useState<Date>(() => {
    // Center or start window so today is nicely visible
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - 3); // Start 3 days before today for context
    return d;
  });

  const totalDays = VIEW_MODE_DAYS[viewMode];

  const dateList = useMemo(() => {
    const list: Date[] = [];
    for (let i = 0; i < totalDays; i++) {
      list.push(addDays(windowStartDate, i));
    }
    return list;
  }, [windowStartDate, totalDays]);

  const windowEndDate = useMemo(() => {
    return addDays(windowStartDate, totalDays - 1);
  }, [windowStartDate, totalDays]);

  // Navigation handlers
  const handlePrev = () => {
    const shift = viewMode === "month" ? 15 : Math.max(7, Math.floor(totalDays / 2));
    setWindowStartDate((prev) => addDays(prev, -shift));
  };

  const handleNext = () => {
    const shift = viewMode === "month" ? 15 : Math.max(7, Math.floor(totalDays / 2));
    setWindowStartDate((prev) => addDays(prev, shift));
  };

  const handleGoToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const offset = viewMode === "month" ? 5 : 3;
    d.setDate(d.getDate() - offset);
    setWindowStartDate(d);
  };

  // Find index of today in dateList if visible
  const todayIndex = useMemo(() => {
    return dateList.findIndex((d) => formatDateYMD(d) === todayStr);
  }, [dateList, todayStr]);

  // Project stages for active project
  const projectStages: ProjectStage[] = useMemo(() => {
    if (!currentProject) return [];
    return stages
      .filter((s) => s.projectId === currentProject.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [stages, currentProject]);

  // If stages have no dates, derive or generate sensible timeline dates
  const timelineStages = useMemo(() => {
    if (!currentProject) return [];

    return projectStages.map((stage, index) => {
      let start = parseDateStr(stage.startDate);
      let end = parseDateStr(stage.endDate);

      // Try inferring from tasks if stage dates are not set
      if (!start || !end) {
        const stageTasks = tasks.filter((t) => t.projectStageId === stage.id);
        const taskEndDates = stageTasks
          .map((t) => t.scheduledEndAt)
          .filter((t): t is number => Boolean(t));
        if (taskEndDates.length > 0) {
          const minTime = Math.min(...taskEndDates);
          const maxTime = Math.max(...taskEndDates);
          if (!start) start = new Date(minTime);
          if (!end) end = new Date(maxTime);
        }
      }

      // Fallback: If still no dates, stagger stages relative to project start or today
      if (!start || !end) {
        const base = parseDateStr(currentProject.startDate) ?? addDays(todayDate, -2);
        const stageStart = addDays(base, index * 4);
        const stageEnd = addDays(stageStart, 5);
        start = start ?? stageStart;
        end = end ?? stageEnd;
      }

      // Ensure start <= end
      if (end < start) end = start;

      return {
        ...stage,
        computedStart: start,
        computedEnd: end,
      };
    });
  }, [currentProject, projectStages, tasks, todayDate]);

  return (
    <section className="w-full rounded-2xl border border-border/80 bg-card/90 dark:bg-[#12141a] p-5 text-foreground shadow-sm transition-all">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border/70">
        {/* Left: Indicator + Title + Date Range Picker */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            <h2 className="text-base font-bold tracking-tight text-foreground">项目时间线</h2>
          </div>

          {/* Date Range & Arrow Controls */}
          <div className="flex items-center gap-1.5 rounded-xl border border-border/80 bg-muted/30 px-2.5 py-1 text-xs">
            <Calendar className="size-3.5 text-emerald-500" />
            <span className="font-medium tabular-nums text-foreground">
              {formatMonthYearLabel(windowStartDate, windowEndDate)}
            </span>
            <div className="flex items-center ml-1 border-l border-border/60 pl-1">
              <button
                type="button"
                onClick={handlePrev}
                aria-label="向前查看时间线"
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                aria-label="向后查看时间线"
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Project Switcher Dropdown (if multiple projects exist) */}
          {projects.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setProjectDropdownOpen(!projectDropdownOpen);
                  setViewDropdownOpen(false);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-border/70 bg-muted/20 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <FolderKanban className="size-3.5 text-sky-500" />
                <span className="max-w-[120px] truncate">{currentProject?.name ?? "选择项目"}</span>
                <ChevronDown className="size-3 opacity-60" />
              </button>

              {projectDropdownOpen && (
                <div
                  className="absolute left-0 top-full mt-1.5 z-50 min-w-44 rounded-xl border border-border bg-popover p-1 shadow-lg animate-in fade-in zoom-in-95"
                  onMouseLeave={() => setProjectDropdownOpen(false)}
                >
                  {projects.map((proj) => (
                    <button
                      key={proj.id}
                      type="button"
                      onClick={() => {
                        setSelectedProjectId(proj.id);
                        setProjectDropdownOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg transition-colors flex items-center justify-between ${
                        currentProject?.id === proj.id
                          ? "bg-accent font-semibold text-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <span className="truncate">{proj.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: View Switcher (周视图 / 双周视图 / 月视图) + "今天" Button */}
        <div className="flex items-center gap-2">
          {/* View Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setViewDropdownOpen(!viewDropdownOpen);
                setProjectDropdownOpen(false);
              }}
              className="flex items-center gap-1.5 rounded-xl border border-border/80 bg-muted/30 px-3 py-1 text-xs font-medium text-foreground hover:bg-accent transition-colors"
            >
              <span>{VIEW_MODE_LABELS[viewMode]}</span>
              <ChevronDown className="size-3 text-muted-foreground" />
            </button>

            {viewDropdownOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 z-50 min-w-28 rounded-xl border border-border bg-popover p-1 shadow-lg animate-in fade-in zoom-in-95"
                onMouseLeave={() => setViewDropdownOpen(false)}
              >
                {(["week", "biweekly", "month"] as TimelineViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setViewMode(mode);
                      setViewDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg transition-colors ${
                      viewMode === mode
                        ? "bg-accent font-semibold text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {VIEW_MODE_LABELS[mode]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Today Button */}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleGoToday}
            className="h-7 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-3 text-xs font-semibold"
          >
            今天
          </Button>
        </div>
      </div>

      {/* Timeline Gantt Body */}
      {timelineStages.length === 0 ? (
        <div className="py-10 text-center text-xs text-muted-foreground">
          <FolderKanban className="mx-auto mb-2 size-7 opacity-40 text-muted-foreground" />
          当前项目暂无阶段。可在「项目中心」配置阶段与时间周期。
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto min-w-0">
          <div className="min-w-[680px]">
            {/* Column Headers */}
            <div className="flex items-center text-xs text-muted-foreground select-none pb-2 border-b border-border/40">
              {/* Stage label column */}
              <div className="w-28 shrink-0 font-semibold pl-1 text-muted-foreground">阶段</div>

              {/* Day Axis */}
              <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${totalDays}, minmax(0, 1fr))` }}>
                {dateList.map((d, index) => {
                  const isCurrentDay = formatDateYMD(d) === todayStr;
                  const dayNum = d.getDate();
                  return (
                    <div key={index} className="flex flex-col items-center justify-center relative">
                      {isCurrentDay ? (
                        <span className="grid size-6 place-items-center rounded-full bg-emerald-500 text-[11px] font-bold text-white shadow-[0_0_12px_rgba(16,185,129,0.8)]">
                          {dayNum}
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium tabular-nums text-muted-foreground/80 hover:text-foreground">
                          {dayNum}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stages Rows with Track and Bars */}
            <div className="relative space-y-2.5 pt-3">
              {/* Vertical Guide Line for Today */}
              {todayIndex >= 0 && (
                <div
                  className="absolute top-0 bottom-0 pointer-events-none z-20 flex justify-center"
                  style={{
                    left: `calc(112px + ${(todayIndex + 0.5) * (100 / totalDays)}% * ((100% - 112px) / 100))`,
                    width: "1px",
                  }}
                >
                  <div className="w-[1.5px] h-full bg-emerald-500/70 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                </div>
              )}

              {timelineStages.map((stage) => {
                const sTime = stage.computedStart.getTime();
                const eTime = stage.computedEnd.getTime();
                const wStartTime = windowStartDate.getTime();
                const dayMs = 86400000;

                // Calculate relative day offsets in window
                const startOffsetDays = (sTime - wStartTime) / dayMs;
                const endOffsetDays = (eTime - wStartTime) / dayMs + 1; // inclusive

                const clampedStart = Math.max(0, startOffsetDays);
                const clampedEnd = Math.min(totalDays, endOffsetDays);
                const isVisible = clampedEnd > 0 && clampedStart < totalDays;

                const leftPct = (clampedStart / totalDays) * 100;
                const widthPct = Math.max(3, ((clampedEnd - clampedStart) / totalDays) * 100);

                // Is active / highlighted bar
                const isTodayActive =
                  todayDate.getTime() >= sTime && todayDate.getTime() <= eTime + dayMs;

                // Style variant
                let barClass =
                  "border border-emerald-500/50 bg-emerald-950/40 text-emerald-300 dark:bg-emerald-950/50 shadow-xs";
                if (isTodayActive) {
                  barClass =
                    "bg-gradient-to-r from-emerald-500 to-teal-400 text-white font-semibold shadow-[0_0_15px_rgba(16,185,129,0.45)] border border-emerald-300/40";
                } else if (eTime < todayDate.getTime()) {
                  barClass = "bg-muted/70 text-muted-foreground border border-border/80";
                }

                return (
                  <div key={stage.id} className="flex items-center text-xs group">
                    {/* Stage Name */}
                    <div className="w-28 shrink-0 flex items-center gap-1.5 pr-2 truncate text-foreground font-medium">
                      <span className="size-1.5 rounded-full bg-muted-foreground/60 shrink-0" />
                      <span className="truncate" title={stage.name}>
                        {stage.name}
                      </span>
                    </div>

                    {/* Track */}
                    <div className="flex-1 h-9 rounded-full bg-muted/20 dark:bg-slate-900/60 border border-border/30 relative flex items-center overflow-hidden">
                      {/* Grid background dashes */}
                      <div
                        className="absolute inset-0 grid pointer-events-none opacity-20"
                        style={{ gridTemplateColumns: `repeat(${totalDays}, minmax(0, 1fr))` }}
                      >
                        {Array.from({ length: totalDays }).map((_, idx) => (
                          <div key={idx} className="border-r border-border/40 h-full" />
                        ))}
                      </div>

                      {/* Bar */}
                      {isVisible && (
                        <div
                          className={`absolute h-7 rounded-full px-3 flex items-center justify-between text-xs transition-all duration-300 z-10 select-none ${barClass}`}
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                          }}
                          title={`${stage.name} (${formatShortDate(stage.computedStart)} - ${formatShortDate(stage.computedEnd)})`}
                        >
                          <span className="truncate font-medium pr-1">{stage.name}</span>
                          <span className="text-[10px] opacity-85 tabular-nums whitespace-nowrap hidden sm:inline shrink-0">
                            {formatShortDate(stage.computedStart)} - {formatShortDate(stage.computedEnd)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
