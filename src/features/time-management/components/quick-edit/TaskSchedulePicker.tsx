import React, { useState, useMemo, useEffect } from "react";
import {
  Sun,
  Sunrise,
  CalendarPlus,
  Moon,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Bell,
} from "lucide-react";
import dayjs from "dayjs";
import { DateRangePicker } from "@/components/ui/date-picker";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { reminderLabel, type TaskReminder } from "../../types";

const L2_WIDTH = 316;
const L3_WIDTH = 288;
const MARGIN = 8;

export interface TaskSchedulePickerProps {
  dateOpen: boolean;
  scheduleMode: "point" | "range";
  onSwitchScheduleMode: (mode: "point" | "range") => void;
  dateSel: string | null;
  timeSel: string;
  onCommitDeadline: (date: string | null, time: string) => void;
  rangeStartDate: string;
  rangeStartTime: string;
  rangeEndDate: string;
  rangeEndTime: string;
  rangeAllDay: boolean;
  onCommitRange: (
    start: string,
    startTime: string,
    end: string,
    endTime: string,
    allDay: boolean
  ) => void;
  appliedReminder: TaskReminder | null;
  onSaveReminder: (reminder: TaskReminder | null) => void;
  third: "time" | "remind" | null;
  setThird: React.Dispatch<React.SetStateAction<"time" | "remind" | null>>;
  datePopRef: React.RefObject<HTMLDivElement | null>;
  timePopRef: React.RefObject<HTMLDivElement | null>;
  remindPopRef: React.RefObject<HTMLDivElement | null>;
  l1Pos: { top: number; left: number } | null;
  l2Pos: { top: number; left: number } | null;
  l3Pos: { top: number; left: number } | null;
}

export function TaskSchedulePicker({
  dateOpen,
  scheduleMode,
  onSwitchScheduleMode,
  dateSel,
  timeSel,
  onCommitDeadline,
  rangeStartDate,
  rangeStartTime,
  rangeEndDate,
  rangeEndTime,
  rangeAllDay,
  onCommitRange,
  appliedReminder,
  onSaveReminder,
  third,
  setThird,
  datePopRef,
  timePopRef,
  remindPopRef,
  l1Pos,
  l2Pos,
  l3Pos,
}: TaskSchedulePickerProps) {
  const { isPixelTheme } = useAppThemeStyle();
  const todayStr = useMemo(() => dayjs().format("YYYY-MM-DD"), []);

  const [viewYM, setViewYM] = useState(() => {
    const base = dateSel ? dayjs(dateSel) : dayjs();
    return { y: base.year(), m: base.month() };
  });

  const calendarCells = useMemo(() => {
    const first = dayjs(new Date(viewYM.y, viewYM.m, 1));
    const offset = (first.day() + 6) % 7;
    const start = first.subtract(offset, "day");
    return Array.from({ length: 42 }, (_, i) => {
      const d = start.add(i, "day");
      return { ymd: d.format("YYYY-MM-DD"), label: d.date(), dim: d.month() !== viewYM.m };
    });
  }, [viewYM]);

  const shiftMonth = (delta: number) => {
    const next = dayjs(new Date(viewYM.y, viewYM.m, 1)).add(delta, "month");
    setViewYM({ y: next.year(), m: next.month() });
  };

  const quickPick = (daysFromToday: number, time?: string) => {
    const d = dayjs().add(daysFromToday, "day").format("YYYY-MM-DD");
    onCommitDeadline(d, time !== undefined ? time : timeSel);
    setViewYM({ y: dayjs(d).year(), m: dayjs(d).month() });
  };

  // Time input
  const [timeInput, setTimeInput] = useState(timeSel);
  useEffect(() => setTimeInput(timeSel), [timeSel]);

  const commitTimeInput = () => {
    const m = timeInput.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) {
      setTimeInput(timeSel);
      return;
    }
    const h = Math.min(23, parseInt(m[1], 10));
    const min = Math.min(59, parseInt(m[2], 10));
    const t = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    onCommitDeadline(dateSel || todayStr, t);
    setThird(null);
  };

  const timeOptions = useMemo(() => {
    const list: string[] = [];
    for (let h = 8; h <= 22; h++) {
      list.push(`${String(h).padStart(2, "0")}:00`, `${String(h).padStart(2, "0")}:30`);
    }
    return list;
  }, []);

  // Remind draft
  const [draftOffset, setDraftOffset] = useState<number | null>(
    appliedReminder ? appliedReminder.offsetDays : null
  );
  const [draftTime, setDraftTime] = useState(appliedReminder?.time || "09:00");
  const [draftRepeat, setDraftRepeat] = useState(appliedReminder?.repeat || false);
  const [customMode, setCustomMode] = useState(false);

  const openRemind = () => {
    const offset = appliedReminder ? appliedReminder.offsetDays : 0;
    const defaultTime = scheduleMode === "range" ? (rangeAllDay ? "09:00" : rangeEndTime || "09:00") : (timeSel || "09:00");
    setDraftOffset(offset);
    setDraftTime(appliedReminder?.time || defaultTime);
    setDraftRepeat(appliedReminder?.repeat || false);
    setCustomMode(
      appliedReminder ? ![0, 1, 2, 3, 7].includes(appliedReminder.offsetDays) : false
    );
    setThird("remind");
  };

  const saveRemind = () => {
    const next: TaskReminder | null =
      draftOffset === null
        ? null
        : {
            offsetDays: Math.max(0, draftOffset),
            time: draftTime || "09:00",
            repeat: draftRepeat,
          };
    onSaveReminder(next);
    setThird(null);
  };

  const clearRemind = () => {
    onSaveReminder(null);
    setDraftOffset(null);
    setThird(null);
  };

  if (!dateOpen) return null;

  return (
    <>
      {/* ===== 第二层：日期快捷设置浮层 ===== */}
      <div
        ref={datePopRef}
        role="dialog"
        aria-label="日期与提醒"
        style={{
          top: l2Pos?.top ?? (l1Pos?.top ?? MARGIN),
          left: l2Pos?.left ?? ((l1Pos?.left ?? MARGIN) - L2_WIDTH - 12),
          width: L2_WIDTH,
        }}
        className={
          isPixelTheme
            ? "fixed z-[1060] bg-card border-2 border-border shadow-[4px_4px_0px_#000] rounded-xl p-3.5 text-foreground font-mono animate-in fade-in duration-100 select-none"
            : "fixed z-[1060] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-t-2xl rounded-b-none shadow-2xl p-3.5 text-slate-900 dark:text-slate-100 animate-in fade-in duration-100 select-none"
        }
      >
        <div
          className={`grid grid-cols-2 gap-1 p-1 mb-3 ${
            isPixelTheme
              ? "rounded-xs bg-muted/60 border border-border"
              : "rounded-xl bg-slate-100 dark:bg-slate-800/80"
          }`}
        >
          {(["point", "range"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={scheduleMode === mode}
              className={`py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                isPixelTheme ? "rounded-xs" : "rounded-lg"
              } ${
                scheduleMode === mode
                  ? isPixelTheme
                    ? "bg-amber-600 text-white font-bold shadow-[1px_1px_0px_#000]"
                    : "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                  : isPixelTheme
                  ? "text-muted-foreground hover:text-foreground"
                  : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
              }`}
              onClick={() => onSwitchScheduleMode(mode)}
            >
              {mode === "point"
                ? isPixelTheme
                  ? "精准时刻"
                  : "时间"
                : isPixelTheme
                ? "时间区间"
                : "时间段"}
            </button>
          ))}
        </div>

        {scheduleMode === "point" ? (
          <>
            {/* 快捷日期图标 */}
            <div className="flex justify-around mb-3">
              <button
                type="button"
                title="今天"
                aria-label="今天"
                className={`p-2 transition-colors cursor-pointer grid place-items-center ${
                  isPixelTheme
                    ? "rounded-xs border border-border bg-muted hover:bg-card text-foreground shadow-[1px_1px_0px_#000]"
                    : "rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
                onClick={() => quickPick(0)}
              >
                <Sun size={20} />
              </button>
              <button
                type="button"
                title="明天"
                aria-label="明天"
                className={`p-2 transition-colors cursor-pointer grid place-items-center ${
                  isPixelTheme
                    ? "rounded-xs border border-border bg-muted hover:bg-card text-foreground shadow-[1px_1px_0px_#000]"
                    : "rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
                onClick={() => quickPick(1)}
              >
                <Sunrise size={20} />
              </button>
              <button
                type="button"
                title="下周（+7 天）"
                aria-label="下周，加 7 天"
                className={`p-2 transition-colors cursor-pointer grid place-items-center ${
                  isPixelTheme
                    ? "rounded-xs border border-border bg-muted hover:bg-card text-foreground shadow-[1px_1px_0px_#000]"
                    : "rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
                onClick={() => quickPick(7)}
              >
                <CalendarPlus size={20} />
              </button>
              <button
                type="button"
                title="今晚 20:00"
                aria-label="今晚"
                className={`p-2 transition-colors cursor-pointer grid place-items-center ${
                  isPixelTheme
                    ? "rounded-xs border border-border bg-muted hover:bg-card text-foreground shadow-[1px_1px_0px_#000]"
                    : "rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
                onClick={() => quickPick(0, "20:00")}
              >
                <Moon size={20} />
              </button>
            </div>

            {/* 年月导航 */}
            <div className="flex items-center text-sm font-bold text-foreground px-1 py-1 mb-1">
              {viewYM.y}年{viewYM.m + 1}月
              <span className="ml-auto flex items-center gap-0.5">
                <button
                  type="button"
                  aria-label="上个月"
                  className={`w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer ${
                    isPixelTheme
                      ? "rounded-xs hover:bg-muted"
                      : "rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                  onClick={() => shiftMonth(-1)}
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  aria-label="回到今天"
                  className={`w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer ${
                    isPixelTheme
                      ? "rounded-xs hover:bg-muted"
                      : "rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                  onClick={() => setViewYM({ y: dayjs().year(), m: dayjs().month() })}
                >
                  <Circle size={7} />
                </button>
                <button
                  type="button"
                  aria-label="下个月"
                  className={`w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer ${
                    isPixelTheme
                      ? "rounded-xs hover:bg-muted"
                      : "rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                  onClick={() => shiftMonth(1)}
                >
                  <ChevronRight size={14} />
                </button>
              </span>
            </div>

            {/* 日历网格 */}
            <div className="grid grid-cols-7 gap-y-0.5 text-center">
              {["一", "二", "三", "四", "五", "六", "日"].map((w) => (
                <span key={w} className="text-xs text-muted-foreground py-1">
                  {w}
                </span>
              ))}
              {calendarCells.map((cell) => (
                <button
                  key={cell.ymd}
                  type="button"
                  className={`w-8 h-8 mx-auto flex items-center justify-center text-xs tabular-nums transition-colors cursor-pointer ${
                    isPixelTheme ? "rounded-xs" : "rounded-full"
                  } ${
                    cell.dim
                      ? "text-muted-foreground/40 opacity-60"
                      : "text-foreground hover:bg-muted"
                  } ${
                    cell.ymd === dateSel
                      ? isPixelTheme
                        ? "bg-amber-600 text-white font-black shadow-[1px_1px_0px_#000]"
                        : "bg-blue-600 text-white font-bold hover:bg-blue-600"
                      : ""
                  } ${
                    cell.ymd === todayStr && cell.ymd !== dateSel
                      ? isPixelTheme
                        ? "border border-amber-600 text-amber-700 dark:text-amber-400 font-bold"
                        : "border border-blue-500 text-blue-600 dark:text-blue-400 font-bold"
                      : ""
                  }`}
                  onClick={() => onCommitDeadline(cell.ymd, timeSel)}
                >
                  {cell.label}
                </button>
              ))}
            </div>

            {/* 时间 / 提醒 入口条 */}
            <div
              className={`flex items-center gap-1.5 pt-3 mt-2 border-t ${
                isPixelTheme ? "border-border" : "border-slate-200/80 dark:border-slate-800"
              }`}
            >
              <button
                type="button"
                className={`flex-1 inline-flex items-center justify-between text-xs px-2.5 py-1.5 transition-colors cursor-pointer min-w-0 ${
                  isPixelTheme ? "rounded-xs" : "rounded-lg"
                } ${
                  third === "time"
                    ? isPixelTheme
                      ? "bg-muted font-bold text-foreground border border-border"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    : isPixelTheme
                    ? "text-muted-foreground hover:bg-muted"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                }`}
                onClick={() => setThird((t) => (t === "time" ? null : "time"))}
              >
                <span className="flex items-center gap-1.5 truncate">
                  <Clock size={14} className="flex-shrink-0" />
                  <span className="truncate">{timeSel || "设置时间"}</span>
                </span>
                {timeSel && (
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="清除时间"
                    className="ml-1 text-muted-foreground hover:text-foreground text-xs leading-none p-0.5 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCommitDeadline(dateSel, "");
                    }}
                  >
                    ×
                  </span>
                )}
              </button>

              <button
                type="button"
                className={`flex-1 inline-flex items-center justify-between text-xs px-2.5 py-1.5 transition-colors cursor-pointer min-w-0 ${
                  isPixelTheme ? "rounded-xs" : "rounded-lg"
                } ${
                  third === "remind"
                    ? isPixelTheme
                      ? "bg-muted font-bold text-foreground border border-border"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    : isPixelTheme
                    ? "text-muted-foreground hover:bg-muted"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                }`}
                onClick={() => (third === "remind" ? setThird(null) : openRemind())}
              >
                <span className="flex items-center gap-1.5 truncate">
                  <Bell size={14} className="flex-shrink-0" />
                  <span className="truncate">
                    {appliedReminder ? reminderLabel(appliedReminder) : "设置提醒"}
                  </span>
                </span>
                {appliedReminder && (
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="清除提醒"
                    className="ml-1 text-muted-foreground hover:text-foreground text-xs leading-none p-0.5 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearRemind();
                    }}
                  >
                    ×
                  </span>
                )}
              </button>
            </div>
          </>
        ) : (
          /* 时间段模式 */
          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground">日期跨度</span>
              <DateRangePicker
                value={
                  rangeStartDate || rangeEndDate ? [rangeStartDate, rangeEndDate] : undefined
                }
                onChange={([s, e]) => {
                  const nextStart = s || rangeStartDate;
                  const nextEnd = e || rangeEndDate || nextStart;
                  onCommitRange(nextStart, rangeStartTime, nextEnd, rangeEndTime, rangeAllDay);
                }}
              />
            </div>

            <label className="flex items-center justify-between text-xs text-foreground cursor-pointer select-none">
              <span className="font-medium">整天任务</span>
              <input
                type="checkbox"
                checked={rangeAllDay}
                onChange={(e) => {
                  const checked = e.target.checked;
                  onCommitRange(
                    rangeStartDate,
                    rangeStartTime,
                    rangeEndDate,
                    rangeEndTime,
                    checked
                  );
                }}
                className="size-3.5 accent-primary"
              />
            </label>

            {!rangeAllDay && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[11px] text-muted-foreground">开始时间</span>
                  <input
                    type="time"
                    value={rangeStartTime}
                    onChange={(e) => {
                      onCommitRange(
                        rangeStartDate,
                        e.target.value,
                        rangeEndDate,
                        rangeEndTime,
                        rangeAllDay
                      );
                    }}
                    className={`w-full mt-1 px-2 py-1 bg-background text-foreground ${
                      isPixelTheme
                        ? "rounded-xs border border-border font-mono"
                        : "rounded-md border border-slate-200 dark:border-slate-700"
                    }`}
                  />
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground">结束时间</span>
                  <input
                    type="time"
                    value={rangeEndTime}
                    onChange={(e) => {
                      onCommitRange(
                        rangeStartDate,
                        rangeStartTime,
                        rangeEndDate,
                        e.target.value,
                        rangeAllDay
                      );
                    }}
                    className={`w-full mt-1 px-2 py-1 bg-background text-foreground ${
                      isPixelTheme
                        ? "rounded-xs border border-border font-mono"
                        : "rounded-md border border-slate-200 dark:border-slate-700"
                    }`}
                  />
                </div>
              </div>
            )}

            {/* 时间段模式下的提醒入口条 */}
            <div
              className={`pt-2 mt-1 border-t ${
                isPixelTheme ? "border-border" : "border-slate-200/80 dark:border-slate-800"
              }`}
            >
              <button
                type="button"
                className={`w-full inline-flex items-center justify-between text-xs px-2.5 py-1.5 transition-colors cursor-pointer min-w-0 ${
                  isPixelTheme ? "rounded-xs" : "rounded-lg"
                } ${
                  third === "remind"
                    ? isPixelTheme
                      ? "bg-muted font-bold text-foreground border border-border"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    : isPixelTheme
                    ? "text-muted-foreground hover:bg-muted"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                }`}
                onClick={() => (third === "remind" ? setThird(null) : openRemind())}
              >
                <span className="flex items-center gap-1.5 truncate">
                  <Bell size={14} className="flex-shrink-0" />
                  <span className="truncate">
                    {appliedReminder ? reminderLabel(appliedReminder) : "设置提醒"}
                  </span>
                </span>
                {appliedReminder && (
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="清除提醒"
                    className="ml-1 text-muted-foreground hover:text-foreground text-xs leading-none p-0.5 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearRemind();
                    }}
                  >
                    ×
                  </span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===== 第三层 A：时间设置 ===== */}
      {third === "time" && (
        <div
          ref={timePopRef}
          role="dialog"
          aria-label="选择时间"
          style={{
            top: l3Pos?.top ?? MARGIN,
            left: l3Pos?.left ?? MARGIN,
            width: L3_WIDTH,
          }}
          className={
            isPixelTheme
              ? "fixed z-[1070] bg-card border-2 border-border shadow-[4px_4px_0px_#000] rounded-xl p-2.5 animate-in fade-in duration-100 select-none flex flex-col gap-1.5 text-foreground font-mono"
              : "fixed z-[1070] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-2xl p-2.5 animate-in fade-in duration-100 select-none flex flex-col gap-1.5 text-slate-900 dark:text-slate-100"
          }
        >
          <div className="flex items-center gap-1.5 mb-1 px-1">
            <input
              type="text"
              placeholder="HH:mm"
              value={timeInput}
              onChange={(e) => setTimeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitTimeInput();
              }}
              className={`flex-1 text-xs px-2 py-1 outline-none bg-background text-foreground ${
                isPixelTheme
                  ? "rounded-xs border border-border font-mono"
                  : "border border-slate-200 dark:border-slate-700 rounded-md"
              }`}
            />
            <button
              type="button"
              className={`text-xs px-2.5 py-1 transition-colors cursor-pointer ${
                isPixelTheme
                  ? "rounded-xs bg-amber-600 text-white font-bold"
                  : "bg-blue-600 text-white rounded-md hover:bg-blue-500"
              }`}
              onClick={commitTimeInput}
            >
              确定
            </button>
          </div>

          <div className="max-h-56 overflow-y-auto flex flex-col gap-0.5">
            {timeOptions.map((t) => (
              <button
                key={t}
                type="button"
                className={`px-2.5 py-1.5 text-xs text-left transition-colors cursor-pointer ${
                  isPixelTheme ? "rounded-xs" : "rounded-lg"
                } ${
                  timeSel === t
                    ? isPixelTheme
                      ? "bg-muted font-bold text-foreground border border-border"
                      : "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-semibold"
                    : isPixelTheme
                    ? "text-foreground hover:bg-muted"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
                onClick={() => {
                  onCommitDeadline(dateSel || todayStr, t);
                  setThird(null);
                }}
              >
                {t}
              </button>
            ))}
          </div>

          <div
            className={`pt-1 mt-1 border-t flex justify-end ${
              isPixelTheme ? "border-border" : "border-slate-200/80 dark:border-slate-800"
            }`}
          >
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer px-2 py-1"
              onClick={() => {
                setTimeInput("");
                if (dateSel) onCommitDeadline(dateSel, "");
                setThird(null);
              }}
            >
              清除时间
            </button>
          </div>
        </div>
      )}

      {/* ===== 第三层 B：提醒设置 ===== */}
      {third === "remind" && (
        <div
          ref={remindPopRef}
          role="dialog"
          aria-label="提醒设置"
          style={{
            top: l3Pos?.top ?? MARGIN,
            left: l3Pos?.left ?? MARGIN,
            width: L3_WIDTH,
          }}
          className={
            isPixelTheme
              ? "fixed z-[1070] bg-card border-2 border-border shadow-[4px_4px_0px_#000] rounded-xl p-2.5 animate-in fade-in duration-100 select-none flex flex-col gap-1.5 text-foreground font-mono"
              : "fixed z-[1070] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-2xl p-3 animate-in fade-in duration-100 select-none flex flex-col gap-1.5 text-slate-900 dark:text-slate-100"
          }
        >
          {/* Presets Grid */}
          <div className="grid grid-cols-2 gap-1">
            {[
              { off: 0, label: "当天" },
              { off: 1, label: "提前 1 天" },
              { off: 2, label: "提前 2 天" },
              { off: 3, label: "提前 3 天" },
              { off: 7, label: "提前 1 周" },
            ].map(({ off, label }) => (
              <button
                key={off}
                type="button"
                className={`flex items-center justify-between px-2.5 py-1.5 text-xs text-left transition-colors cursor-pointer ${
                  isPixelTheme ? "rounded-xs" : "rounded-lg"
                } ${
                  !customMode && draftOffset === off
                    ? isPixelTheme
                      ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border border-amber-800 font-bold shadow-[1px_1px_0px_#000]"
                      : "text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/60"
                    : isPixelTheme
                    ? "text-foreground hover:bg-muted"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
                onClick={() => {
                  setCustomMode(false);
                  setDraftOffset(off);
                }}
              >
                <span>{label}</span>
                <span className="text-[10px] text-muted-foreground opacity-80">{draftTime}</span>
              </button>
            ))}

            <button
              type="button"
              className={`flex items-center justify-center px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                isPixelTheme ? "rounded-xs" : "rounded-lg"
              } ${
                customMode
                  ? isPixelTheme
                    ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border border-amber-800 font-bold shadow-[1px_1px_0px_#000]"
                    : "text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/60"
                  : isPixelTheme
                  ? "text-foreground hover:bg-muted"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
              onClick={() => {
                setCustomMode(true);
                if (draftOffset === null) setDraftOffset(0);
              }}
            >
              <span>自定义设置</span>
            </button>
          </div>

          {/* Custom Settings Panel */}
          {customMode && (
            <div
              className={`flex flex-col gap-2 p-2 mt-0.5 rounded-lg ${
                isPixelTheme
                  ? "bg-muted/60 border border-border"
                  : "bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800"
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-xs text-foreground">
                <span className="text-muted-foreground shrink-0 font-medium">提前天数:</span>
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={draftOffset ?? 0}
                  className={`w-14 px-2 py-1 text-xs text-center outline-none bg-background text-foreground ${
                    isPixelTheme
                      ? "rounded-xs border border-border font-mono"
                      : "border border-slate-200 dark:border-slate-700 rounded-md"
                  }`}
                  onChange={(e) =>
                    setDraftOffset(Math.max(0, Math.min(365, Number(e.target.value) || 0)))
                  }
                />
              </div>

              <div className="flex items-center justify-between gap-2 text-xs text-foreground">
                <span className="text-muted-foreground shrink-0 font-medium">提醒时间:</span>
                <input
                  type="time"
                  value={draftTime}
                  className={`px-2 py-1 text-xs outline-none bg-background text-foreground ${
                    isPixelTheme
                      ? "rounded-xs border border-border font-mono"
                      : "border border-slate-200 dark:border-slate-700 rounded-md"
                  }`}
                  onChange={(e) => setDraftTime(e.target.value)}
                />
              </div>

              <label className="flex items-center justify-between text-xs text-foreground cursor-pointer select-none">
                <span className="text-muted-foreground font-medium">每日循环提醒</span>
                <input
                  type="checkbox"
                  checked={draftRepeat}
                  onChange={(e) => setDraftRepeat(e.target.checked)}
                  className="size-3.5 accent-primary"
                />
              </label>
            </div>
          )}

          {/* Bottom Actions */}
          <div
            className={`flex items-center justify-between pt-2 mt-1 border-t ${
              isPixelTheme ? "border-border" : "border-slate-200/80 dark:border-slate-800"
            }`}
          >
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer px-1 py-0.5"
              onClick={clearRemind}
            >
              清除提醒
            </button>
            <button
              type="button"
              className={`text-xs px-3 py-1 font-semibold transition-colors cursor-pointer ${
                isPixelTheme
                  ? "rounded-xs bg-amber-600 text-white font-bold"
                  : "bg-blue-600 text-white rounded-md hover:bg-blue-500"
              }`}
              onClick={saveRemind}
            >
              保存提醒
            </button>
          </div>
        </div>
      )}
    </>
  );
}
