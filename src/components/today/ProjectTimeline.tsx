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
import { cn } from "@/lib/utils";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { PixelScroll } from "@/components/pixel/PixelIcons";
import type { ProjectStage, Project } from "@/types/projects";

export type TimelineViewMode = "week" | "biweekly" | "month";

const VIEW_MODE_LABELS: Record<TimelineViewMode, string> = {
  week: "周视图",
  biweekly: "双周视图",
  month: "月视图",
};

const WEEKDAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"];

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
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

function formatRangeLabel(viewMode: TimelineViewMode, startDate: Date, endDate: Date): string {
  const sYear = startDate.getFullYear();
  const sMonth = startDate.getMonth() + 1;
  const sDay = startDate.getDate();
  const eYear = endDate.getFullYear();
  const eMonth = endDate.getMonth() + 1;
  const eDay = endDate.getDate();

  if (viewMode === "month") {
    return `${sYear}年${sMonth}月`;
  }

  if (viewMode === "week") {
    if (sMonth === eMonth) {
      return `${sYear}年${sMonth}月${sDay}日 - ${eDay}日`;
    }
    if (sYear === eYear) {
      return `${sYear}年${sMonth}月${sDay}日 - ${eMonth}月${eDay}日`;
    }
    return `${sYear}年${sMonth}月${sDay}日 - ${eYear}年${eMonth}月${eDay}日`;
  }

  // biweekly
  if (sMonth === eMonth) {
    return `${sYear}年${sMonth}月${sDay}日 - ${eDay}日`;
  }
  if (sYear === eYear) {
    return `${sYear}年${sMonth}月${sDay}日 - ${eMonth}月${eDay}日`;
  }
  return `${sYear}年${sMonth}月${sDay}日 - ${eYear}年${eMonth}月${eDay}日`;
}

function formatShortDate(d: Date): string {
  return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, "0")}`;
}

export const ProjectTimeline: React.FC = () => {
  const { isPixelTheme } = useAppThemeStyle();
  const { data: projectsData } = useProjectsData();
  const projects = projectsData?.projects ?? [];
  const stages = projectsData?.stages ?? [];
  const tasks = projectsData?.tasks ?? [];

  const [viewMode, setViewMode] = useState<TimelineViewMode>("biweekly");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);

  // Active anchor reference date
  const [anchorDate, setAnchorDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // Active project selection
  const currentProject: Project | undefined = useMemo(() => {
    if (selectedProjectId) {
      const found = projects.find((p) => p.id === selectedProjectId);
      if (found) return found;
    }
    return projects.find((p) => p.status === "in_progress") ?? projects[0];
  }, [projects, selectedProjectId]);

  const todayStr = todayYMD();
  const todayDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Compute window start date and total days based on current viewMode & anchorDate
  const { windowStartDate, totalDays, windowEndDate } = useMemo(() => {
    if (viewMode === "month") {
      const year = anchorDate.getFullYear();
      const month = anchorDate.getMonth();
      const start = new Date(year, month, 1, 0, 0, 0, 0);
      const days = getDaysInMonth(year, month);
      const end = new Date(year, month, days, 0, 0, 0, 0);
      return { windowStartDate: start, totalDays: days, windowEndDate: end };
    }

    if (viewMode === "week") {
      const start = getMonday(anchorDate);
      const days = 7;
      const end = addDays(start, days - 1);
      return { windowStartDate: start, totalDays: days, windowEndDate: end };
    }

    // biweekly: 14 days starting from Monday
    const start = getMonday(anchorDate);
    const days = 14;
    const end = addDays(start, days - 1);
    return { windowStartDate: start, totalDays: days, windowEndDate: end };
  }, [viewMode, anchorDate]);

  // Date list for the visible window
  const dateList = useMemo(() => {
    const list: Date[] = [];
    for (let i = 0; i < totalDays; i++) {
      list.push(addDays(windowStartDate, i));
    }
    return list;
  }, [windowStartDate, totalDays]);

  // Navigation handlers per view mode
  const handlePrev = () => {
    if (viewMode === "month") {
      setAnchorDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    } else if (viewMode === "week") {
      setAnchorDate((prev) => addDays(prev, -7));
    } else {
      setAnchorDate((prev) => addDays(prev, -14));
    }
  };

  const handleNext = () => {
    if (viewMode === "month") {
      setAnchorDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    } else if (viewMode === "week") {
      setAnchorDate((prev) => addDays(prev, 7));
    } else {
      setAnchorDate((prev) => addDays(prev, 14));
    }
  };

  const handleGoToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setAnchorDate(d);
  };

  const handleSelectViewMode = (mode: TimelineViewMode) => {
    setViewMode(mode);
    setViewDropdownOpen(false);
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
    <section
      className={cn(
        "w-full bg-card p-5 text-foreground shadow-xs transition-all",
        isPixelTheme
          ? "border-2 border-border/90 rounded-xl shadow-[3px_3px_0px_rgba(0,0,0,0.1)] font-mono"
          : "border border-border rounded-xl"
      )}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border/70">
        {/* Left: Indicator + Title + Date Range Picker */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            {isPixelTheme ? (
              <PixelScroll size={16} className="text-emerald-600 dark:text-emerald-400" />
            ) : (
              <span className="size-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            )}
            <h2 className="text-base font-bold tracking-tight text-foreground">
              {isPixelTheme ? "📜 冒险项目时间线" : "项目时间线"}
            </h2>
          </div>

          {/* Date Range & Arrow Controls */}
          <div
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 text-xs",
              isPixelTheme
                ? "rounded-xs border border-border bg-muted/60"
                : "rounded-lg border border-border/80 bg-muted/30"
            )}
          >
            <Calendar className="size-3.5 text-emerald-500" />
            <span className="font-medium tabular-nums text-foreground">
              {formatRangeLabel(viewMode, windowStartDate, windowEndDate)}
            </span>
            <div className="flex items-center ml-1 border-l border-border/60 pl-1">
              <button
                type="button"
                onClick={handlePrev}
                aria-label={`向前切换${VIEW_MODE_LABELS[viewMode]}`}
                title={`向前切换${VIEW_MODE_LABELS[viewMode]}`}
                className={cn(
                  "p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer",
                  isPixelTheme ? "rounded-xs hover:bg-muted" : "rounded-md hover:bg-accent"
                )}
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                aria-label={`向后切换${VIEW_MODE_LABELS[viewMode]}`}
                title={`向后切换${VIEW_MODE_LABELS[viewMode]}`}
                className={cn(
                  "p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer",
                  isPixelTheme ? "rounded-xs hover:bg-muted" : "rounded-md hover:bg-accent"
                )}
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
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer",
                  isPixelTheme
                    ? "rounded-xs border border-border bg-muted/60 hover:bg-muted"
                    : "rounded-lg border border-border/70 bg-muted/20 hover:bg-accent"
                )}
              >
                <FolderKanban className="size-3.5 text-sky-500" />
                <span className="max-w-[120px] truncate">{currentProject?.name ?? "选择项目"}</span>
                <ChevronDown className="size-3 opacity-60" />
              </button>

              {projectDropdownOpen && (
                <div
                  className={cn(
                    "absolute left-0 top-full mt-1.5 z-50 min-w-44 border border-border bg-popover p-1 shadow-lg animate-in fade-in zoom-in-95",
                    isPixelTheme ? "rounded-xs shadow-[3px_3px_0px_#000]" : "rounded-xl"
                  )}
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
                      className={cn(
                        "w-full text-left px-2.5 py-1.5 text-xs transition-colors flex items-center justify-between cursor-pointer",
                        isPixelTheme ? "rounded-xs" : "rounded-lg",
                        currentProject?.id === proj.id
                          ? "bg-accent font-semibold text-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
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
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-foreground transition-colors cursor-pointer",
                isPixelTheme
                  ? "rounded-xs border border-border bg-muted/60 hover:bg-muted"
                  : "rounded-lg border border-border/80 bg-muted/30 hover:bg-accent"
              )}
            >
              <span>{VIEW_MODE_LABELS[viewMode]}</span>
              <ChevronDown className="size-3 text-muted-foreground" />
            </button>

            {viewDropdownOpen && (
              <div
                className={cn(
                  "absolute right-0 top-full mt-1.5 z-50 min-w-28 border border-border bg-popover p-1 shadow-lg animate-in fade-in zoom-in-95",
                  isPixelTheme ? "rounded-xs shadow-[3px_3px_0px_#000]" : "rounded-xl"
                )}
                onMouseLeave={() => setViewDropdownOpen(false)}
              >
                {(["week", "biweekly", "month"] as TimelineViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => handleSelectViewMode(mode)}
                    className={cn(
                      "w-full text-left px-2.5 py-1.5 text-xs transition-colors cursor-pointer",
                      isPixelTheme ? "rounded-xs" : "rounded-lg",
                      viewMode === mode
                        ? "bg-accent font-semibold text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
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
            className={cn(
              "h-7 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-3 text-xs font-semibold cursor-pointer",
              isPixelTheme ? "rounded-xs border-emerald-600/60 shadow-[1px_1px_0px_#000]" : "rounded-lg"
            )}
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
            <div className="flex items-center text-xs text-muted-foreground select-none pb-1 border-b border-border/40">
              {/* Stage label column */}
              <div className="w-28 shrink-0 font-semibold pl-1 text-muted-foreground text-xs">阶段</div>

              {/* Day Axis */}
              <div
                className="flex-1 grid"
                style={{ gridTemplateColumns: `repeat(${totalDays}, minmax(0, 1fr))` }}
              >
                {dateList.map((d, index) => {
                  const isCurrentDay = formatDateYMD(d) === todayStr;
                  const dayNum = d.getDate();
                  const weekdayName = WEEKDAY_NAMES[d.getDay()];

                  return (
                    <div key={index} className="flex flex-col items-center justify-center relative py-0.5">
                      {isCurrentDay ? (
                        <div className="flex flex-col items-center">
                          {viewMode === "week" && (
                            <span className="text-[9px] leading-none text-emerald-500 font-semibold mb-0.5">
                              {weekdayName}
                            </span>
                          )}
                          <span className="grid size-5 place-items-center rounded-none bg-emerald-500 text-[10px] font-bold text-white shadow-[0_0_8px_rgba(16,185,129,0.8)]">
                            {dayNum}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          {viewMode === "week" && (
                            <span className="text-[9px] leading-none text-muted-foreground/60 mb-0.5">
                              {weekdayName}
                            </span>
                          )}
                          <span className="text-[10px] leading-5 font-medium tabular-nums text-muted-foreground/80 hover:text-foreground">
                            {dayNum}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stages Rows with Track and Bars */}
            <div className="relative space-y-1.5 pt-2.5">
              {/* Vertical Guide Line for Today */}
              {todayIndex >= 0 && (
                <div
                  className="absolute top-0 bottom-0 pointer-events-none z-20"
                  style={{
                    left: `calc(112px + ${(todayIndex + 0.5) * (100 / totalDays)}% * ((100% - 112px) / 100))`,
                    width: "1.5px",
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
                const widthPct = Math.max(viewMode === "month" ? 2.5 : 4, ((clampedEnd - clampedStart) / totalDays) * 100);

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
                    <div className="flex-1 h-6 rounded-none bg-muted/20 dark:bg-slate-900/60 border border-border/30 relative flex items-center overflow-hidden">
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
                          className={`absolute h-5 rounded-none px-2 flex items-center justify-between text-[11px] transition-all duration-300 z-10 select-none ${barClass}`}
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                          }}
                          title={`${stage.name} (${formatShortDate(stage.computedStart)} - ${formatShortDate(stage.computedEnd)})`}
                        >
                          <span className="truncate font-medium pr-1">{stage.name}</span>
                          <span className="text-[10px] opacity-85 tabular-nums whitespace-nowrap hidden md:inline shrink-0">
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
