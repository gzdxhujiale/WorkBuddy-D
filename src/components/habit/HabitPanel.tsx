import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import {
  Plus,
  MoreHorizontal,
  Smile,
  CheckCircle2,
  Calendar,
  Flame,
  Award,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
  Check,
  Sparkles,
} from "lucide-react";
import { useHabitData, useHabitActions } from "@/hooks/useHabits";
import { Habit, HabitCheckIn, HabitStats } from "@/types/habit";
import { formatDateYMD, todayYMD } from "@/lib/dateUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Drawer, DrawerHeader, DrawerTitle, DrawerContent } from "@/components/ui/drawer";
import { Item, ItemAvatar, ItemContent, ItemTitle, ItemDescription, ItemActions } from "@/components/ui/item";
import { DatePicker } from "@/components/ui/date-picker";

// ============================================================
// Constants & Pure Selectors
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
  { value: "times", label: "完成特定次数" },
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
  key: keyof HabitStats;
  label: string;
  suffix?: string;
}[] = [
  { icon: Calendar, bgClass: "bg-blue-50 dark:bg-blue-950/40", textClass: "text-blue-500 dark:text-blue-400", key: "monthCheckIns", label: "本月完成/天" },
  { icon: CheckCircle2, bgClass: "bg-emerald-50 dark:bg-emerald-950/40", textClass: "text-emerald-500 dark:text-emerald-400", key: "totalCheckIns", label: "累计完成/天" },
  { icon: Flame, bgClass: "bg-orange-50 dark:bg-orange-950/40", textClass: "text-orange-500 dark:text-orange-400", key: "currentStreak", label: "当前连续/天" },
  { icon: Award, bgClass: "bg-indigo-50 dark:bg-indigo-950/40", textClass: "text-indigo-500 dark:text-indigo-400", key: "monthlyCompletionRate", label: "本月完成率", suffix: "%" },
];

const getDaysAround = () => {
  const base = new Date();
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

function getHabitsForDate(habits: Habit[], dateStr: string): Habit[] {
  return habits.filter((habit) => {
    let startDateStr = habit.startDate;
    if (!startDateStr || startDateStr.trim() === "") {
      startDateStr = habit.createdAt ? new Date(habit.createdAt).toISOString().slice(0, 10) : dateStr;
    }
    if (dateStr < startDateStr) return false;

    if (habit.duration && habit.duration !== "forever") {
      let days = 0;
      if (habit.duration.startsWith("custom:")) {
        days = parseInt(habit.duration.replace("custom:", ""), 10) || 0;
      } else {
        days = parseInt(habit.duration.replace(/[^0-9]/g, ""), 10) || 0;
      }

      if (days > 0) {
        const parts = startDateStr.split("-").map(Number);
        if (parts.length === 3 && !parts.some(isNaN)) {
          const startDateObj = new Date(parts[0], parts[1] - 1, parts[2]);
          const endDateObj = new Date(startDateObj);
          endDateObj.setDate(startDateObj.getDate() + (days - 1));

          const qParts = dateStr.split("-").map(Number);
          if (qParts.length === 3 && !qParts.some(isNaN)) {
            const queryDateObj = new Date(qParts[0], qParts[1] - 1, qParts[2]);
            if (queryDateObj > endDateObj) {
              return false;
            }
          }
        }
      }
    }
    return true;
  });
}

function getCheckInStatus(checkIns: HabitCheckIn[], habitId: string, date: string): boolean {
  const checkIn = checkIns.find((c) => c.habitId === habitId && c.date === date);
  return checkIn ? checkIn.completed : false;
}

function getStats(checkIns: HabitCheckIn[], habitId: string, dateStr: string): HabitStats {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth();

  const totalCheckIns = checkIns.filter((c) => c.habitId === habitId && c.completed).length;

  const monthCheckIns = checkIns.filter((c) => {
    if (c.habitId !== habitId || !c.completed) return false;
    const cDate = new Date(c.date);
    return cDate.getFullYear() === year && cDate.getMonth() === month;
  }).length;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthlyCompletionRate = Math.round((monthCheckIns / daysInMonth) * 100);

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const completedDates = new Set(
    checkIns.filter((c) => c.habitId === habitId && c.completed).map((c) => c.date)
  );

  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() - i);
    const dateString = formatDateYMD(checkDate);

    if (completedDates.has(dateString)) {
      streak++;
    } else if (i === 0) {
      continue;
    } else {
      break;
    }
  }

  return {
    monthCheckIns,
    totalCheckIns,
    monthlyCompletionRate,
    currentStreak: streak,
  };
}

// ============================================================
// Shared UI Components
// ============================================================
const HabitAvatar: React.FC<{ size?: "sm" | "md" | "lg" }> = ({ size = "md" }) => {
  const sizeMap = { sm: 20, md: 24, lg: 28 };
  const containerMap = { sm: "w-9 h-9", md: "w-11 h-11", lg: "w-13 h-13" };
  return (
    <div className={`${containerMap[size]} rounded-full bg-emerald-500/20 dark:bg-emerald-500/30 flex items-center justify-center shadow-xs shrink-0 transition-transform hover:scale-105 duration-200 border border-emerald-500/30`}>
      <Smile className="text-emerald-600 dark:text-emerald-400" size={sizeMap[size]} />
    </div>
  );
};

// ============================================================
// Sub-component: DateSwitcher
// ============================================================
interface DateSwitcherProps {
  currentDate: string;
  onChange: (date: string) => void;
}

const DateSwitcher: React.FC<DateSwitcherProps> = memo(({ currentDate, onChange }) => {
  const days = useMemo(() => getDaysAround(), []);

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border select-none">
      <div className="flex gap-4 md:gap-6 overflow-x-auto w-full hide-scrollbar pb-1 justify-between px-2">
        {days.map((d) => {
          const isSelected = d.dateStr === currentDate;

          return (
            <div
              key={d.dateStr}
              onClick={() => onChange(d.dateStr)}
              className="flex flex-col items-center justify-center w-12 cursor-pointer transition-all duration-200 shrink-0 gap-1 group"
            >
              <span className={`text-xs font-medium transition-colors ${isSelected ? "text-blue-600 dark:text-blue-400 font-semibold" : "text-muted-foreground group-hover:text-foreground"}`}>
                {WEEK_DAYS[d.dayOfWeek]}
              </span>
              <span className={`text-lg font-bold transition-transform group-hover:scale-110 duration-200 ${isSelected ? "text-blue-600 dark:text-blue-400 scale-110" : "text-foreground"}`}>
                {d.dayNum}
              </span>
              <div className={`w-4 h-4 rounded-full border-2 mt-1 transition-all duration-200 ${isSelected ? "border-blue-500 bg-blue-500/20" : "border-border group-hover:border-muted-foreground"}`} />
            </div>
          );
        })}
      </div>
    </div>
  );
});
DateSwitcher.displayName = "DateSwitcher";

// ============================================================
// Sub-component: OverviewCards
// ============================================================
const OverviewCards: React.FC<{ habit: Habit; currentDate: string }> = memo(({ habit, currentDate }) => {
  const { data } = useHabitData();
  const checkIns = data?.checkIns ?? EMPTY_CHECKINS;
  const stats = useMemo(() => getStats(checkIns, habit.id, currentDate), [checkIns, habit.id, currentDate]);

  return (
    <div className="grid grid-cols-2 gap-3 w-full">
      {STAT_CARDS.map(({ icon: Icon, bgClass, textClass, key, label, suffix }) => (
        <div key={key} className="bg-card rounded-xl p-3.5 shadow-2xs border border-border flex items-center gap-3 transition-transform hover:-translate-y-0.5 duration-200">
          <div className={`w-10 h-10 rounded-full ${bgClass} flex items-center justify-center ${textClass} shrink-0`}>
            <Icon size={20} />
          </div>
          <div>
            <div className="text-xl font-bold text-foreground tabular-nums">{stats[key]}{suffix}</div>
            <div className="text-xs text-muted-foreground font-medium">{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
});
OverviewCards.displayName = "OverviewCards";

// ============================================================
// Sub-component: CalendarHeatmapComponent
// ============================================================
const CalendarHeatmapComponent: React.FC<{ habit: Habit }> = memo(({ habit }) => {
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

  return (
    <div className="w-full flex flex-col items-center select-none">
      <div className="flex items-center justify-between w-full mb-4 px-1">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold text-foreground">
          {currentMonth.getFullYear()}年{currentMonth.getMonth() + 1}月
        </span>
        <button
          type="button"
          onClick={handleNextMonth}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 w-full text-center gap-y-3">
        {SHORT_WEEK_DAYS.map((day) => (
          <div key={day} className="text-xs text-muted-foreground font-medium mb-1">{day}</div>
        ))}

        {daysInMonth.map((dayInfo, idx) => {
          const checkedIn = checkedInDates.has(formatDateYMD(dayInfo.date));
          const today = isToday(dayInfo.date);

          return (
            <div key={idx} className="flex flex-col items-center justify-center gap-1 group">
              <span className={`text-xs font-medium transition-colors ${!dayInfo.isCurrentMonth ? "text-muted-foreground/30" : today ? "text-blue-500 font-bold" : "text-foreground"}`}>
                {dayInfo.date.getDate()}
              </span>
              <div className={`w-5 h-5 rounded-full transition-all duration-300 flex items-center justify-center ${checkedIn ? "bg-emerald-500 text-white shadow-xs shadow-emerald-500/50" : "bg-muted/50"}`}>
                {checkedIn && <Check size={12} className="stroke-[3]" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
CalendarHeatmapComponent.displayName = "CalendarHeatmapComponent";

// ============================================================
// Sub-component: CreateEditModal (Using shadcn Dialog)
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
      setCheckInTime(initialData.checkInTime || "08:00:00");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("请输入习惯名称");
      return;
    }

    const finalDuration = duration === "custom" ? `custom:${customDays || "14"}` : duration;

    await onSubmit({
      name: name.trim(),
      frequencyType,
      goal,
      duration: finalDuration,
      category,
      autoPopupLog,
      checkInTime: autoPopupLog ? checkInTime : undefined,
      startDate: startDate || undefined,
    });
    onCancel();
  };

  return (
    <Dialog open={visible} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent onClose={onCancel}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="text-amber-500" size={18} />
            {initialData ? "编辑习惯" : "添加新习惯"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-3 mb-2">
            <label className="text-sm font-medium text-muted-foreground">习惯名称</label>
            <div className="flex items-center">
            <div className="w-full">
              <Input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errorMsg) setErrorMsg("");
                }}
                placeholder="习惯名称（例：每天阅读30分钟）"
                className={`h-10 flex-1 rounded-md ${errorMsg ? "border-destructive bg-destructive/10" : "bg-background"}`}
              />
              {errorMsg && <p className="text-xs text-destructive mt-1 pl-1">{errorMsg}</p>}
            </div>
            </div>
          </div>

          <div className="space-y-3.5 pt-2">
            <div className="grid grid-cols-4 items-center gap-3">
              <label className="text-sm font-medium text-muted-foreground text-right">频率</label>
              <select
                value={frequencyType}
                onChange={(e) => setFrequencyType(e.target.value as "daily" | "weekly_days" | "custom")}
                className="col-span-3 h-10 px-3 rounded-lg border border-input bg-background text-sm outline-none focus:border-blue-500 cursor-pointer"
              >
                {FREQUENCY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-4 items-center gap-3">
              <label className="text-sm font-medium text-muted-foreground text-right">目标</label>
              <select
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="col-span-3 h-10 px-3 rounded-lg border border-input bg-background text-sm outline-none focus:border-blue-500 cursor-pointer"
              >
                {GOAL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-4 items-center gap-3">
              <label className="text-sm font-medium text-muted-foreground text-right">开始日期</label>
              <div className="col-span-3">
                <DatePicker
                  value={startDate}
                  onChange={setStartDate}
                  placeholder="选择开始日期"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-3">
              <label className="text-sm font-medium text-muted-foreground text-right">坚持时间</label>
              <div className="col-span-3 flex items-center gap-2">
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="flex-1 h-10 px-3 rounded-lg border border-input bg-background text-sm outline-none focus:border-blue-500 cursor-pointer"
                >
                  {DURATION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {duration === "custom" && (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={customDays}
                      onChange={(e) => setCustomDays(e.target.value)}
                      className="w-20 h-10 px-2 rounded-lg border border-input bg-background text-sm outline-none focus:border-blue-500"
                    />
                    <span className="text-sm text-muted-foreground">天</span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-3">
              <label className="text-sm font-medium text-muted-foreground text-right">所属分组</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="col-span-3 h-10 px-3 rounded-lg border border-input bg-background text-sm outline-none focus:border-blue-500 cursor-pointer"
              >
                {GROUP_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-4 items-center gap-3 pt-2">
              <div />
              <label className="col-span-3 flex items-center gap-2 cursor-pointer select-none text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={autoPopupLog}
                  onChange={(e) => setAutoPopupLog(e.target.checked)}
                  className="w-4 h-4 rounded border-input text-blue-600 focus:ring-blue-500"
                />
                <span>自动触发桌面系统提醒</span>
              </label>
            </div>

            {autoPopupLog && (
              <div className="grid grid-cols-4 items-center gap-3">
                <label className="text-sm font-medium text-muted-foreground text-right">提醒时间</label>
                <input
                  type="time"
                  step="1"
                  value={checkInTime}
                  onChange={(e) => setCheckInTime(e.target.value)}
                  className="col-span-3 h-10 px-3 rounded-lg border border-input bg-background text-sm outline-none focus:border-blue-500 cursor-pointer"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="cursor-pointer"
            >
              取消
            </Button>
            <Button
              type="submit"
              className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white"
            >
              保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});
CreateEditModal.displayName = "CreateEditModal";

// ============================================================
// Sub-component: HabitSidebar (Using shadcn Drawer & ConfirmDialog)
// ============================================================
interface HabitSidebarProps {
  habit: Habit;
  currentDate: string;
  onClose: () => void;
}

const HabitSidebar: React.FC<HabitSidebarProps> = memo(({ habit, currentDate, onClose }) => {
  const { deleteHabit, updateHabit } = useHabitActions();
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  const confirmDelete = useCallback(() => {
    deleteHabit(habit.id);
    setIsConfirmDeleteOpen(false);
    onClose();
  }, [deleteHabit, habit.id, onClose]);

  return (
    <>
      <Drawer open={true} onOpenChange={(open) => !open && onClose()} side="right">
        <DrawerHeader onClose={onClose}>
          <div className="flex items-center justify-between w-full pr-6">
            <div className="flex items-center gap-3 min-w-0">
              <HabitAvatar size="sm" />
              <DrawerTitle>{habit.name}</DrawerTitle>
            </div>
            <div className="flex items-center gap-2 relative">
              <button
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer rounded-lg hover:bg-accent outline-none"
              >
                <MoreHorizontal size={20} />
              </button>
              {isMenuOpen && (
                <div className="absolute right-0 top-10 w-36 bg-card rounded-xl shadow-lg border border-border p-1 z-50">
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-accent rounded-lg cursor-pointer text-left"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsEditModalVisible(true);
                    }}
                  >
                    <Edit2 size={14} /> 编辑
                  </button>
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer text-left"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsConfirmDeleteOpen(true);
                    }}
                  >
                    <Trash2 size={14} /> 删除
                  </button>
                </div>
              )}
            </div>
          </div>
        </DrawerHeader>

        <DrawerContent>
          <div className="flex-shrink-0">
            <OverviewCards habit={habit} currentDate={currentDate} />
          </div>

          <div className="bg-card rounded-xl shadow-2xs border border-border p-4 flex-shrink-0 mb-6">
            <CalendarHeatmapComponent habit={habit} />
          </div>
        </DrawerContent>
      </Drawer>

      <CreateEditModal
        visible={isEditModalVisible}
        onCancel={() => setIsEditModalVisible(false)}
        onSubmit={async (data) => {
          if (data.name) {
            updateHabit(habit.id, data);
          }
          setIsEditModalVisible(false);
        }}
        initialData={habit}
      />

      {/* Replaced window.confirm with shadcn ConfirmDialog */}
      <ConfirmDialog
        open={isConfirmDeleteOpen}
        onOpenChange={setIsConfirmDeleteOpen}
        title={`删除习惯「${habit.name}」`}
        description="确定要删除这个习惯吗？该习惯的所有历史打卡记录也将被清空且无法恢复。"
        confirmText="确认删除"
        cancelText="取消"
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </>
  );
});
HabitSidebar.displayName = "HabitSidebar";

// ============================================================
// Sub-component: HabitItem
// ============================================================
interface HabitItemProps {
  habit: Habit;
  currentDate: string;
  onSelectDate: (date: string) => void;
  onClick: () => void;
}

const HabitItem: React.FC<HabitItemProps> = memo(({ habit, currentDate, onSelectDate, onClick }) => {
  const { data } = useHabitData();
  const checkIns = data?.checkIns ?? EMPTY_CHECKINS;
  const { toggleCheckIn } = useHabitActions();

  const stats = useMemo(() => getStats(checkIns, habit.id, currentDate), [checkIns, habit.id, currentDate]);

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
  };

  return (
    <Item onClick={onClick} className="cursor-pointer group">
      <div className="flex items-center gap-4 min-w-0">
        <ItemAvatar>
          <HabitAvatar />
        </ItemAvatar>

        <ItemContent>
          <ItemTitle className="group-hover:text-blue-500 transition-colors">
            {habit.name}
          </ItemTitle>
          <ItemDescription>
            <span>已坚持 {stats.monthCheckIns} 天</span>
            <span>•</span>
            <span>连续 {stats.currentStreak} 天</span>
          </ItemDescription>
        </ItemContent>
      </div>

      <ItemActions>
        {last7Days.map((day) => (
          <button
            key={day.dateStr}
            type="button"
            onClick={(e) => handleDotClick(e, day.dateStr, day.isActiveDate)}
            className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 transform active:scale-75 cursor-pointer outline-none ${
              day.isCheckedIn
                ? "bg-emerald-500 text-white shadow-xs shadow-emerald-500/40 scale-100"
                : "bg-muted/60 hover:bg-muted text-transparent opacity-80 hover:opacity-100"
            } ${day.isActiveDate ? "ring-2 ring-blue-500 ring-offset-1 scale-105" : ""}`}
            title={
              day.isActiveDate
                ? `${day.dateStr} (点击${day.isCheckedIn ? "取消打卡" : "完成打卡"})`
                : `${day.dateStr} (点击切换日期并打卡)`
            }
          >
            <Check
              size={13}
              className={`transition-all duration-300 transform stroke-[3] ${
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
  const [currentDate, setCurrentDate] = useState<string>(todayYMD());
  const { data } = useHabitData();
  const habitsData = data?.habits ?? EMPTY_HABITS;
  const { createHabit } = useHabitActions();

  const habits = useMemo(() => getHabitsForDate(habitsData, currentDate), [habitsData, currentDate]);

  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const selectedHabit = useMemo(
    () => (selectedHabitId ? habitsData.find((h) => h.id === selectedHabitId) ?? null : null),
    [habitsData, selectedHabitId]
  );

  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);

  const handleHabitClick = useCallback((habit: Habit) => setSelectedHabitId(habit.id), []);
  const handleCloseSidebar = useCallback(() => setSelectedHabitId(null), []);

  return (
    <div className="flex w-full h-full bg-transparent relative overflow-hidden select-none">
      {/* Main Content Area */}
      <div className="flex flex-col flex-1 w-full h-full transition-all duration-300">
        {/* Top Header & Date Switcher */}
        <div className="flex-shrink-0 bg-white/90 dark:bg-slate-900/90 border-b border-slate-200/80 dark:border-slate-800 flex flex-col pt-4">
          <div className="flex items-center justify-between px-6 pb-2">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">习惯追踪</h1>
            </div>
            <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
              <Button
                type="button"
                size="sm"
                className="gap-1.5 cursor-pointer bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => setIsCreateModalVisible(true)}
              >
                <Plus size={16} />
                <span>新建习惯</span>
              </Button>
            </div>
          </div>
          <DateSwitcher currentDate={currentDate} onChange={setCurrentDate} />
        </div>

        {/* Habit List Area */}
        <div className="flex-1 bg-transparent overflow-y-auto p-6 space-y-3">
          {habits.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-8 border border-dashed border-border rounded-2xl">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
                <Smile size={28} />
              </div>
              <h3 className="text-base font-bold text-foreground mb-1">暂无习惯项目</h3>
              <p className="text-xs text-muted-foreground max-w-xs mb-4">点击右上角的「新建习惯」按钮创建你的第一个打卡项目</p>
              <Button
                type="button"
                size="sm"
                onClick={() => setIsCreateModalVisible(true)}
                className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white"
              >
                新建习惯
              </Button>
            </div>
          ) : (
            habits.map((habit) => (
              <HabitItem
                key={habit.id}
                habit={habit}
                currentDate={currentDate}
                onSelectDate={setCurrentDate}
                onClick={() => handleHabitClick(habit)}
              />
            ))
          )}
        </div>
      </div>

      {/* Sidebar Drawer */}
      {selectedHabit && (
        <HabitSidebar habit={selectedHabit} currentDate={currentDate} onClose={handleCloseSidebar} />
      )}

      <CreateEditModal
        visible={isCreateModalVisible}
        onCancel={() => setIsCreateModalVisible(false)}
        onSubmit={async (payload) => {
          createHabit(payload);
        }}
      />
    </div>
  );
};
