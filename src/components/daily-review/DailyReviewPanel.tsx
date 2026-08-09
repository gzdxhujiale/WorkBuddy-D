import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import { ChevronLeft, ChevronRight, Cloud, Zap, Award, BarChart3 } from "lucide-react";
import dayjs from "dayjs";
import { useDailyReviewData, useReviewActions, isReviewEmpty } from "@/hooks/useDailyReview";
import { DailyReviewItem, CompoundStats as CompoundStatsType } from "@/types/dailyReview";
import { formatDateYMD, todayYMD, daysBetween } from "@/lib/dateUtils";
import { DailyReviewEditor } from "./DailyReviewEditor";

// Hoisted constants outside component rendering path (Vercel Best Practice: rendering-hoist-jsx)
const WEEK_DAYS = ["日", "一", "二", "三", "四", "五", "六"] as const;
const MIN_DATE = "2026-01-01";
const EMPTY_REVIEWS: DailyReviewItem[] = [];

const formatDateDisplay = (dateStr: string): string => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${y}年${m}月${d}日`;
};

function normalizeDateStr(d: string): string {
  if (!d) return "";
  const trimmed = d.trim();
  if (trimmed.length >= 10 && trimmed[4] === "-" && trimmed[7] === "-") {
    return trimmed.slice(0, 10);
  }
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return formatDateYMD(parsed);
  }
  return trimmed;
}

function getAllReviews(reviews: DailyReviewItem[]): DailyReviewItem[] {
  return reviews
    .filter((r) => !isReviewEmpty(r.content))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function getReviewByDate(reviews: DailyReviewItem[], date: string): DailyReviewItem | undefined {
  const target = normalizeDateStr(date);
  const matches = reviews.filter((r) => normalizeDateStr(r.date) === target || r.date.startsWith(target));
  if (matches.length === 0) return undefined;
  matches.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return matches[0];
}

function getCompoundStats(reviews: DailyReviewItem[]): CompoundStatsType {
  const meaningful = reviews.filter((r) => !isReviewEmpty(r.content));
  if (meaningful.length === 0) {
    return { currentStreak: 0, longestStreak: 0, totalReviews: 0, compoundValue: 1.00, monthlyCompletionRate: 0 };
  }

  const dates = [...new Set(meaningful.map((r) => r.date))].sort();

  let currentStreak = 1;
  let longestStreak = 1;
  let streakCount = 1;

  for (let i = 1; i < dates.length; i++) {
    const diff = daysBetween(dates[i - 1], dates[i]);
    if (diff === 1) {
      streakCount++;
      longestStreak = Math.max(longestStreak, streakCount);
    } else {
      streakCount = 1;
    }
  }

  const today = new Date();
  const todayStr = todayYMD();

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = formatDateYMD(yesterday);

  const lastDate = dates[dates.length - 1];

  if (lastDate === todayStr || lastDate === yesterdayStr) {
    currentStreak = streakCount;
  } else {
    currentStreak = 0;
  }

  const compoundValue = parseFloat(Math.pow(1.01, currentStreak).toFixed(4));
  const currentMonthStr = todayStr.slice(0, 7);
  const thisMonthReviews = dates.filter((d) => d.startsWith(currentMonthStr)).length;
  const daysInCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const monthlyCompletionRate = Math.round((thisMonthReviews / daysInCurrentMonth) * 100);

  return {
    currentStreak,
    longestStreak,
    totalReviews: dates.length,
    compoundValue,
    monthlyCompletionRate,
  };
}

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
  debounceMs = 500,
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

  useEffect(() => {
    const prev = stateRef.current;
    const last = lastSavedRef.current;
    if (prev.date !== date) {
      if (prev.content !== last.content) {
        onSaveRef.current(prev.date, prev.content);
      }
    }

    setContent(initialContent);
    setSaveStatus("saved");
    lastSavedRef.current = { content: initialContent, date };
    stateRef.current = { content: initialContent, date };
  }, [date, initialContent]);

  useEffect(() => {
    return () => {
      const current = stateRef.current;
      const last = lastSavedRef.current;
      if (current.content !== last.content) {
        onSaveRef.current(current.date, current.content);
      }
    };
  }, []);

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
  const { content, saveStatus, setContent } = useReviewAutoSave({
    initialContent: review?.content || "",
    date,
    onSave,
  });

  return (
    <div className="flex-1 flex flex-col bg-card border border-border rounded-xl shadow-2xs overflow-hidden transition-colors">
      {/* Official reactjs-tiptap-editor */}
      <div className="flex-1 flex flex-col relative min-h-0">
        <DailyReviewEditor
          key={date}
          content={content}
          onChange={setContent}
        />
      </div>

      {/* Footer: Save Status */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/40 shrink-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{saveStatus === "saving" ? "保存中..." : "已自动保存"}</span>
          <Cloud
            size={16}
            className={`transition-all duration-300 ${
              saveStatus === "saved"
                ? "text-blue-500 fill-blue-500/20"
                : "text-muted-foreground animate-pulse"
            }`}
          />
        </div>
      </div>
    </div>
  );
});

ReviewEditor.displayName = "ReviewEditor";

// ==========================================
// 2. CompoundStats Component (Memoized)
// ==========================================
interface CompoundStatsProps {
  stats: CompoundStatsType;
  reviews: DailyReviewItem[];
  onSelectDate: (date: string) => void;
  selectedDate: string;
}

const CompoundStats: React.FC<CompoundStatsProps> = memo(({ stats, reviews, onSelectDate, selectedDate }) => {
  const currentMonth = useMemo(() => dayjs(selectedDate), [selectedDate]);
  const startOfMonth = currentMonth.startOf("month");
  const daysInMonth = currentMonth.daysInMonth();
  const startDayOfWeek = startOfMonth.day(); // 0 is Sunday

  const todayStr = useMemo(() => dayjs().format("YYYY-MM-DD"), []);
  const todayMonthStr = useMemo(() => dayjs().format("YYYY-MM"), []);

  const days: (dayjs.Dayjs | null)[] = useMemo(() => {
    const list: (dayjs.Dayjs | null)[] = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      list.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      list.push(currentMonth.date(d));
    }
    return list;
  }, [startDayOfWeek, daysInMonth, currentMonth]);

  return (
    <div className="flex flex-col h-full p-4 gap-4 overflow-y-auto">
      {/* Stats Section */}
      <div className="shrink-0">
        <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase mb-3">
          复利成长
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center shadow-2xs dark:bg-amber-950/30">
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400 tabular-nums flex items-center justify-center gap-1">
              <Zap size={16} className="text-amber-500 shrink-0" />
              {stats.currentStreak}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">连续天数</div>
          </div>

          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center shadow-2xs dark:bg-amber-950/30">
            <div className="text-xl font-bold bg-gradient-to-r from-amber-500 to-amber-600 bg-clip-text text-transparent tabular-nums">
              {stats.compoundValue.toFixed(2)}x
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">复利系数</div>
          </div>

          <div className="p-3 rounded-lg bg-card border border-border text-center shadow-2xs">
            <div className="text-xl font-bold text-foreground tabular-nums flex items-center justify-center gap-1">
              <BarChart3 size={16} className="text-muted-foreground opacity-60 shrink-0" />
              {stats.totalReviews}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">总复盘数</div>
          </div>

          <div className="p-3 rounded-lg bg-card border border-border text-center shadow-2xs">
            <div className="text-xl font-bold text-foreground tabular-nums flex items-center justify-center gap-1">
              <Award size={16} className="text-muted-foreground opacity-60 shrink-0" />
              {stats.longestStreak}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">最长连续</div>
          </div>
        </div>
      </div>

      {/* Calendar Section */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            {currentMonth.format("YYYY年 M月")} 打卡记录
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onSelectDate(todayStr)}
              className="px-2 py-0.5 text-xs rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors font-medium cursor-pointer mr-1"
              title="跳转到今日"
            >
              今天
            </button>
            <button
              type="button"
              onClick={() => {
                const prev = currentMonth.subtract(1, "month");
                if (prev.format("YYYY-MM") >= "2026-01") {
                  onSelectDate(prev.format("YYYY-MM-DD"));
                }
              }}
              disabled={currentMonth.format("YYYY-MM") <= "2026-01"}
              className="p-1 rounded hover:bg-accent text-muted-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              title="上个月"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => {
                const next = currentMonth.add(1, "month");
                if (next.format("YYYY-MM") <= todayMonthStr) {
                  onSelectDate(next.format("YYYY-MM-DD"));
                }
              }}
              disabled={currentMonth.format("YYYY-MM") >= todayMonthStr}
              className="p-1 rounded hover:bg-accent text-muted-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              title="下个月"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-3 shadow-2xs">
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground font-medium mb-1">
            {WEEK_DAYS.map((w) => (
              <div key={w} className="py-1">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {days.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} className="h-8" />;
              const dStr = day.format("YYYY-MM-DD");
              const isDisabled = dStr > todayStr;
              const review = reviews.find((r) => r.date === dStr);
              
              let levelClass = "bg-transparent text-foreground hover:bg-accent";
              if (review && review.content.trim().length > 0) {
                const len = review.content.trim().length;
                if (len > 200) {
                  levelClass = "bg-emerald-700 text-white font-bold dark:bg-emerald-600";
                } else if (len > 100) {
                  levelClass = "bg-emerald-500 text-white font-semibold dark:bg-emerald-500";
                } else if (len > 30) {
                  levelClass = "bg-emerald-300 text-emerald-950 font-semibold dark:bg-emerald-700 dark:text-emerald-100";
                } else {
                  levelClass = "bg-emerald-100 text-emerald-800 font-semibold dark:bg-emerald-950 dark:text-emerald-300";
                }
              }

              const isSelected = dStr === selectedDate;
              return (
                <button
                  key={dStr}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => !isDisabled && onSelectDate(dStr)}
                  className={`h-8 rounded-lg flex items-center justify-center text-xs font-medium transition-all border ${
                    isDisabled
                      ? "opacity-30 cursor-not-allowed border-transparent bg-muted/30"
                      : isSelected
                      ? "ring-2 ring-blue-500 ring-offset-1 border-blue-400 font-bold z-10 cursor-pointer"
                      : "border-transparent cursor-pointer"
                  } ${levelClass}`}
                >
                  <span>{day.date()}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-1 mt-3 text-[10px] text-muted-foreground">
          <span>少</span>
          <div className="w-2.5 h-2.5 rounded-2xs bg-card border border-border"></div>
          <div className="w-2.5 h-2.5 rounded-2xs bg-emerald-100 dark:bg-emerald-950"></div>
          <div className="w-2.5 h-2.5 rounded-2xs bg-emerald-300 dark:bg-emerald-700"></div>
          <div className="w-2.5 h-2.5 rounded-2xs bg-emerald-500"></div>
          <div className="w-2.5 h-2.5 rounded-2xs bg-emerald-700 dark:bg-emerald-600"></div>
          <span>多</span>
        </div>
      </div>
    </div>
  );
});

CompoundStats.displayName = "CompoundStats";

// ==========================================
// 3. DailyReviewPanel Main Component
// ==========================================
export const DailyReviewPanel: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(todayYMD());

  const { data } = useDailyReviewData();
  const reviewsData = data ?? EMPTY_REVIEWS;
  const { saveReview } = useReviewActions();

  const reviews = useMemo(() => getAllReviews(reviewsData), [reviewsData]);
  const stats = useMemo(() => getCompoundStats(reviewsData), [reviewsData]);
  const currentReview = useMemo(
    () => getReviewByDate(reviewsData, selectedDate),
    [reviewsData, selectedDate]
  );

  const handleSave = useCallback((date: string, content: string) => {
    saveReview(date, content);
  }, [saveReview]);

  const handleSelectDate = useCallback((date: string) => {
    setSelectedDate(date);
  }, []);

  const changeDate = useCallback((days: number) => {
    setSelectedDate((prevSelected) => {
      const [y, m, d_val] = prevSelected.split("-").map(Number);
      const d = new Date(y, m - 1, d_val);
      d.setDate(d.getDate() + days);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (d > today) return prevSelected;

      const minDate = new Date(2026, 0, 1);
      minDate.setHours(0, 0, 0, 0);
      if (d < minDate) return prevSelected;

      return formatDateYMD(d);
    });
  }, []);

  const isCurrentToday = selectedDate === todayYMD();

  return (
    <div className="flex flex-col h-full w-full bg-background text-foreground overflow-hidden">
      {/* Top Bar: Date Navigation */}
      <div className="flex items-center justify-center px-6 py-3 bg-card border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer" 
            onClick={() => changeDate(-1)} 
            title="前一天"
            disabled={selectedDate <= MIN_DATE}
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-base font-semibold tracking-tight text-foreground">
            {formatDateDisplay(selectedDate)}
          </span>
          {isCurrentToday ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-medium">
              今天
            </span>
          ) : (
            <button
              type="button"
              className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-medium hover:bg-accent/80 transition-colors cursor-pointer"
              onClick={() => setSelectedDate(todayYMD())}
              title="回到今天"
            >
              回到今天
            </button>
          )}
          <button
            type="button"
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            onClick={() => changeDate(1)}
            title="后一天"
            disabled={isCurrentToday}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Main Layout: Left Editor + Right Stats */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: Editor */}
        <div className="flex-1 flex flex-col p-4 md:p-5 min-w-0 overflow-hidden">
          <ReviewEditor 
            key={`${selectedDate}-${currentReview?.id || "new"}`}
            date={selectedDate} 
            review={currentReview} 
            onSave={handleSave}
          />
        </div>

        {/* Right: Stats + Calendar */}
        <div className="w-72 md:w-80 shrink-0 border-l border-border bg-card/40 overflow-y-auto">
          <CompoundStats 
            stats={stats} 
            reviews={reviews} 
            onSelectDate={handleSelectDate}
            selectedDate={selectedDate}
          />
        </div>
      </div>
    </div>
  );
};
