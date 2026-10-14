import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import {
  Plus,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
  Check,
  Activity,
  BookOpen,
  Heart,
  Smile,
  Calendar,
  CheckCircle2,
  Flame,
  Award,
  RotateCcw,
} from "lucide-react";
import { useHabitData, useHabitActions } from "../hooks/useHabits";
import { Habit, HabitCheckIn, HabitStats } from "../types";
import { formatDateYMD, todayYMD } from "@/lib/dateUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Item, ItemAvatar, ItemContent, ItemTitle, ItemDescription, ItemActions } from "@/components/ui/item";
import { DatePicker } from "@/components/ui/date-picker";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { cn } from "@/lib/utils";

import {
  PixelFlame,
  PixelTrophy,
  PixelPotion,
  PixelSparkle,
  PixelDumbbell,
  PixelBook,
  PixelLotus,
  PixelSlime,
} from "@/components/pixel/PixelIcons";
import {
  ExpParticleContainer,
  ExpParticleItem,
} from "@/components/pixel/ExpParticle";
import {
  PixelAchievementHall,
  getLevelInfo,
} from "@/components/pixel/PixelBadge";
import {
  getHabitsForDate,
  getCheckInStatus,
  getHabitStats,
} from "../utils/habitSelectors";

// ============================================================
// Constants
// ============================================================
const WEEK_DAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"] as const;
const SHORT_WEEK_DAYS = ["一", "二", "三", "四", "五", "六", "日"] as const;
const EMPTY_HABITS: Habit[] = [];
const EMPTY_CHECKINS: HabitCheckIn[] = [];

const FREQUENCY_OPTIONS = [
  { value: "daily", label: "每天" },
  { value: "weekly_days", label: "每周" },
] as const;

const GOAL_OPTIONS = [
  { value: "today", label: "当天完成打卡" },
] as const;

const DURATION_OPTIONS = [
  { value: "7days", label: "7天" },
  { value: "30days", label: "30天" },
  { value: "60days", label: "60天" },
  { value: "forever", label: "永远" },
  { value: "custom", label: "自定义" },
] as const;

const GROUP_OPTIONS = [
  { value: "body", label: "身体" },
  { value: "spirit", label: "精神" },
  { value: "intellect", label: "智力" },
  { value: "emotion", label: "情感" },
] as const;

const STAT_CARDS: {
  icon: React.FC<{ size?: number; className?: string }>;
  bgClass: string;
  textClass: string;
  key: keyof HabitStats & string;
  label: string;
  suffix?: string;
}[] = [
  {
    icon: PixelPotion,
    bgClass: "bg-emerald-100/90 dark:bg-emerald-950/40 border border-emerald-600/30",
    textClass: "text-emerald-700 dark:text-emerald-300",
    key: "monthCheckIns",
    label: "本月完成/天",
  },
  {
    icon: PixelTrophy,
    bgClass: "bg-amber-100/90 dark:bg-amber-950/40 border border-amber-600/30",
    textClass: "text-amber-700 dark:text-amber-300",
    key: "totalCheckIns",
    label: "累计经验/次",
  },
  {
    icon: PixelFlame,
    bgClass: "bg-orange-100/90 dark:bg-orange-950/40 border border-orange-600/30",
    textClass: "text-orange-700 dark:text-orange-300",
    key: "currentStreak",
    label: "连续天数/连击",
  },
  {
    icon: PixelSparkle,
    bgClass: "bg-indigo-100/90 dark:bg-indigo-950/40 border border-indigo-600/30",
    textClass: "text-indigo-700 dark:text-indigo-300",
    key: "monthlyCompletionRate",
    label: "本月达成率",
    suffix: "%",
  },
];

const getDaysAround = (offsetDays = 0) => {
  const base = new Date();
  base.setDate(base.getDate() + offsetDays);
  const days = [];
  for (let i = -6; i <= 0; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    days.push({
      dateStr: formatDateYMD(d),
      dayNum: d.getDate(),
      dayOfWeek: d.getDay(),
    });
  }
  return days;
};

const parseDuration = (raw: string): { duration: string; customDays: string } => {
  if (!raw || ["7days", "30days", "60days", "21days", "forever"].includes(raw)) {
    return { duration: raw || "30days", customDays: "14" };
  }
  const match = raw.match(/^custom:(\d+)$/);
  return match
    ? { duration: "custom", customDays: match[1] }
    : { duration: "custom", customDays: raw.replace(/\D/g, "") || "14" };
};

// ============================================================
// Shared UI Components: Adaptive Avatar (Modern vs Pixel)
// ============================================================
const HabitAvatar: React.FC<{
  category?: string;
  size?: "sm" | "md" | "lg";
}> = ({ category = "emotion", size = "md" }) => {
  const { isPixelTheme } = useAppThemeStyle();
  const sizeMap = { sm: 18, md: 22, lg: 26 };
  const containerMap = { sm: "w-9 h-9", md: "w-11 h-11", lg: "w-13 h-13" };

  if (isPixelTheme) {
    const renderPixelIcon = () => {
      switch (category) {
        case "body":
          return <PixelDumbbell size={sizeMap[size]} />;
        case "intellect":
          return <PixelBook size={sizeMap[size]} />;
        case "spirit":
          return <PixelLotus size={sizeMap[size]} />;
        case "emotion":
        default:
          return <PixelSlime size={sizeMap[size]} />;
      }
    };

    return (
      <div
        className={`${containerMap[size]} rounded-xs bg-amber-50/90 dark:bg-amber-950/40 flex items-center justify-center shrink-0 border-2 border-amber-900/60 dark:border-amber-700/60 shadow-[2px_2px_0px_rgba(120,53,15,0.4)] transition-transform hover:scale-105 duration-200 select-none`}
      >
        {renderPixelIcon()}
      </div>
    );
  }

  // Modern Default Style
  const renderModernIcon = () => {
    switch (category) {
      case "body":
        return <Activity size={sizeMap[size]} className="text-rose-500" />;
      case "intellect":
        return <BookOpen size={sizeMap[size]} className="text-blue-500" />;
      case "spirit":
        return <Heart size={sizeMap[size]} className="text-purple-500" />;
      case "emotion":
      default:
        return <Smile size={sizeMap[size]} className="text-emerald-500" />;
    }
  };

  return (
    <div
      className={`${containerMap[size]} rounded-full bg-muted/60 dark:bg-muted/30 flex items-center justify-center shrink-0 border border-border transition-transform hover:scale-105 duration-200 select-none shadow-xs`}
    >
      {renderModernIcon()}
    </div>
  );
};

// ============================================================
// Sub-component: DateSwitcher (With weekly pagination support)
// ============================================================
interface DateSwitcherProps {
  currentDate: string;
  onChange: (date: string) => void;
}

const DateSwitcher: React.FC<DateSwitcherProps> = memo(({ currentDate, onChange }) => {
  const { isPixelTheme } = useAppThemeStyle();
  const [offsetDays, setOffsetDays] = useState(0);

  const days = useMemo(() => getDaysAround(offsetDays), [offsetDays]);
  const isViewingHistory = offsetDays !== 0;

  const handlePrevWeek = () => setOffsetDays((prev) => prev - 7);
  const handleNextWeek = () => setOffsetDays((prev) => Math.min(0, prev + 7));
  const handleResetToday = () => {
    setOffsetDays(0);
    onChange(todayYMD());
  };

  return (
    <header
      className={cn(
        "flex h-14 items-center justify-between px-2 md:px-3 bg-card border-b select-none shrink-0 gap-1",
        isPixelTheme
          ? "border-b-2 border-border/90 font-mono shadow-[0_2px_0px_rgba(0,0,0,0.04)]"
          : "border-border"
      )}
    >
      <button
        type="button"
        onClick={handlePrevWeek}
        className={cn(
          "p-1.5 transition-colors cursor-pointer text-muted-foreground hover:text-foreground shrink-0",
          isPixelTheme ? "rounded-xs hover:bg-amber-100/60 dark:hover:bg-amber-950/60" : "rounded-lg hover:bg-accent"
        )}
        title="上一周"
        aria-label="上一周"
      >
        <ChevronLeft size={16} />
      </button>

      <div className="flex items-center gap-1.5 sm:gap-2 flex-1 justify-between overflow-x-auto hide-scrollbar">
        {days.map((d) => {
          const isSelected = d.dateStr === currentDate;

          return (
            <button
              key={d.dateStr}
              type="button"
              onClick={() => onChange(d.dateStr)}
              className={cn(
                "flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-lg cursor-pointer transition-all duration-150 outline-none select-none min-w-[36px]",
                isPixelTheme
                  ? isSelected
                    ? "rounded-xs bg-amber-200 dark:bg-amber-900/80 text-amber-950 dark:text-amber-100 border border-amber-900/70 dark:border-amber-600 shadow-[1px_1px_0px_#000] font-bold"
                    : "rounded-xs hover:bg-amber-100/50 dark:hover:bg-amber-950/40 text-muted-foreground hover:text-foreground"
                  : isSelected
                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold shadow-2xs border border-blue-500/20"
                  : "hover:bg-accent/60 text-muted-foreground hover:text-foreground border border-transparent"
              )}
            >
              <span
                className={cn(
                  "text-[11px] leading-tight transition-colors",
                  isPixelTheme ? "font-mono font-bold text-[10px]" : "font-medium",
                  isSelected
                    ? isPixelTheme
                      ? "text-amber-950 dark:text-amber-100 font-black"
                      : "text-blue-600 dark:text-blue-400 font-semibold"
                    : ""
                )}
              >
                {WEEK_DAYS[d.dayOfWeek]}
              </span>
              <span
                className={cn(
                  "text-sm font-bold leading-tight mt-0.5",
                  isPixelTheme && "font-mono font-black text-xs",
                  isSelected && !isPixelTheme && "text-blue-600 dark:text-blue-400"
                )}
              >
                {d.dayNum}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={handleNextWeek}
          disabled={offsetDays >= 0}
          className={cn(
            "p-1.5 transition-colors cursor-pointer text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed",
            isPixelTheme ? "rounded-xs hover:bg-amber-100/60 dark:hover:bg-amber-950/60" : "rounded-lg hover:bg-accent"
          )}
          title="下一周"
          aria-label="下一周"
        >
          <ChevronRight size={16} />
        </button>
        {isViewingHistory && (
          <button
            type="button"
            onClick={handleResetToday}
            className={cn(
              "px-1.5 py-1 text-[11px] font-medium transition-colors cursor-pointer text-primary hover:text-primary/80 flex items-center gap-0.5",
              isPixelTheme ? "font-mono font-bold" : ""
            )}
            title="回到今天"
          >
            <RotateCcw size={12} />
            <span className="hidden sm:inline">今天</span>
          </button>
        )}
      </div>
    </header>
  );
});
DateSwitcher.displayName = "DateSwitcher";

// ============================================================
// Sub-component: OverviewCards (Modern / 8-bit Adaptive)
// ============================================================
const OverviewCards: React.FC<{ habit: Habit; currentDate: string }> = memo(({ habit, currentDate }) => {
  const { isPixelTheme } = useAppThemeStyle();
  const { data } = useHabitData();
  const checkIns = data?.checkIns ?? EMPTY_CHECKINS;
  const stats = useMemo(() => getHabitStats(checkIns, habit.id, currentDate), [checkIns, habit.id, currentDate]);
  const levelInfo = useMemo(() => getLevelInfo(stats.totalCheckIns), [stats.totalCheckIns]);

  if (!isPixelTheme) {
    // Modern Default Style
    return (
      <div className="grid grid-cols-2 gap-3 w-full">
        <div className="bg-card rounded-xl p-3.5 shadow-2xs border border-border flex items-center gap-3 transition-transform hover:-translate-y-0.5 duration-200">
          <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-500 dark:text-blue-400 shrink-0">
            <Calendar size={20} />
          </div>
          <div>
            <div className="text-xl font-bold text-foreground tabular-nums">{stats.monthCheckIns}</div>
            <div className="text-xs text-muted-foreground font-medium">本月完成/天</div>
          </div>
        </div>

        <div className="bg-card rounded-xl p-3.5 shadow-2xs border border-border flex items-center gap-3 transition-transform hover:-translate-y-0.5 duration-200">
          <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-500 dark:text-emerald-400 shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div className="text-xl font-bold text-foreground tabular-nums">{stats.totalCheckIns}</div>
            <div className="text-xs text-muted-foreground font-medium">累计完成/天</div>
          </div>
        </div>

        <div className="bg-card rounded-xl p-3.5 shadow-2xs border border-border flex items-center gap-3 transition-transform hover:-translate-y-0.5 duration-200">
          <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-950/40 flex items-center justify-center text-orange-500 dark:text-orange-400 shrink-0">
            <Flame size={20} />
          </div>
          <div>
            <div className="text-xl font-bold text-foreground tabular-nums">{stats.currentStreak}</div>
            <div className="text-xs text-muted-foreground font-medium">当前连续/天</div>
          </div>
        </div>

        <div className="bg-card rounded-xl p-3.5 shadow-2xs border border-border flex items-center gap-3 transition-transform hover:-translate-y-0.5 duration-200">
          <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-500 dark:text-indigo-400 shrink-0">
            <Award size={20} />
          </div>
          <div>
            <div className="text-xl font-bold text-foreground tabular-nums">{stats.monthlyCompletionRate}%</div>
            <div className="text-xs text-muted-foreground font-medium">本月完成率</div>
          </div>
        </div>
      </div>
    );
  }

  // 8-bit Pixel RPG Adventure Style
  return (
    <div className="flex flex-col gap-3 w-full font-mono">
      {/* Adventurer Level & EXP Bar */}
      <div className="bg-amber-50/90 dark:bg-amber-950/40 border-2 border-amber-900/60 dark:border-amber-700/60 rounded-xs p-3 shadow-[2px_2px_0px_#000] select-none">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-xs bg-amber-200 dark:bg-amber-900 text-amber-950 dark:text-amber-100 font-mono text-xs font-black border border-amber-900/60 shadow-[1px_1px_0px_#000]">
              Lv.{levelInfo.level}
            </span>
            <span className="text-xs font-bold text-amber-950 dark:text-amber-200">
              {levelInfo.title}
            </span>
          </div>
          <span className="text-[11px] font-mono font-bold text-amber-800 dark:text-amber-400">
            EXP: {levelInfo.currentLevelExp}%
          </span>
        </div>

        {/* 8-bit Segmented Progress Bar */}
        <div className="w-full h-3 bg-amber-200/80 dark:bg-amber-900/60 border-2 border-amber-900/60 rounded-xs overflow-hidden p-[1px]">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500 rounded-xs"
            style={{ width: `${Math.max(5, levelInfo.currentLevelExp)}%` }}
          />
        </div>
      </div>

      {/* 4 RPG Stats Grid */}
      <div className="grid grid-cols-2 gap-2.5 w-full">
        {STAT_CARDS.map(({ icon: Icon, bgClass, textClass, key, label, suffix }) => (
          <div
            key={key}
            className="bg-card rounded-xs p-3 shadow-[2px_2px_0px_#000] border-2 border-border/90 flex items-center gap-2.5 transition-transform hover:-translate-y-0.5 duration-200"
          >
            <div className={`w-9 h-9 rounded-xs ${bgClass} flex items-center justify-center ${textClass} shrink-0 shadow-[1px_1px_0px_#000]`}>
              <Icon size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-black text-foreground tabular-nums font-mono leading-tight">
                {stats[key]}{suffix}
              </div>
              <div className="text-[10px] text-muted-foreground font-semibold truncate">{label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
OverviewCards.displayName = "OverviewCards";

// ============================================================
// Sub-component: CalendarHeatmapComponent (Interactive Check-In)
// ============================================================
interface CalendarHeatmapComponentProps {
  habit: Habit;
  onToggleCheckIn?: (dateStr: string, completed: boolean) => void;
  onSelectDate?: (dateStr: string) => void;
  currentSelectedDate?: string;
}

const CalendarHeatmapComponent: React.FC<CalendarHeatmapComponentProps> = memo(({
  habit,
  onToggleCheckIn,
  onSelectDate,
  currentSelectedDate,
}) => {
  const { isPixelTheme } = useAppThemeStyle();
  const { data } = useHabitData();
  const checkIns = data?.checkIns ?? EMPTY_CHECKINS;
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const checkedInDates = useMemo(() => {
    const set = new Set<string>();
    checkIns.forEach((ci) => {
      if (ci.habitId === habit.id && ci.completed) set.add(ci.date);
    });
    return set;
  }, [checkIns, habit.id]);

  const daysInMonth = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    let startingDay = firstDay.getDay() - 1;
    if (startingDay === -1) startingDay = 6;

    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevMonthTotalDays = new Date(year, month, 0).getDate();

    const days = [];
    for (let i = 0; i < startingDay; i++) {
      days.push({
        date: new Date(year, month - 1, prevMonthTotalDays - startingDay + i + 1),
        isCurrentMonth: false,
      });
    }
    for (let i = 1; i <= totalDays; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }
    const remainingCells = 42 - days.length;
    for (let i = 1; i <= remainingCells; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }
    return days;
  }, [currentMonth]);

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const handleDayClick = (d: Date) => {
    const dStr = formatDateYMD(d);
    onSelectDate?.(dStr);
    const isDone = checkedInDates.has(dStr);
    onToggleCheckIn?.(dStr, !isDone);
  };

  return (
    <div className="w-full flex flex-col items-center select-none">
      <div className="flex items-center justify-between w-full mb-3 px-1">
        <button
          type="button"
          onClick={handlePrevMonth}
          className={cn(
            "p-1.5 transition-colors cursor-pointer text-muted-foreground hover:text-foreground",
            isPixelTheme
              ? "rounded-xs border border-border bg-muted/40 hover:bg-muted shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
              : "rounded-lg hover:bg-accent"
          )}
          title="上个月"
          aria-label="上个月"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
          {isPixelTheme && <PixelSparkle size={14} />}
          <span className={isPixelTheme ? "font-mono font-bold" : ""}>
            {currentMonth.getFullYear()}年{currentMonth.getMonth() + 1}月 {isPixelTheme ? "📜 修炼打卡月历" : "打卡日历"}
          </span>
        </div>
        <button
          type="button"
          onClick={handleNextMonth}
          className={cn(
            "p-1.5 transition-colors cursor-pointer text-muted-foreground hover:text-foreground",
            isPixelTheme
              ? "rounded-xs border border-border bg-muted/40 hover:bg-muted shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
              : "rounded-lg hover:bg-accent"
          )}
          title="下个月"
          aria-label="下个月"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 w-full text-center gap-1.5">
        {SHORT_WEEK_DAYS.map((day) => (
          <div key={day} className={cn("text-[11px] text-muted-foreground font-medium mb-1", isPixelTheme && "font-mono font-bold")}>{day}</div>
        ))}

        {daysInMonth.map((dayInfo, idx) => {
          const dateStr = formatDateYMD(dayInfo.date);
          const checkedIn = checkedInDates.has(dateStr);
          const today = isToday(dayInfo.date);
          const isSelected = dateStr === currentSelectedDate;

          if (!isPixelTheme) {
            // Modern Style
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleDayClick(dayInfo.date)}
                className="flex flex-col items-center justify-center gap-1 group cursor-pointer outline-none transition-transform hover:scale-105 active:scale-95"
                title={`${dateStr} (点击${checkedIn ? "取消打卡" : "标记完成"})`}
              >
                <span
                  className={`text-xs font-medium transition-colors ${
                    !dayInfo.isCurrentMonth
                      ? "text-muted-foreground/30"
                      : isSelected
                      ? "text-blue-600 dark:text-blue-400 font-bold"
                      : today
                      ? "text-blue-500 font-bold"
                      : "text-foreground"
                  }`}
                >
                  {dayInfo.date.getDate()}
                </span>
                <div
                  className={`w-5 h-5 rounded-full transition-all duration-300 flex items-center justify-center ${
                    checkedIn ? "bg-emerald-500 text-white shadow-xs shadow-emerald-500/50" : "bg-muted/50 hover:bg-muted"
                  } ${isSelected ? "ring-2 ring-blue-500 ring-offset-1" : today ? "ring-2 ring-blue-400/60 ring-offset-1" : ""}`}
                >
                  {checkedIn && <Check size={12} className="stroke-[3]" />}
                </div>
              </button>
            );
          }

          // Pixel Grass Style
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleDayClick(dayInfo.date)}
              className="flex flex-col items-center justify-center gap-0.5 group cursor-pointer outline-none transition-transform hover:scale-105 active:scale-95"
              title={`${dateStr}: ${checkedIn ? "打卡成功 ✨ (点击反转)" : "未打卡 (点击补卡)"}`}
            >
              <span
                className={`text-[10px] font-mono font-medium transition-colors ${
                  !dayInfo.isCurrentMonth
                    ? "text-muted-foreground/30"
                    : isSelected
                    ? "text-amber-600 dark:text-amber-400 font-black"
                    : today
                    ? "text-amber-500 font-black"
                    : "text-muted-foreground"
                }`}
              >
                {dayInfo.date.getDate()}
              </span>
              <div
                className={`w-6 h-6 rounded-xs transition-all duration-200 flex items-center justify-center ${
                  checkedIn
                    ? "bg-emerald-500 text-white font-bold border-2 border-emerald-700 shadow-[1px_1px_0px_#064e3b] scale-105"
                    : "bg-muted/40 border border-border/80 rounded-xs hover:border-amber-700/60"
                } ${isSelected ? "ring-2 ring-amber-500 ring-offset-1" : today ? "ring-2 ring-amber-400/70 ring-offset-1" : ""}`}
              >
                {checkedIn && <Check size={13} className="stroke-[3]" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});
CalendarHeatmapComponent.displayName = "CalendarHeatmapComponent";

// ============================================================
// Sub-component: CreateEditModal
// ============================================================
interface CreateEditModalProps {
  visible: boolean;
  onCancel: () => void;
  onSubmit: (data: Partial<Habit>) => Promise<void>;
  initialData?: Habit | null;
}

const CreateEditModal: React.FC<CreateEditModalProps> = memo(({
  visible,
  onCancel,
  onSubmit,
  initialData,
}) => {
  const { isPixelTheme } = useAppThemeStyle();
  const [name, setName] = useState("");
  const [frequencyType, setFrequencyType] = useState<"daily" | "weekly_days" | "custom">("daily");
  const [goal, setGoal] = useState("today");
  const [duration, setDuration] = useState("30days");
  const [customDays, setCustomDays] = useState("14");
  const [category, setCategory] = useState("body");
  const [autoPopupLog, setAutoPopupLog] = useState(false);
  const [checkInTime, setCheckInTime] = useState("08:00:00");
  const [startDate, setStartDate] = useState(todayYMD());
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (visible && initialData) {
      const parsed = parseDuration(initialData.duration || "30days");
      setName(initialData.name || "");
      setFrequencyType(initialData.frequencyType || "daily");
      setGoal(initialData.goal || "today");
      setDuration(parsed.duration);
      setCustomDays(parsed.customDays);
      setCategory(initialData.category || "body");
      setAutoPopupLog(initialData.autoPopupLog || false);
      const reminderTime = initialData.reminder || initialData.checkInTime || "08:00:00";
      setCheckInTime(reminderTime);
      setStartDate(initialData.startDate || todayYMD());
      setErrorMsg("");
    } else if (visible) {
      setName("");
      setFrequencyType("daily");
      setGoal("today");
      setDuration("30days");
      setCustomDays("14");
      setCategory("body");
      setAutoPopupLog(false);
      setCheckInTime("08:00:00");
      setStartDate(todayYMD());
      setErrorMsg("");
    }
  }, [visible, initialData]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setErrorMsg(isPixelTheme ? "请填写修行契约名称" : "请输入习惯名称");
      return;
    }

    const finalDuration = duration === "custom" ? `custom:${customDays || "14"}` : duration;
    const finalReminder = autoPopupLog ? checkInTime : undefined;

    await onSubmit({
      name: name.trim(),
      frequencyType,
      goal,
      duration: finalDuration,
      category,
      autoPopupLog,
      reminder: finalReminder,
      checkInTime: finalReminder || "08:00:00",
      startDate: startDate || undefined,
    });
    onCancel();
  };

  return (
    <Modal
      visible={visible}
      title={
        <div className="flex items-center gap-2">
          <PixelSparkle size={18} />
          <span className={isPixelTheme ? "font-mono font-bold" : ""}>
            {isPixelTheme
              ? initialData
                ? "📜 冒险修行契约编辑"
                : "✨ 订立新自律修行"
              : initialData
              ? "编辑习惯"
              : "添加新习惯"}
          </span>
        </div>
      }
      onCancel={onCancel}
      onOk={handleSubmit}
      okText={isPixelTheme ? "刻印契约" : "保存"}
      cancelText={isPixelTheme ? "放弃" : "取消"}
      width={480}
    >
      <div className={`space-y-4 py-2 text-foreground ${isPixelTheme ? "font-mono" : ""}`}>
        <div className="grid grid-cols-[80px_minmax(0,1fr)] items-center gap-3">
          <label className="text-sm font-medium text-muted-foreground text-right">
            {isPixelTheme ? "修行科目" : "习惯名称"}
          </label>
          <div className="w-full">
            <Input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errorMsg) setErrorMsg("");
              }}
              placeholder={isPixelTheme ? "例：每日研读魔法典籍30分钟" : "习惯名称（例：每天阅读30分钟）"}
              className={`h-9 ${errorMsg ? "border-destructive bg-destructive/10" : ""}`}
            />
            {errorMsg && <p className="text-xs text-destructive mt-1 pl-1">{errorMsg}</p>}
          </div>
        </div>

        <div className="grid grid-cols-[80px_minmax(0,1fr)] items-center gap-3">
          <label className="text-sm font-medium text-muted-foreground text-right">
            {isPixelTheme ? "修炼周期" : "频率"}
          </label>
          <Select
            value={frequencyType}
            onChange={(val) => setFrequencyType(val as "daily" | "weekly_days" | "custom")}
            options={FREQUENCY_OPTIONS as unknown as { value: string; label: string }[]}
            className="w-full"
          />
        </div>

        <div className="grid grid-cols-[80px_minmax(0,1fr)] items-center gap-3">
          <label className="text-sm font-medium text-muted-foreground text-right">
            {isPixelTheme ? "今日指标" : "目标"}
          </label>
          <Select
            value={goal}
            onChange={(val) => setGoal(val)}
            options={GOAL_OPTIONS as unknown as { value: string; label: string }[]}
            className="w-full"
          />
        </div>

        <div className="grid grid-cols-[80px_minmax(0,1fr)] items-center gap-3">
          <label className="text-sm font-medium text-muted-foreground text-right">
            {isPixelTheme ? "启程之日" : "开始日期"}
          </label>
          <div className="w-full">
            <DatePicker
              value={startDate}
              onChange={setStartDate}
              placeholder={isPixelTheme ? "选择启程之日" : "选择开始日期"}
            />
          </div>
        </div>

        <div className="grid grid-cols-[80px_minmax(0,1fr)] items-center gap-3">
          <label className="text-sm font-medium text-muted-foreground text-right">
            {isPixelTheme ? "誓约历程" : "坚持时间"}
          </label>
          <div className="flex items-center gap-2">
            <Select
              value={duration}
              onChange={(val) => setDuration(val)}
              options={DURATION_OPTIONS as unknown as { value: string; label: string }[]}
              className="flex-1"
            />
            {duration === "custom" && (
              <div className="flex items-center gap-1 shrink-0">
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                  className="w-20 h-9"
                />
                <span className="text-sm text-muted-foreground">天</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-[80px_minmax(0,1fr)] items-center gap-3">
          <label className="text-sm font-medium text-muted-foreground text-right">
            {isPixelTheme ? "所属派系" : "所属分组"}
          </label>
          <Select
            value={category}
            onChange={(val) => setCategory(val)}
            options={GROUP_OPTIONS as unknown as { value: string; label: string }[]}
            className="w-full"
          />
        </div>

        <div className="grid grid-cols-[80px_minmax(0,1fr)] items-center gap-3 pt-1">
          <div />
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-foreground">
            <input
              type="checkbox"
              checked={autoPopupLog}
              onChange={(e) => setAutoPopupLog(e.target.checked)}
              className="w-4 h-4 rounded border-input text-amber-600 focus:ring-amber-500"
            />
            <span>{isPixelTheme ? "开启冒险助手系统传讯" : "自动触发桌面系统提醒"}</span>
          </label>
        </div>

        {autoPopupLog && (
          <div className="grid grid-cols-[80px_minmax(0,1fr)] items-center gap-3">
            <label className="text-sm font-medium text-muted-foreground text-right">
              {isPixelTheme ? "传讯时刻" : "提醒时间"}
            </label>
            <Input
              type="time"
              step="1"
              value={checkInTime}
              onChange={(e) => setCheckInTime(e.target.value)}
              className="w-full h-9"
            />
          </div>
        )}
      </div>
    </Modal>
  );
});
CreateEditModal.displayName = "CreateEditModal";

// ============================================================
// Sub-component: HabitDetailSidebar
// ============================================================
interface HabitDetailSidebarProps {
  habit: Habit | null;
  currentDate: string;
  onEditHabit: (habit: Habit) => void;
  onDeleteHabit: (habitId: string, habitName: string) => void;
  onToggleCheckIn: (dateStr: string, completed: boolean) => void;
  onSelectDate: (dateStr: string) => void;
}

const HabitDetailSidebar: React.FC<HabitDetailSidebarProps> = memo(({
  habit,
  currentDate,
  onEditHabit,
  onDeleteHabit,
  onToggleCheckIn,
  onSelectDate,
}) => {
  const { isPixelTheme } = useAppThemeStyle();
  const { data } = useHabitData();
  const checkIns = data?.checkIns ?? EMPTY_CHECKINS;
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const stats = useMemo(() => {
    if (!habit) return null;
    return getHabitStats(checkIns, habit.id, currentDate);
  }, [checkIns, habit, currentDate]);

  if (!habit || !stats) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground select-none">
        {isPixelTheme ? (
          <div className="w-12 h-12 rounded-xs bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-900/60 flex items-center justify-center text-muted-foreground mb-3 shadow-[2px_2px_0px_#000]">
            <PixelSparkle size={24} />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
            <Calendar size={24} />
          </div>
        )}
        <h4 className="text-sm font-semibold text-foreground mb-1">
          {isPixelTheme ? "未选定修行契约" : "暂未选中习惯"}
        </h4>
        <p className="text-xs text-muted-foreground max-w-[200px]">
          {isPixelTheme ? "点击左侧修行契约，查阅修炼档案与历程" : "请在左侧选择习惯查看详细打卡统计与月历"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden select-none">
      {/* Sidebar Header */}
      <header
        className={cn(
          "flex h-14 items-center justify-between px-4 md:px-5 shrink-0 border-b",
          isPixelTheme
            ? "border-b-2 border-border/90 bg-amber-50/60 dark:bg-amber-950/40 font-mono"
            : "border-border bg-card/60"
        )}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
          <HabitAvatar category={habit.category} size="sm" />
          <div className="min-w-0 flex-1">
            <h2 className={cn("text-sm font-bold text-foreground truncate", isPixelTheme && "font-mono")}>
              {habit.name}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-muted-foreground">
                {habit.frequencyType === "daily" ? "每天" : "每周"}
              </span>
              <span className="text-[11px] text-muted-foreground">•</span>
              <span className="text-[11px] text-muted-foreground">
                {habit.duration === "forever"
                  ? "永远"
                  : habit.duration?.startsWith("custom:")
                  ? `${habit.duration.replace("custom:", "")}天`
                  : habit.duration?.replace("days", "天") || "30天"}
              </span>
            </div>
          </div>
        </div>

        {/* Actions Menu */}
        <div className="flex items-center gap-1 shrink-0 relative">
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={cn(
              "p-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer outline-none",
              isPixelTheme
                ? "rounded-xs hover:bg-amber-100/60 dark:hover:bg-amber-950/60"
                : "rounded-lg hover:bg-accent"
            )}
            title="更多操作"
            aria-label="更多操作"
          >
            <MoreHorizontal size={18} />
          </button>
          {isMenuOpen && (
            <div
              className={cn(
                "absolute right-0 top-9 w-32 bg-card border p-1 z-50",
                isPixelTheme
                  ? "rounded-xs shadow-[3px_3px_0px_#000] border-2 border-border font-mono"
                  : "rounded-xl shadow-lg border-border"
              )}
            >
              <button
                type="button"
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground cursor-pointer text-left",
                  isPixelTheme
                    ? "rounded-xs hover:bg-amber-100 dark:hover:bg-amber-950/80 font-mono font-bold"
                    : "rounded-lg hover:bg-accent"
                )}
                onClick={() => {
                  setIsMenuOpen(false);
                  onEditHabit(habit);
                }}
              >
                <Edit2 size={13} /> 编辑
              </button>
              <button
                type="button"
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-destructive cursor-pointer text-left",
                  isPixelTheme
                    ? "rounded-xs hover:bg-destructive/20 font-mono font-bold"
                    : "rounded-lg hover:bg-destructive/10"
                )}
                onClick={() => {
                  setIsMenuOpen(false);
                  onDeleteHabit(habit.id, habit.name);
                }}
              >
                <Trash2 size={13} /> 删除
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Sidebar Content (Scrollable) */}
      <div className={cn("flex-1 flex flex-col p-4 gap-4 overflow-y-auto no-scrollbar", isPixelTheme && "font-mono")}>
        <div className="shrink-0">
          <OverviewCards habit={habit} currentDate={currentDate} />
        </div>

        <div
          className={cn(
            "bg-card p-3.5 shrink-0",
            isPixelTheme
              ? "rounded-xs shadow-[2px_2px_0px_#000] border-2 border-border/90"
              : "rounded-xl shadow-2xs border border-border"
          )}
        >
          <CalendarHeatmapComponent
            habit={habit}
            onToggleCheckIn={onToggleCheckIn}
            onSelectDate={onSelectDate}
            currentSelectedDate={currentDate}
          />
        </div>

        {/* Pixel Achievement Hall for Habit (in Pixel Mode) */}
        {isPixelTheme && (
          <div className="shrink-0 pb-4">
            <PixelAchievementHall
              currentStreak={stats.currentStreak}
              totalDays={stats.totalCheckIns}
            />
          </div>
        )}
      </div>
    </div>
  );
});
HabitDetailSidebar.displayName = "HabitDetailSidebar";

// ============================================================
// Sub-component: HabitItem
// ============================================================
interface HabitItemProps {
  habit: Habit;
  currentDate: string;
  isSelected?: boolean;
  onSelectDate: (date: string) => void;
  onCheckInEffect?: (x: number, y: number, text: string) => void;
  onClick: () => void;
}

const HabitItem: React.FC<HabitItemProps> = memo(({
  habit,
  currentDate,
  isSelected,
  onSelectDate,
  onCheckInEffect,
  onClick,
}) => {
  const { isPixelTheme } = useAppThemeStyle();
  const { data } = useHabitData();
  const checkIns = data?.checkIns ?? EMPTY_CHECKINS;
  const { toggleCheckIn } = useHabitActions();

  const stats = useMemo(() => getHabitStats(checkIns, habit.id, currentDate), [checkIns, habit.id, currentDate]);

  const last7Days = useMemo(() => {
    const headerDays = getDaysAround();
    return headerDays.map((d) => ({
      dateStr: d.dateStr,
      isCheckedIn: getCheckInStatus(checkIns, habit.id, d.dateStr),
      isActiveDate: d.dateStr === currentDate,
    }));
  }, [currentDate, checkIns, habit.id]);

  const handleDotClick = (e: React.MouseEvent, dateStr: string, isActiveDate: boolean) => {
    e.stopPropagation();
    if (!isActiveDate) {
      onSelectDate(dateStr);
    }
    const completed = !getCheckInStatus(checkIns, habit.id, dateStr);
    toggleCheckIn(habit.id, dateStr, completed);

    if (completed && onCheckInEffect && isPixelTheme) {
      onCheckInEffect(e.clientX, e.clientY, "+10 EXP ✨");
    }
  };

  return (
    <Item
      onClick={onClick}
      className={cn(
        "cursor-pointer group transition-all duration-100 relative select-none",
        isPixelTheme
          ? isSelected
            ? "rounded-xs border-2 border-amber-800 dark:border-amber-500 bg-amber-100/95 dark:bg-amber-950/80 shadow-[3px_3px_0px_#000] font-mono pl-5.5"
            : "rounded-xs border-2 border-border/90 bg-card shadow-[2px_2px_0px_rgba(0,0,0,0.08)] hover:shadow-[3px_3px_0px_rgba(0,0,0,0.14)] hover:border-amber-700/60 font-mono active:translate-x-[1px] active:translate-y-[1px]"
          : isSelected
          ? "border-blue-500/60 dark:border-blue-500/50 bg-blue-500/[0.06] dark:bg-blue-500/[0.12] ring-1 ring-blue-500/40 shadow-xs"
          : "hover:bg-accent/40"
      )}
    >
      {/* Retro Pixel Active Indicator Arrow */}
      {isPixelTheme && isSelected && (
        <span
          className="absolute left-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center select-none pointer-events-none"
          aria-hidden="true"
        >
          <span className="text-amber-800 dark:text-amber-400 text-[8px] leading-none font-mono font-black animate-pixel-hop block">
            ▶
          </span>
        </span>
      )}
      <div className="flex items-center gap-4 min-w-0">
        <ItemAvatar>
          <HabitAvatar category={habit.category} />
        </ItemAvatar>

        <ItemContent>
          <ItemTitle
            className={cn(
              "group-hover:text-blue-500 transition-colors flex items-center gap-2",
              isPixelTheme && "font-mono font-bold"
            )}
          >
            <span>{habit.name}</span>
            {stats.currentStreak >= 3 && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold",
                  isPixelTheme
                    ? "bg-orange-100 dark:bg-orange-950/80 text-orange-700 dark:text-orange-300 font-mono border border-orange-600/40 rounded-xs shadow-[1px_1px_0px_#000]"
                    : "bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 rounded"
                )}
              >
                {isPixelTheme ? <PixelFlame size={12} /> : <Flame size={12} />}
                {stats.currentStreak}{isPixelTheme ? " 连击" : "天连胜"}
              </span>
            )}
          </ItemTitle>
          <ItemDescription className={isPixelTheme ? "font-mono text-xs" : ""}>
            <span>已坚持 {stats.monthCheckIns} 天</span>
            <span>•</span>
            <span>{isPixelTheme ? `累计经验 ${stats.totalCheckIns * 10} EXP` : `连续 ${stats.currentStreak} 天`}</span>
          </ItemDescription>
        </ItemContent>
      </div>

      <ItemActions>
        {last7Days.map((day) => (
          <button
            key={day.dateStr}
            type="button"
            onClick={(e) => handleDotClick(e, day.dateStr, day.isActiveDate)}
            className={cn(
              "w-6 h-6 flex items-center justify-center transition-all duration-200 transform active:scale-75 cursor-pointer outline-none",
              isPixelTheme ? "rounded-xs" : "rounded-full",
              day.isCheckedIn
                ? isPixelTheme
                  ? "bg-emerald-500 text-white font-bold border-2 border-emerald-700 shadow-[1px_1px_0px_#064e3b] scale-100"
                  : "bg-emerald-500 text-white shadow-xs shadow-emerald-500/40 scale-100"
                : "bg-muted/60 hover:bg-muted text-transparent opacity-80 hover:opacity-100 border border-border/60",
              day.isActiveDate
                ? isPixelTheme
                  ? "ring-2 ring-amber-400 ring-offset-1 scale-105"
                  : "ring-2 ring-blue-500 ring-offset-1 scale-105"
                : ""
            )}
            title={
              day.isActiveDate
                ? `${day.dateStr} (点击${day.isCheckedIn ? "取消打卡" : "完成打卡"})`
                : `${day.dateStr} (点击切换日期并打卡)`
            }
          >
            <Check
              size={13}
              className={`transition-all duration-200 transform stroke-[3] ${
                day.isCheckedIn ? "scale-100 opacity-100 rotate-0" : "scale-0 opacity-0 -rotate-45"
              }`}
            />
          </button>
        ))}
      </ItemActions>
    </Item>
  );
});
HabitItem.displayName = "HabitItem";

// ============================================================
// Main Component: HabitPanel
// ============================================================
export const HabitPanel: React.FC = () => {
  const { isPixelTheme } = useAppThemeStyle();
  const [currentDate, setCurrentDate] = useState<string>(todayYMD());
  const { data } = useHabitData();
  const habitsData = data?.habits ?? EMPTY_HABITS;
  const { createHabit, updateHabit, deleteHabit, toggleCheckIn } = useHabitActions();

  const habits = useMemo(() => getHabitsForDate(habitsData, currentDate), [habitsData, currentDate]);

  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [deletingHabit, setDeletingHabit] = useState<{ id: string; name: string } | null>(null);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [particles, setParticles] = useState<ExpParticleItem[]>([]);

  // Automatically select first habit if current selection is invalid
  useEffect(() => {
    if (habits.length > 0) {
      if (!selectedHabitId || !habits.some((h) => h.id === selectedHabitId)) {
        setSelectedHabitId(habits[0].id);
      }
    } else {
      setSelectedHabitId(null);
    }
  }, [habits, selectedHabitId]);

  const selectedHabit = useMemo(
    () => (selectedHabitId ? habitsData.find((h) => h.id === selectedHabitId) ?? null : null),
    [habitsData, selectedHabitId]
  );

  const triggerParticle = useCallback((x: number, y: number, text = "+10 EXP ✨") => {
    const id = Math.random().toString(36).slice(2, 9);
    setParticles((prev) => [...prev, { id, x, y, text }]);
  }, []);

  const removeParticle = useCallback((id: string) => {
    setParticles((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleEditHabit = useCallback((habit: Habit) => {
    setEditingHabit(habit);
    setIsCreateModalVisible(true);
  }, []);

  const handleDeleteHabit = useCallback((id: string, name: string) => {
    setDeletingHabit({ id, name });
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deletingHabit) return;
    deleteHabit(deletingHabit.id);
    const remaining = habits.filter((h) => h.id !== deletingHabit.id);
    setSelectedHabitId(remaining[0]?.id ?? null);
    setDeletingHabit(null);
  }, [deletingHabit, deleteHabit, habits]);

  const handleSidebarToggleCheckIn = useCallback((dateStr: string, completed: boolean) => {
    if (!selectedHabitId) return;
    toggleCheckIn(selectedHabitId, dateStr, completed);
  }, [selectedHabitId, toggleCheckIn]);

  return (
    <section className="flex flex-col h-full w-full bg-transparent text-foreground overflow-hidden">
      {/* 8-bit Floating Particles (in Pixel Mode) */}
      {isPixelTheme && <ExpParticleContainer particles={particles} onFinish={removeParticle} />}

      {/* Main Split Layout: Left Habit List + Right Detail Sidebar */}
      <section className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: Habit List Area */}
        <section className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          {/* Quick Switcher Bar (Left Column Header) */}
          <DateSwitcher currentDate={currentDate} onChange={setCurrentDate} />

          <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 space-y-3">
            {habits.length === 0 ? (
              <div
                className={cn(
                  "flex flex-col items-center justify-center h-64 text-center p-8 border-dashed",
                  isPixelTheme
                    ? "border-2 border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 rounded-xs font-mono shadow-[2px_2px_0px_rgba(120,53,15,0.2)]"
                    : "border border-border rounded-2xl"
                )}
              >
                {isPixelTheme ? (
                  <div className="w-14 h-14 rounded-xs bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-900/60 flex items-center justify-center text-muted-foreground mb-3 shadow-[2px_2px_0px_#000]">
                    <PixelSlime size={28} />
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
                    <Smile size={28} />
                  </div>
                )}
                <h3 className="text-base font-bold text-foreground mb-1">
                  {isPixelTheme ? "暂无修行契约" : "暂无习惯项目"}
                </h3>
                <p className="text-xs text-muted-foreground max-w-xs mb-4">
                  {isPixelTheme
                    ? "点击右下角的「+」按钮开启你的自律冒险"
                    : "点击右下角的「+」按钮创建你的第一个打卡项目"}
                </p>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setEditingHabit(null);
                    setIsCreateModalVisible(true);
                  }}
                  className={cn(
                    "cursor-pointer",
                    isPixelTheme
                      ? "bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold border-2 border-amber-900 shadow-[2px_2px_0px_#000] rounded-xs active:translate-x-[1px] active:translate-y-[1px]"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  )}
                >
                  {isPixelTheme ? "✨ 订立契约" : "新建习惯"}
                </Button>
              </div>
            ) : (
              habits.map((habit) => (
                <HabitItem
                  key={habit.id}
                  habit={habit}
                  currentDate={currentDate}
                  isSelected={habit.id === selectedHabitId}
                  onSelectDate={setCurrentDate}
                  onCheckInEffect={triggerParticle}
                  onClick={() => setSelectedHabitId(habit.id)}
                />
              ))
            )}
          </div>

          {/* Floating Action Button: Create Habit */}
          <Button
            type="button"
            size="icon"
            className={cn(
              "absolute bottom-6 right-6 z-20 h-12 w-12 transition-all duration-200 cursor-pointer flex items-center justify-center",
              isPixelTheme
                ? "rounded-xs border-2 border-amber-900 bg-amber-500 hover:bg-amber-600 text-amber-950 shadow-[3px_3px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                : "rounded-full shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
            )}
            onClick={() => {
              setEditingHabit(null);
              setIsCreateModalVisible(true);
            }}
            title={isPixelTheme ? "订立修行契约" : "新建习惯"}
            aria-label={isPixelTheme ? "订立修行契约" : "新建习惯"}
          >
            <Plus size={22} className={isPixelTheme ? "stroke-[3]" : ""} />
          </Button>
        </section>

        {/* Right: Permanent Detail Sidebar */}
        <aside
          className={cn(
            "w-80 md:w-88 min-h-0 shrink-0 overflow-hidden flex flex-col",
            isPixelTheme
              ? "border-l-2 border-border/90 bg-card/60 font-mono shadow-[-2px_0px_0px_rgba(0,0,0,0.03)]"
              : "border-l border-border bg-card/40"
          )}
        >
          <HabitDetailSidebar
            habit={selectedHabit}
            currentDate={currentDate}
            onEditHabit={handleEditHabit}
            onDeleteHabit={handleDeleteHabit}
            onToggleCheckIn={handleSidebarToggleCheckIn}
            onSelectDate={setCurrentDate}
          />
        </aside>
      </section>

      {/* Modals & Dialogs */}
      <CreateEditModal
        visible={isCreateModalVisible}
        initialData={editingHabit}
        onCancel={() => {
          setIsCreateModalVisible(false);
          setEditingHabit(null);
        }}
        onSubmit={async (payload) => {
          if (editingHabit) {
            updateHabit(editingHabit.id, payload);
          } else {
            const newHabit = createHabit(payload);
            if (newHabit?.id) {
              setSelectedHabitId(newHabit.id);
            }
          }
          setIsCreateModalVisible(false);
          setEditingHabit(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(deletingHabit)}
        onOpenChange={(open) => !open && setDeletingHabit(null)}
        title={deletingHabit ? `删除习惯「${deletingHabit.name}」` : ""}
        description="确定要删除这个习惯吗？该习惯及其所有历史打卡记录将被软删除。"
        confirmText="确认删除"
        cancelText="取消"
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </section>
  );
};
