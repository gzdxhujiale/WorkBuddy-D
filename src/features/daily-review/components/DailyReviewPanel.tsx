import React, { useState, useEffect, useRef, useMemo, useCallback, memo, startTransition } from "react";
import { ChevronLeft, ChevronRight, Cloud, Zap, Award, BarChart3 } from "lucide-react";
import dayjs from "dayjs";
import {
  useDailyReviewSummaries,
  useDailyReviewDetail,
  useDailyReviewStats,
  useReviewActions,
} from "../hooks/useDailyReview";
import { DailyReviewItem, DailyReviewSummary, CompoundStats as CompoundStatsType } from "../types";
import { formatDateYMD, todayYMD } from "@/lib/dateUtils";
import { ReactjsTiptapEditor } from "@/components/ui/reactjs-tiptap-editor";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { cn } from "@/lib/utils";
import {
  PixelFlame,
  PixelTrophy,
  PixelSword,
  PixelScroll,
  PixelSparkle,
  PixelHourglass,
} from "@/components/pixel/PixelIcons";
import { PixelAchievementHall } from "@/components/pixel/PixelBadge";

// Hoisted constants outside component rendering path (Vercel Best Practice: rendering-hoist-jsx)
const WEEK_DAYS = ["日", "一", "二", "三", "四", "五", "六"] as const;
const MIN_DATE = "2020-01-01";

const formatDateDisplay = (dateStr: string): string => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${y}年${m}月${d}日`;
};



// ==========================================
// Local Auto-Save State Hook
// ==========================================
interface UseReviewAutoSaveOptions {
  initialContent: string;
  date: string;
  debounceMs?: number;
  onSave: (date: string, content: string) => void;
}

function useReviewAutoSave({
  initialContent,
  date,
  debounceMs = 1000,
  onSave,
}: UseReviewAutoSaveOptions) {
  const [content, setContent] = useState(initialContent);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");

  const stateRef = useRef({ content, date });
  const lastSavedRef = useRef({ content: initialContent, date });
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  useEffect(() => {
    stateRef.current = { content, date };
  }, [content, date]);

  // When switching to a different date, save any dirty work from previous date and load new content.
  // When remote content arrives asynchronously for the current date, reconcile it safely.
  useEffect(() => {
    const prev = stateRef.current;
    const last = lastSavedRef.current;

    if (prev.date !== date) {
      if (prev.content !== last.content) {
        onSaveRef.current(prev.date, prev.content);
      }
      setContent(initialContent);
      setSaveStatus("saved");
      lastSavedRef.current = { content: initialContent, date };
      stateRef.current = { content: initialContent, date };
      return;
    }

    // Remote data hydrated asynchronously for the current date
    if (initialContent !== last.content) {
      const isPristine = prev.content === last.content;
      if (isPristine) {
        setContent(initialContent);
        setSaveStatus("saved");
        lastSavedRef.current = { content: initialContent, date };
        stateRef.current = { content: initialContent, date };
      }
    }
  }, [date, initialContent]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      const current = stateRef.current;
      const last = lastSavedRef.current;
      if (current.content !== last.content) {
        onSaveRef.current(current.date, current.content);
      }
    };
  }, []);

  // Debounced auto-save
  useEffect(() => {
    if (content === lastSavedRef.current.content) {
      setSaveStatus("saved");
      return;
    }

    setSaveStatus("saving");
    const timer = setTimeout(() => {
      onSaveRef.current(date, content);
      lastSavedRef.current = { content, date };
      setSaveStatus("saved");
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [content, date, debounceMs]);

  return {
    content,
    saveStatus,
    setContent,
  };
}

// ==========================================
// 1. ReviewEditor Component (Memoized)
// ==========================================
interface ReviewEditorProps {
  date: string;
  review?: DailyReviewItem;
  onSave: (date: string, content: string) => void;
}

const ReviewEditor: React.FC<ReviewEditorProps> = memo(({ date, review, onSave }) => {
  const { isPixelTheme } = useAppThemeStyle();
  const { content, saveStatus, setContent } = useReviewAutoSave({
    initialContent: review?.content || "",
    date,
    onSave,
  });

  return (
    <article
      className={cn(
        "flex-1 flex flex-col bg-card overflow-hidden transition-colors",
        isPixelTheme
          ? "border-2 border-border/90 rounded-xs shadow-[3px_3px_0px_rgba(0,0,0,0.08)] font-mono"
          : "border border-border rounded-t-2xl rounded-b-none shadow-2xs"
      )}
    >
      <ReactjsTiptapEditor
        content={content}
        onChange={setContent}
        placeholder={isPixelTheme ? "📜 撰写今日冒险日志... (输入 / 使用魔法指令)" : "输入 / 使用命令..."}
        hideHighlight
        hideCallout
      />

      {/* Footer: Save Status */}
      <footer
        className={cn(
          "flex items-center justify-between px-4 py-2.5 border-t shrink-0 select-none",
          isPixelTheme
            ? "border-t-2 border-border/90 bg-amber-50/40 dark:bg-amber-950/40 font-mono"
            : "border-border bg-muted/40"
        )}
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {isPixelTheme ? (
            saveStatus === "saving" ? (
              <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-bold">
                <PixelHourglass size={14} className="animate-spin" />
                <span>⏳ 刻印中...</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-bold">
                <PixelSparkle size={14} />
                <span>✨ 冒险日志已刻印封存</span>
              </div>
            )
          ) : (
            <>
              <span>{saveStatus === "saving" ? "保存中..." : "已自动保存"}</span>
              <Cloud
                size={16}
                className={cn(
                  "transition-all duration-300",
                  saveStatus === "saved"
                    ? "text-blue-500 fill-blue-500/20"
                    : "text-muted-foreground animate-pulse"
                )}
              />
            </>
          )}
        </div>
      </footer>
    </article>
  );
});

ReviewEditor.displayName = "ReviewEditor";

// ==========================================
// 2. CompoundStats Component (Adaptive: Modern vs 8-bit RPG)
// ==========================================
interface CompoundStatsProps {
  stats: CompoundStatsType;
  summaries: DailyReviewSummary[];
  onSelectDate: (date: string) => void;
  selectedDate: string;
}

const CompoundStats: React.FC<CompoundStatsProps> = memo(({ stats, summaries, onSelectDate, selectedDate }) => {
  const { isPixelTheme } = useAppThemeStyle();
  const [viewMonth, setViewMonth] = useState<dayjs.Dayjs>(() => dayjs(selectedDate).startOf("month"));

  // Keep viewMonth in sync whenever selectedDate navigates into a different month
  useEffect(() => {
    const selectedD = dayjs(selectedDate);
    if (!selectedD.isSame(viewMonth, "month")) {
      setViewMonth(selectedD.startOf("month"));
    }
  }, [selectedDate]);

  const startOfMonth = viewMonth.startOf("month");
  const daysInMonth = viewMonth.daysInMonth();
  const startDayOfWeek = startOfMonth.day(); // 0 is Sunday

  // Dynamically evaluated to avoid midnight stale freeze
  const now = dayjs();
  const todayStr = now.format("YYYY-MM-DD");
  const todayMonthStr = now.format("YYYY-MM");

  const days: (dayjs.Dayjs | null)[] = useMemo(() => {
    const list: (dayjs.Dayjs | null)[] = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      list.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      list.push(viewMonth.date(d));
    }
    return list;
  }, [startDayOfWeek, daysInMonth, viewMonth]);

  return (
    <section className="flex flex-col h-full p-4 gap-4 overflow-y-auto no-scrollbar">
      {/* Stats Section */}
      <section className="shrink-0">
        <div className="flex items-center gap-1.5 mb-2.5">
          {isPixelTheme && <PixelSparkle size={14} />}
          <h2
            className={cn(
              "text-xs font-semibold tracking-wider text-muted-foreground uppercase",
              isPixelTheme && "font-mono font-bold text-foreground"
            )}
          >
            {isPixelTheme ? "📜 复利冒险家属性" : "复利成长"}
          </h2>
        </div>

        {isPixelTheme ? (
          /* 8-bit RPG Stats Grid */
          <div className="grid grid-cols-2 gap-2.5 font-mono">
            <article className="p-3 rounded-xs bg-orange-50/90 dark:bg-orange-950/40 border-2 border-orange-900/60 dark:border-orange-700/60 shadow-[2px_2px_0px_#000] text-center transition-transform hover:-translate-y-0.5">
              <div className="text-lg font-black text-orange-700 dark:text-orange-300 tabular-nums font-mono flex items-center justify-center gap-1">
                <PixelFlame size={16} />
                {stats.currentStreak}
              </div>
              <div className="text-[10px] text-orange-800/90 dark:text-orange-300/90 font-bold mt-0.5">连续复盘/天</div>
            </article>

            <article className="p-3 rounded-xs bg-amber-50/90 dark:bg-amber-950/40 border-2 border-amber-900/60 dark:border-amber-700/60 shadow-[2px_2px_0px_#000] text-center transition-transform hover:-translate-y-0.5">
              <div className="text-lg font-black text-amber-700 dark:text-amber-300 tabular-nums font-mono flex items-center justify-center gap-1">
                <PixelSword size={16} />
                {stats.compoundValue.toFixed(2)}x
              </div>
              <div className="text-[10px] text-amber-800/90 dark:text-amber-300/90 font-bold mt-0.5">复利系数</div>
            </article>

            <article className="p-3 rounded-xs bg-card border-2 border-border/90 shadow-[2px_2px_0px_#000] text-center transition-transform hover:-translate-y-0.5">
              <div className="text-lg font-black text-foreground tabular-nums font-mono flex items-center justify-center gap-1">
                <PixelScroll size={16} />
                {stats.totalReviews}
              </div>
              <div className="text-[10px] text-muted-foreground font-semibold mt-0.5">累计复盘篇数</div>
            </article>

            <article className="p-3 rounded-xs bg-card border-2 border-border/90 shadow-[2px_2px_0px_#000] text-center transition-transform hover:-translate-y-0.5">
              <div className="text-lg font-black text-foreground tabular-nums font-mono flex items-center justify-center gap-1">
                <PixelTrophy size={16} />
                {stats.longestStreak}
              </div>
              <div className="text-[10px] text-muted-foreground font-semibold mt-0.5">最高连击纪录</div>
            </article>
          </div>
        ) : (
          /* Modern Minimal Stats Grid */
          <div className="grid grid-cols-2 gap-2.5">
            <article className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center shadow-2xs dark:bg-amber-950/30">
              <div className="text-xl font-bold text-amber-600 dark:text-amber-400 tabular-nums flex items-center justify-center gap-1">
                <Zap size={16} className="text-amber-500 shrink-0" />
                {stats.currentStreak}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">连续天数</div>
            </article>

            <article className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center shadow-2xs dark:bg-amber-950/30">
              <div className="text-xl font-bold bg-gradient-to-r from-amber-500 to-amber-600 bg-clip-text text-transparent tabular-nums">
                {stats.compoundValue.toFixed(2)}x
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">复利系数</div>
            </article>

            <article className="p-3 rounded-lg bg-card border border-border text-center shadow-2xs">
              <div className="text-xl font-bold text-foreground tabular-nums flex items-center justify-center gap-1">
                <BarChart3 size={16} className="text-muted-foreground opacity-60 shrink-0" />
                {stats.totalReviews}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">总复盘数</div>
            </article>

            <article className="p-3 rounded-lg bg-card border border-border text-center shadow-2xs">
              <div className="text-xl font-bold text-foreground tabular-nums flex items-center justify-center gap-1">
                <Award size={16} className="text-muted-foreground opacity-60 shrink-0" />
                {stats.longestStreak}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">最长连续</div>
            </article>
          </div>
        )}
      </section>

      {/* Calendar Section */}
      <section className="shrink-0 flex flex-col min-h-0">
        <header className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1 text-xs font-semibold text-foreground">
            {isPixelTheme && <PixelHourglass size={14} />}
            <span className={isPixelTheme ? "font-mono font-bold" : ""}>
              {viewMonth.format("YYYY年 M月")} {isPixelTheme ? "📜 复盘刻印月历" : "打卡记录"}
            </span>
          </div>
          <nav className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                const prev = viewMonth.subtract(1, "month");
                if (prev.format("YYYY-MM") >= "2020-01") {
                  setViewMonth(prev);
                }
              }}
              disabled={viewMonth.format("YYYY-MM") <= "2020-01"}
              className={cn(
                "p-1 transition-colors cursor-pointer text-muted-foreground disabled:opacity-30 disabled:pointer-events-none",
                isPixelTheme
                  ? "rounded-xs border border-border bg-muted/40 hover:bg-muted shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                  : "rounded hover:bg-accent"
              )}
              title="上个月"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => {
                const next = viewMonth.add(1, "month");
                if (next.format("YYYY-MM") <= todayMonthStr) {
                  setViewMonth(next);
                }
              }}
              disabled={viewMonth.format("YYYY-MM") >= todayMonthStr}
              className={cn(
                "p-1 transition-colors cursor-pointer text-muted-foreground disabled:opacity-30 disabled:pointer-events-none",
                isPixelTheme
                  ? "rounded-xs border border-border bg-muted/40 hover:bg-muted shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                  : "rounded hover:bg-accent"
              )}
              title="下个月"
            >
              <ChevronRight size={16} />
            </button>
          </nav>
        </header>

        <div
          className={cn(
            "bg-card p-3",
            isPixelTheme
              ? "border-2 border-border/90 rounded-xs shadow-[2px_2px_0px_#000] font-mono"
              : "border border-border rounded-xl shadow-2xs"
          )}
        >
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground font-medium mb-1">
            {WEEK_DAYS.map((w) => (
              <div key={w} className={cn("py-0.5", isPixelTheme && "font-mono font-bold text-[11px]")}>
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {days.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} className={isPixelTheme ? "h-7" : "h-8"} />;
              const dStr = day.format("YYYY-MM-DD");
              const isDisabled = dStr > todayStr;
              const summary = summaries.find((s) => s.date === dStr);

              let levelClass = "bg-transparent text-foreground hover:bg-accent border-transparent";
              if (summary) {
                levelClass = isPixelTheme
                  ? "bg-emerald-500 text-white font-bold border-2 border-emerald-700 shadow-[1px_1px_0px_#064e3b]"
                  : "bg-emerald-500 text-white font-semibold dark:bg-emerald-500";
              }

              const isSelected = dStr === selectedDate;
              return (
                <button
                  key={dStr}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => !isDisabled && onSelectDate(dStr)}
                  className={cn(
                    "flex items-center justify-center transition-all border",
                    isPixelTheme
                      ? "h-7 rounded-xs text-[11px] font-mono font-bold"
                      : "h-8 rounded-lg text-xs font-medium",
                    isDisabled
                      ? "opacity-30 cursor-not-allowed border-transparent bg-muted/20"
                      : isSelected
                      ? isPixelTheme
                        ? "ring-2 ring-amber-400 ring-offset-1 border-2 border-amber-600 font-black z-10 cursor-pointer scale-105 shadow-[1px_1px_0px_#000]"
                        : "ring-2 ring-blue-500 ring-offset-1 border-blue-400 font-bold z-10 cursor-pointer"
                      : "border-transparent cursor-pointer",
                    levelClass
                  )}
                >
                  {day.date()}
                </button>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <footer className="flex items-center justify-end gap-1 mt-2 text-[10px] text-muted-foreground select-none">
          <span>{isPixelTheme ? "短记" : "少"}</span>
          <div className={cn("w-2.5 h-2.5 bg-card border border-border", isPixelTheme ? "rounded-xs" : "rounded-2xs")}></div>
          <div className={cn("w-2.5 h-2.5 bg-emerald-100 dark:bg-emerald-950", isPixelTheme ? "rounded-xs" : "rounded-2xs")}></div>
          <div className={cn("w-2.5 h-2.5 bg-emerald-300 dark:bg-emerald-700", isPixelTheme ? "rounded-xs" : "rounded-2xs")}></div>
          <div className={cn("w-2.5 h-2.5 bg-emerald-500", isPixelTheme ? "rounded-xs" : "rounded-2xs")}></div>
          <div className={cn("w-2.5 h-2.5 bg-emerald-700 dark:bg-emerald-600", isPixelTheme ? "rounded-xs" : "rounded-2xs")}></div>
          <span>{isPixelTheme ? "长文" : "多"}</span>
        </footer>
      </section>

      {/* Pixel Achievement Hall (Only in Pixel Theme) */}
      {isPixelTheme && (
        <section className="shrink-0 pb-2">
          <PixelAchievementHall
            currentStreak={stats.currentStreak}
            totalDays={stats.totalReviews}
          />
        </section>
      )}
    </section>
  );
});

CompoundStats.displayName = "CompoundStats";

// ==========================================
// 3. DailyReviewPanel Main Component
// ==========================================
export const DailyReviewPanel: React.FC = () => {
  const { isPixelTheme } = useAppThemeStyle();
  const [selectedDate, setSelectedDate] = useState<string>(todayYMD());

  const { data: summariesData } = useDailyReviewSummaries();
  const summaries = summariesData ?? [];
  const { data: statsData } = useDailyReviewStats();
  const { data: currentReviewData } = useDailyReviewDetail(selectedDate);
  const { saveReview } = useReviewActions();

  const stats = useMemo(
    () =>
      statsData ?? {
        currentStreak: 0,
        longestStreak: 0,
        totalReviews: summaries.length,
        compoundValue: 1.0,
      },
    [statsData, summaries.length]
  );
  const currentReview = currentReviewData ?? undefined;

  const handleSave = useCallback((date: string, content: string) => {
    saveReview(date, content);
  }, [saveReview]);

  const handleSelectDate = useCallback((date: string) => {
    startTransition(() => {
      setSelectedDate(date);
    });
  }, []);

  const changeDate = useCallback((days: number) => {
    startTransition(() => {
      setSelectedDate((prevSelected) => {
        const [y, m, d_val] = prevSelected.split("-").map(Number);
        const d = new Date(y, m - 1, d_val);
        d.setDate(d.getDate() + days);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (d > today) return prevSelected;

        const minDate = new Date(2020, 0, 1);
        minDate.setHours(0, 0, 0, 0);
        if (d < minDate) return prevSelected;

        return formatDateYMD(d);
      });
    });
  }, []);

  const isCurrentToday = selectedDate === todayYMD();

  return (
    <section className="flex flex-col h-full w-full bg-transparent text-foreground overflow-hidden">
      {/* Top Bar: Date Navigation */}
      <header
        className={cn(
          "flex h-12 items-center justify-center px-6 bg-card shrink-0 select-none",
          isPixelTheme
            ? "border-b-2 border-border/90 shadow-[0_2px_0px_rgba(0,0,0,0.04)] font-mono"
            : "border-b border-border"
        )}
      >
        <nav className="flex items-center gap-2.5">
          <button
            type="button"
            className={cn(
              "p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer",
              isPixelTheme
                ? "rounded-xs border border-border bg-muted/40 hover:bg-muted shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                : "rounded-md hover:bg-accent"
            )}
            onClick={() => changeDate(-1)}
            title="前一天"
            disabled={selectedDate <= MIN_DATE}
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center gap-1.5">
            {isPixelTheme && <PixelScroll size={16} className="text-amber-600 dark:text-amber-400" />}
            <span
              className={cn(
                "text-sm tracking-tight text-foreground",
                isPixelTheme ? "font-mono font-bold text-sm" : "font-semibold"
              )}
            >
              {formatDateDisplay(selectedDate)}
            </span>
          </div>
          {isCurrentToday ? (
            <span
              className={cn(
                "text-xs px-2.5 py-0.5 font-medium",
                isPixelTheme
                  ? "rounded-xs bg-amber-500 text-amber-950 font-bold border-2 border-amber-900 shadow-[1px_1px_0px_#000]"
                  : "rounded-full bg-accent text-accent-foreground"
              )}
            >
              今天
            </span>
          ) : (
            <button
              type="button"
              className={cn(
                "text-xs px-2.5 py-0.5 font-medium transition-colors cursor-pointer",
                isPixelTheme
                  ? "rounded-xs bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold border-2 border-amber-900 shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                  : "rounded-full bg-accent text-accent-foreground hover:bg-accent/80"
              )}
              onClick={() => {
                startTransition(() => {
                  setSelectedDate(todayYMD());
                });
              }}
              title="回到今天"
            >
              回到今天
            </button>
          )}
          <button
            type="button"
            className={cn(
              "p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer",
              isPixelTheme
                ? "rounded-xs border border-border bg-muted/40 hover:bg-muted shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                : "rounded-md hover:bg-accent"
            )}
            onClick={() => changeDate(1)}
            title="后一天"
            disabled={isCurrentToday}
          >
            <ChevronRight size={18} />
          </button>
        </nav>
      </header>

      {/* Main Layout: Left Editor + Right Stats */}
      <section className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: Persistent Review Editor instance */}
        <section className="flex-1 flex flex-col p-4 md:p-5 min-w-0 overflow-hidden">
          <ReviewEditor
            date={selectedDate}
            review={currentReview}
            onSave={handleSave}
          />
        </section>

        {/* Right: Stats + Calendar */}
        <aside
          className={cn(
            "w-72 md:w-80 min-h-0 shrink-0 overflow-hidden",
            isPixelTheme
              ? "border-l-2 border-border/90 bg-card/60 font-mono shadow-[-2px_0px_0px_rgba(0,0,0,0.03)]"
              : "border-l border-border bg-card/40"
          )}
        >
          <CompoundStats
            stats={stats}
            summaries={summaries}
            onSelectDate={handleSelectDate}
            selectedDate={selectedDate}
          />
        </aside>
      </section>
    </section>
  );
};
