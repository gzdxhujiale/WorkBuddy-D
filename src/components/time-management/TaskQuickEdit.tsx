import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  memo,
  forwardRef,
  useImperativeHandle,
} from "react";
import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  Clock,
  Bell,
  Flag,
  AlignLeft,
  Sun,
  Sunrise,
  Moon,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Circle,
  CalendarDays,
  Check,
  X,
} from "lucide-react";
import dayjs from "dayjs";
import {
  QuadrantType,
  Task,
  TaskReminder,
  parseReminder,
  serializeReminder,
  reminderLabel,
  TaskDraft,
} from "@/types/timeManagement";
import { hasTaskDescription } from "@/lib/taskDescription";
import { ReactjsTiptapEditor } from "@/components/ui/reactjs-tiptap-editor";
import { DateRangePicker } from "@/components/ui/date-picker";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { applyAppThemeStyle } from "@/lib/preferences";
import { PixelScroll } from "@/components/pixel/PixelIcons";

// ==========================================
// TaskQuickEdit — Tailwind v4 规范精简 3-Layer 快捷编辑浮层
// 第一层：标题/描述 + 「日期与提醒」字段 + 象限/优先级旗标
// 第二层：快捷日期 + 月历 + 时间/提醒入口
// 第三层：时间下拉 / 提醒设置
// ==========================================

const QUADRANT_META: Record<
  QuadrantType,
  { name: string; pixelName: string; color: string; priority: "urgent" | "high" | "medium" | "low" }
> = {
  Q1: { name: "重要且紧急", pixelName: "🔥 紧急讨伐", color: "#d32f2f", priority: "urgent" },
  Q2: { name: "重要不紧急", pixelName: "🌿 核心修炼", color: "#25845a", priority: "high" },
  Q3: { name: "紧急不重要", pixelName: "⚡ 突发委托", color: "#d97706", priority: "medium" },
  Q4: { name: "不重要不紧急", pixelName: "💧 支线见闻", color: "#697381", priority: "low" },
};

const L1_WIDTH = 420;
const L2_WIDTH = 316;
const L3_WIDTH = 288;
const MARGIN = 8;

function isRichTextFloatingMenuTarget(target: Node): boolean {
  const element = target instanceof Element ? target : target.parentElement;
  return Boolean(element?.closest('[class*="richtext-max-h-"]'));
}

function splitScheduleEnd(timestamp?: number): { date: string | null; time: string } {
  if (!timestamp) return { date: null, time: "" };
  const d = dayjs(timestamp);
  const hm = d.format("HH:mm");
  const isAllDay = hm === "23:59" || hm === "00:00";
  return { date: d.format("YYYY-MM-DD"), time: isAllDay ? "" : hm };
}

function composeDeadline(dateYMD: string, time: string): number {
  const base = dayjs(dateYMD);
  if (time) {
    const [h, m] = time.split(":").map(Number);
    return base.hour(h).minute(m).second(0).millisecond(0).valueOf();
  }
  return base.endOf("day").valueOf();
}

function composeStart(dateYMD: string, time: string): number {
  const base = dayjs(dateYMD);
  if (!time) return base.startOf("day").valueOf();
  const [h, m] = time.split(":").map(Number);
  return base.hour(h).minute(m).second(0).millisecond(0).valueOf();
}

export interface AnchorRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
}

interface TaskQuickEditPopoverProps {
  task?: Task;
  quadrant?: QuadrantType;
  anchorRect?: AnchorRect;
  /** Called once when the editor closes with the complete draft delta. */
  onCommit?: (taskId: string, updates: Partial<Task>) => void;
  onCreate?: (draft: TaskDraft) => void;
  onDelete?: (taskId: string) => void;
  onClose: () => void;
}

export interface TaskQuickEditHandle {
  closeTopLayer: () => void;
  closeAll: () => void;
}

export const TaskQuickEditPopover = memo(
  forwardRef<TaskQuickEditHandle, TaskQuickEditPopoverProps>(
    ({ task, quadrant, anchorRect, onCommit, onCreate, onClose }, handleRef) => {
      const { isPixelTheme } = useAppThemeStyle();
      const isCreate = !task;
      const [selectedQuadrant, setSelectedQuadrant] = useState<QuadrantType>(
        task?.quadrant ?? quadrant ?? "Q2"
      );
      const [flagMenuOpen, setFlagMenuOpen] = useState(false);
      const flagRef = useRef<HTMLButtonElement>(null);
      const flagMenuRef = useRef<HTMLDivElement>(null);
      const meta = QUADRANT_META[selectedQuadrant];

      // ---------- 标题 / 描述 ----------
      const [title, setTitle] = useState(task?.title ?? "");
      const [description, setDescription] = useState(task?.description ?? "");
      const latestTitle = useRef(task?.title ?? "");
      const latestDescription = useRef(task?.description ?? "");

      useEffect(() => {
        latestTitle.current = title;
      }, [title]);

      useEffect(() => {
        latestDescription.current = description;
      }, [description]);

      // ---------- 日期 / 时间 / 提醒状态 ----------
      const initialEnd = task?.scheduledEndAt;
      const initialStart = task?.scheduledStartAt;
      const { date: initDate, time: initTime } = splitScheduleEnd(initialEnd);
      const { date: initStartDate, time: initStartTime } = splitScheduleEnd(initialStart);
      const [dateSel, setDateSel] = useState<string | null>(initDate);
      const [timeSel, setTimeSel] = useState<string>(initTime);
      const [scheduleMode, setScheduleMode] = useState<"point" | "range">(
        task?.scheduleMode === "range" ? "range" : "point"
      );
      const [rangeStartDate, setRangeStartDate] = useState(
        initStartDate ?? initDate ?? dayjs().format("YYYY-MM-DD")
      );
      const [rangeStartTime, setRangeStartTime] = useState(initStartTime || "09:00");
      const [rangeEndDate, setRangeEndDate] = useState(initDate ?? dayjs().format("YYYY-MM-DD"));
      const [rangeEndTime, setRangeEndTime] = useState(initTime || "10:00");
      const [rangeAllDay, setRangeAllDay] = useState(
        task?.scheduleMode === "range" && !initStartTime && !initTime
      );
      const [appliedReminder, setAppliedReminder] = useState<TaskReminder | null>(() =>
        parseReminder(task?.reminder)
      );

      const todayStr = dayjs().format("YYYY-MM-DD");
      const [viewYM, setViewYM] = useState(() => {
        const base = initDate ? dayjs(initDate) : dayjs();
        return { y: base.year(), m: base.month() };
      });

      const [dateOpen, setDateOpen] = useState(false);
      const [third, setThird] = useState<"time" | "remind" | null>(null);

      const commitDeadline = (nextDate: string | null, nextTime: string) => {
        setDateSel(nextDate);
        setTimeSel(nextTime);
      };

      const commitRange = (
        nextStartDate = rangeStartDate,
        nextStartTime = rangeStartTime,
        nextEndDate = rangeEndDate,
        nextEndTime = rangeEndTime,
        allDay = rangeAllDay
      ) => {
        const scheduledStartAt = composeStart(nextStartDate, allDay ? "" : nextStartTime);
        const scheduledEndAt = composeDeadline(nextEndDate, allDay ? "" : nextEndTime);
        if (scheduledEndAt <= scheduledStartAt) return;

        setRangeStartDate(nextStartDate);
        setRangeStartTime(nextStartTime);
        setRangeEndDate(nextEndDate);
        setRangeEndTime(nextEndTime);
      };

      const switchScheduleMode = (nextMode: "point" | "range") => {
        setScheduleMode(nextMode);
        setThird(null);
        if (nextMode === "range") {
          const endDate = dateSel ?? todayStr;
          const endTime = timeSel || "10:00";
          const start = dayjs(composeDeadline(endDate, endTime)).subtract(1, "hour");
          const startDate = start.format("YYYY-MM-DD");
          const startTime = start.format("HH:mm");
          setRangeStartDate(startDate);
          setRangeStartTime(startTime);
          setRangeEndDate(endDate);
          setRangeEndTime(endTime);
          setRangeAllDay(false);
          commitRange(startDate, startTime, endDate, endTime, false);
          return;
        }

        const nextDate = dateSel ?? rangeEndDate;
        const nextTime = timeSel || rangeEndTime;
        setDateSel(nextDate);
        setTimeSel(nextTime);
      };

      // ---------- 提醒草稿（第三层 B） ----------
      const [draftOffset, setDraftOffset] = useState<number | null>(
        appliedReminder ? appliedReminder.offsetDays : null
      );
      const [draftTime, setDraftTime] = useState(appliedReminder?.time || "09:00");
      const [draftRepeat, setDraftRepeat] = useState(appliedReminder?.repeat || false);
      const [customMode, setCustomMode] = useState(false);

      const openRemind = () => {
        setDraftOffset(appliedReminder ? appliedReminder.offsetDays : null);
        setDraftTime(appliedReminder?.time || "09:00");
        setDraftRepeat(appliedReminder?.repeat || false);
        setCustomMode(
          !!appliedReminder && ![0, 1, 2, 3, 7].includes(appliedReminder.offsetDays)
        );
        setThird("remind");
      };

      const saveRemind = () => {
        const next: TaskReminder | null =
          draftOffset === null
            ? null
            : { offsetDays: draftOffset, time: draftTime || "09:00", repeat: draftRepeat };
        setAppliedReminder(next);
        setThird(null);
      };

      // ---------- 新建模式提交 ----------
      const draftRef = useRef({
        dateSel,
        timeSel,
        scheduleMode,
        rangeStartDate,
        rangeStartTime,
        rangeEndDate,
        rangeEndTime,
        rangeAllDay,
        appliedReminder,
        selectedQuadrant,
      });
      useEffect(() => {
        draftRef.current = {
          dateSel,
          timeSel,
          scheduleMode,
          rangeStartDate,
          rangeStartTime,
          rangeEndDate,
          rangeEndTime,
          rangeAllDay,
          appliedReminder,
          selectedQuadrant,
        };
      }, [
        dateSel,
        timeSel,
        scheduleMode,
        rangeStartDate,
        rangeStartTime,
        rangeEndDate,
        rangeEndTime,
        rangeAllDay,
        appliedReminder,
        selectedQuadrant,
      ]);

      const submitCreate = () => {
        const t = latestTitle.current.trim();
        if (!t) return;
        const draft = draftRef.current;
        const finalDesc = latestDescription.current;
        const isRange = draft.scheduleMode === "range";
        const scheduledStartAt = isRange
          ? composeStart(draft.rangeStartDate, draft.rangeAllDay ? "" : draft.rangeStartTime)
          : undefined;
        const scheduledEndAt = isRange
          ? composeDeadline(draft.rangeEndDate, draft.rangeAllDay ? "" : draft.rangeEndTime)
          : draft.dateSel
            ? composeDeadline(draft.dateSel, draft.timeSel)
            : undefined;
        if (isRange && (!scheduledStartAt || !scheduledEndAt || scheduledEndAt <= scheduledStartAt)) return;
        const q = draft.selectedQuadrant;
        onCreate?.({
          title: t,
          description: hasTaskDescription(finalDesc) ? finalDesc : undefined,
          quadrant: q,
          priority: QUADRANT_META[q].priority,
          scheduleMode: scheduledEndAt ? draft.scheduleMode : undefined,
          scheduledStartAt,
          scheduledEndAt,
          reminder: draft.appliedReminder ? serializeReminder(draft.appliedReminder) : undefined,
        });
      };

      const submitTaskDraft = () => {
        if (!task || !onCommit) return;
        const draft = draftRef.current;
        const isRange = draft.scheduleMode === "range";
        const scheduledStartAt = isRange
          ? composeStart(draft.rangeStartDate, draft.rangeAllDay ? "" : draft.rangeStartTime)
          : undefined;
        const scheduledEndAt = isRange
          ? composeDeadline(draft.rangeEndDate, draft.rangeAllDay ? "" : draft.rangeEndTime)
          : draft.dateSel
            ? composeDeadline(draft.dateSel, draft.timeSel)
            : undefined;
        if (isRange && (!scheduledStartAt || !scheduledEndAt || scheduledEndAt <= scheduledStartAt)) return;

        const q = draft.selectedQuadrant;
        const next: Partial<Task> = {
          title: latestTitle.current.trim() || task.title,
          description: hasTaskDescription(latestDescription.current)
            ? latestDescription.current
            : undefined,
          quadrant: q,
          priority: QUADRANT_META[q].priority,
          scheduleMode: scheduledEndAt ? draft.scheduleMode : undefined,
          scheduledStartAt,
          scheduledEndAt,
          reminder: draft.appliedReminder ? serializeReminder(draft.appliedReminder) : undefined,
        };
        const updates = Object.fromEntries(
          Object.entries(next).filter(([key, value]) => !Object.is(task[key as keyof Task], value)),
        ) as Partial<Task>;
        if (Object.keys(updates).length > 0) onCommit(task.id, updates);
      };

      const handleClose = () => {
        if (isCreate) submitCreate();
        else submitTaskDraft();
        onClose();
      };

      const handleCancel = () => {
        // Discard unsaved changes and close without committing
        onClose();
      };

      // ---------- 定位计算 ----------
      const popRef = useRef<HTMLDivElement>(null);
      const datePopRef = useRef<HTMLDivElement>(null);
      const dateFieldRef = useRef<HTMLButtonElement>(null);
      const timeRowRef = useRef<HTMLButtonElement>(null);
      const remindRowRef = useRef<HTMLButtonElement>(null);
      const timePopRef = useRef<HTMLDivElement>(null);
      const remindPopRef = useRef<HTMLDivElement>(null);
      const timeListRef = useRef<HTMLDivElement>(null);

      const [l1Pos, setL1Pos] = useState<{ top: number; left: number } | null>(null);
      const [l2Pos, setL2Pos] = useState<{ top: number; left: number } | null>(null);
      const [l3Pos, setL3Pos] = useState<{ top: number; left: number } | null>(null);

      useLayoutEffect(() => {
        if (!anchorRect) return;
        const el = popRef.current;
        if (!el) return;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const h = el.offsetHeight;
        const left = Math.min(Math.max(anchorRect.left, MARGIN), vw - L1_WIDTH - MARGIN);
        let top = anchorRect.bottom + 6;
        if (top + h > vh - MARGIN) {
          top = Math.max(MARGIN, anchorRect.top - h - 6);
        }
        setL1Pos({ top, left });
      }, [anchorRect]);

      useLayoutEffect(() => {
        if (!dateOpen) {
          setL2Pos(null);
          return;
        }
        const el = datePopRef.current;
        const pop = popRef.current;
        if (!el || !pop) return;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const h = el.offsetHeight;
        const baseLeft = l1Pos?.left ?? MARGIN;
        const baseTop = l1Pos?.top ?? MARGIN;
        let left = baseLeft - 12 - L2_WIDTH;
        if (left < MARGIN) {
          left = Math.min(baseLeft + L1_WIDTH + 12, vw - L2_WIDTH - MARGIN);
        }
        const fieldRect = dateFieldRef.current?.getBoundingClientRect();
        let top = fieldRect ? fieldRect.top : baseTop;
        top = Math.min(Math.max(top, MARGIN), vh - h - MARGIN);
        setL2Pos({ top, left });
      }, [dateOpen, l1Pos, viewYM, scheduleMode, rangeAllDay]);

      useLayoutEffect(() => {
        if (!third) {
          setL3Pos(null);
          return;
        }
        const anchor = third === "time" ? timeRowRef.current : remindRowRef.current;
        const el = third === "time" ? timePopRef.current : remindPopRef.current;
        if (!anchor || !el) return;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const r = anchor.getBoundingClientRect();
        const h = el.offsetHeight;
        const left = Math.min(Math.max(r.left, MARGIN), vw - L3_WIDTH - MARGIN);
        const top = Math.min(Math.max(r.bottom - h, MARGIN), vh - h - MARGIN);
        setL3Pos({ top, left });
      }, [third, customMode]);

      // ---------- 分层关闭 ----------
      const closeOneLayer = (isEscape = false) => {
        if (flagMenuOpen) {
          setFlagMenuOpen(false);
          return;
        }
        if (third) {
          setThird(null);
          return;
        }
        if (dateOpen) {
          setDateOpen(false);
          return;
        }
        if (isEscape) {
          // ESC on top layer: discard unsaved edits / cancel create
          handleCancel();
        } else {
          handleClose();
        }
      };

      useImperativeHandle(handleRef, () => ({
        closeTopLayer: () => closeOneLayer(true),
        closeAll: handleClose,
      }));

      useEffect(() => {
        const onMouseDown = (e: MouseEvent) => {
          const t = e.target as Node;
          if (!t || !document.body.contains(t)) return;

          // reactjs-tiptap-editor mounts slash commands under document.body.
          // Treat them as part of this popover so selecting a command does not close it.
          if (isRichTextFloatingMenuTarget(t)) return;

          // DatePicker / DateRangePicker portals are mounted directly under document.body
          if (t instanceof Element && t.closest?.("[class*='fixed z-[2000]']")) return;

          if (flagMenuRef.current?.contains(t) || flagRef.current?.contains(t)) return;
          if (flagMenuOpen) {
            setFlagMenuOpen(false);
          }

          if (timePopRef.current?.contains(t) || remindPopRef.current?.contains(t)) return;
          if (third) {
            setThird(null);
            return;
          }
          if (datePopRef.current?.contains(t) || dateFieldRef.current?.contains(t)) return;
          if (popRef.current?.contains(t)) {
            setDateOpen(false);
            return;
          }

          handleClose();
        };
        const onKeyDown = (e: KeyboardEvent) => {
          if (e.isComposing || e.keyCode === 229) return;
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            closeOneLayer(true);
            return;
          }
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            handleClose();
            return;
          }
        };
        window.addEventListener("mousedown", onMouseDown, true);
        window.addEventListener("keydown", onKeyDown);
        return () => {
          window.removeEventListener("mousedown", onMouseDown, true);
          window.removeEventListener("keydown", onKeyDown);
        };
      }, [third, dateOpen, flagMenuOpen, task?.id]);

      // ---------- 辅助计算 ----------
      const fieldText = useMemo(() => {
        if (scheduleMode === "range") {
          const s = rangeStartDate
            ? `${rangeStartDate}${rangeAllDay ? "" : ` ${rangeStartTime}`}`
            : "";
          const e = rangeEndDate
            ? `${rangeEndDate}${rangeAllDay ? "" : ` ${rangeEndTime}`}`
            : "";
          if (s && e) return `${s} ~ ${e}`;
          if (e) return `截至 ${e}`;
          return "选择时间段";
        }
        if (!dateSel) return "选择日期与提醒";
        if (timeSel) return `${dateSel} ${timeSel}`;
        return dateSel;
      }, [dateSel, timeSel, scheduleMode, rangeStartDate, rangeStartTime, rangeEndDate, rangeEndTime, rangeAllDay]);

      // ---------- 月历 ----------
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
        commitDeadline(d, time !== undefined ? time : timeSel);
        setViewYM({ y: dayjs(d).year(), m: dayjs(d).month() });
      };

      // ---------- 手动时间输入 ----------
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
        commitDeadline(dateSel || todayStr, t);
        setThird(null);
      };

      const timeOptions = useMemo(() => {
        const list: string[] = [];
        for (let h = 8; h <= 22; h++) {
          list.push(`${String(h).padStart(2, "0")}:00`, `${String(h).padStart(2, "0")}:30`);
        }
        return list;
      }, []);

      const focusDesc = () => {
        const el = popRef.current?.querySelector<HTMLElement>(
          ".tqe-description-editor .ProseMirror",
        );
        el?.focus();
      };

      const popoverStyle: React.CSSProperties = anchorRect
        ? {
            position: "absolute",
            top: l1Pos?.top ?? Math.max(MARGIN, anchorRect.bottom + 6),
            left: l1Pos?.left ?? Math.max(MARGIN, anchorRect.left),
            width: L1_WIDTH,
          }
        : {
            width: L1_WIDTH,
          };

      return (
        <>
          {/* ===== 第一层：任务快捷编辑浮层 ===== */}
          <div
            ref={popRef}
            role="dialog"
            aria-label="编辑任务"
            style={popoverStyle}
            className={
              isPixelTheme
                ? "fixed z-[1050] bg-card border-2 border-border shadow-[4px_4px_0px_#000] rounded-xl text-foreground font-mono animate-in fade-in duration-100 select-none overflow-hidden"
                : "fixed z-[1050] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-t-2xl rounded-b-none shadow-2xl text-slate-900 dark:text-slate-100 animate-in fade-in duration-100 select-none overflow-hidden"
            }
          >
            {/* 顶栏：日期与提醒入口 + 象限 / 优先级 Flag */}
            <div className={`flex items-center gap-2.5 px-3.5 py-3 border-b ${isPixelTheme ? "border-border bg-muted/30" : "border-slate-200/60 dark:border-slate-800/80"}`}>
              <button
                ref={dateFieldRef}
                type="button"
                className={`flex-1 inline-flex items-center gap-2 text-[13.5px] px-2 py-1 transition-colors cursor-pointer min-w-0 ${
                  isPixelTheme ? "rounded-xs border border-border/80" : "rounded-lg"
                } ${
                  (scheduleMode === "range" ? rangeEndDate : dateSel)
                    ? isPixelTheme
                      ? "text-amber-700 dark:text-amber-300 font-bold bg-amber-100/80 dark:bg-amber-950/60 shadow-[1px_1px_0px_#000]"
                      : "text-blue-600 dark:text-blue-400 font-semibold bg-blue-50/50 dark:bg-blue-950/30"
                    : isPixelTheme
                      ? "text-muted-foreground hover:bg-muted"
                      : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
                onClick={() => {
                  setThird(null);
                  setFlagMenuOpen(false);
                  setDateOpen((v) => !v);
                }}
              >
                {isPixelTheme ? <PixelScroll size={16} className="flex-shrink-0" /> : <CalendarDays size={17} className="flex-shrink-0" />}
                <span className="truncate">{fieldText}</span>
              </button>

              <div className="relative">
                <button
                  ref={flagRef}
                  type="button"
                  onClick={() => {
                    setDateOpen(false);
                    setThird(null);
                    setFlagMenuOpen((v) => !v);
                  }}
                  className={`p-1 flex-shrink-0 grid place-items-center cursor-pointer transition-colors ${
                    isPixelTheme
                      ? "rounded-xs border border-border/60 bg-muted/40 hover:bg-muted shadow-[1px_1px_0px_#000]"
                      : "rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                  title={`优先级 / 所属象限：${isPixelTheme ? meta.pixelName : meta.name} (点击修改)`}
                  aria-label={`优先级 / 所属象限：${meta.name}`}
                  style={{ color: meta.color }}
                >
                  <Flag size={17} fill="currentColor" />
                </button>

                {flagMenuOpen && (
                  <div
                    ref={flagMenuRef}
                    className={`absolute right-0 top-full mt-1.5 z-50 min-w-44 p-1 shadow-xl animate-in fade-in zoom-in-95 ${
                      isPixelTheme
                        ? "bg-card border-2 border-border rounded-xs shadow-[3px_3px_0px_#000] font-mono"
                        : "bg-popover border border-border rounded-xl shadow-lg"
                    }`}
                  >
                    <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                      修改优先级 / 象限
                    </div>
                    {(["Q1", "Q2", "Q3", "Q4"] as QuadrantType[]).map((q) => {
                      const qMeta = QUADRANT_META[q];
                      const isSelected = selectedQuadrant === q;
                      return (
                        <button
                          key={q}
                          type="button"
                          onClick={() => {
                            setSelectedQuadrant(q);
                            setFlagMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left cursor-pointer transition-colors ${
                            isPixelTheme ? "rounded-xs" : "rounded-lg"
                          } ${
                            isSelected
                              ? isPixelTheme
                                ? "bg-muted font-bold text-foreground border border-border/60"
                                : "bg-accent font-semibold text-foreground"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          <Flag size={14} fill="currentColor" style={{ color: qMeta.color }} />
                          <span className="flex-1 truncate">
                            {isPixelTheme ? qMeta.pixelName : qMeta.name}
                          </span>
                          {isSelected && <Check size={12} className="text-foreground shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 显式关闭/完成按钮 */}
              <button
                type="button"
                onClick={handleClose}
                className={`p-1 flex-shrink-0 grid place-items-center cursor-pointer transition-colors ${
                  isPixelTheme
                    ? "rounded-xs border border-border/60 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground shadow-[1px_1px_0px_#000]"
                    : "rounded-lg text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
                title="完成并关闭 (点击外部自动保存)"
                aria-label="完成并关闭"
              >
                <X size={17} />
              </button>
            </div>

            {/* 编辑主体：标题 + 描述 */}
            <div className="p-3.5 flex flex-col gap-2.5">
              <div className="flex items-center gap-2.5">
                <input
                  type="text"
                  placeholder={isPixelTheme ? "👾 委托任务内容..." : "准备做什么？"}
                  value={title}
                  autoFocus
                  className={`flex-1 bg-transparent border-0 outline-none text-base font-semibold min-w-0 ${
                    isPixelTheme
                      ? "font-mono font-bold text-foreground placeholder:text-muted-foreground"
                      : "text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  }`}
                  onChange={(e) => {
                    latestTitle.current = e.target.value;
                    setTitle(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleClose();
                    }
                  }}
                  onBlur={() => {
                    if (!title.trim() && task) setTitle(task.title);
                  }}
                />
                <button
                  type="button"
                  className={`p-1 transition-colors cursor-pointer flex-shrink-0 ${
                    isPixelTheme
                      ? "rounded-xs border border-border bg-muted hover:bg-card text-foreground shadow-[1px_1px_0px_#000]"
                      : "rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                  }`}
                  title="任务描述"
                  aria-label="任务描述"
                  onClick={focusDesc}
                >
                  <AlignLeft size={17} />
                </button>
              </div>

              <div className="h-[260px] min-h-[148px] overflow-hidden">
                <ReactjsTiptapEditor
                  placeholder={isPixelTheme ? "添加委托任务详细备忘..." : "添加任务备注描述..."}
                  content={description}
                  showToolbar={false}
                  className={
                    isPixelTheme
                      ? "tqe-description-editor rounded-xs border-2 border-border bg-background/50 font-mono"
                      : "tqe-description-editor rounded-b-none border border-slate-200/80 dark:border-slate-800"
                  }
                  onChange={(nextDescription) => {
                    latestDescription.current = nextDescription;
                    setDescription(nextDescription);
                  }}
                />
              </div>
            </div>
          </div>

          {/* ===== 第二层：日期与提醒 ===== */}
          {dateOpen && (
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
              <div className={`grid grid-cols-2 gap-1 p-1 mb-3 ${isPixelTheme ? "rounded-xs bg-muted/60 border border-border" : "rounded-xl bg-slate-100 dark:bg-slate-800/80"}`}>
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
                    onClick={() => switchScheduleMode(mode)}
                  >
                    {mode === "point" ? (isPixelTheme ? "精准时刻" : "时间") : (isPixelTheme ? "时间区间" : "时间段")}
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
                          isPixelTheme ? "rounded-xs hover:bg-muted" : "rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                        onClick={() => shiftMonth(-1)}
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label="回到今天"
                        className={`w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer ${
                          isPixelTheme ? "rounded-xs hover:bg-muted" : "rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                        onClick={() => setViewYM({ y: dayjs().year(), m: dayjs().month() })}
                      >
                        <Circle size={7} />
                      </button>
                      <button
                        type="button"
                        aria-label="下个月"
                        className={`w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer ${
                          isPixelTheme ? "rounded-xs hover:bg-muted" : "rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
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
                            : cell.ymd === dateSel
                            ? isPixelTheme
                              ? "bg-amber-600 text-white font-bold shadow-[1px_1px_0px_#000]"
                              : "bg-blue-600 text-white font-bold"
                            : cell.ymd === todayStr
                            ? isPixelTheme
                              ? "border border-amber-600 text-foreground font-semibold"
                              : "ring-1 ring-blue-500/50 text-slate-900 dark:text-slate-100 font-semibold"
                            : isPixelTheme
                              ? "text-foreground hover:bg-muted"
                              : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                        onClick={() => {
                          if (cell.dim) {
                            setViewYM({ y: dayjs(cell.ymd).year(), m: dayjs(cell.ymd).month() });
                          }
                          commitDeadline(cell.ymd, timeSel);
                        }}
                      >
                        {cell.label}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-2.5 mb-3">
                  <div>
                    <span className="text-[11px] font-semibold text-muted-foreground mb-1.5 block">
                      起止时间
                    </span>
                    <DateRangePicker
                      size="small"
                      value={[
                        rangeStartDate ? (rangeAllDay ? rangeStartDate : `${rangeStartDate} ${rangeStartTime || "00:00"}:00`) : null,
                        rangeEndDate ? (rangeAllDay ? rangeEndDate : `${rangeEndDate} ${rangeEndTime || "00:00"}:00`) : null,
                      ]}
                      placeholder={["开始时间", "结束时间"]}
                      onChange={(dates, dayjsObjs) => {
                        const [sDay, eDay] = dayjsObjs;
                        if (sDay && eDay) {
                          const nextStart = sDay.format("YYYY-MM-DD");
                          const nextStartTime = sDay.format("HH:mm");
                          const nextEnd = eDay.format("YYYY-MM-DD");
                          const nextEndTime = eDay.format("HH:mm");
                          setRangeStartDate(nextStart);
                          setRangeStartTime(nextStartTime);
                          setRangeEndDate(nextEnd);
                          setRangeEndTime(nextEndTime);
                          commitRange(nextStart, nextStartTime, nextEnd, nextEndTime, rangeAllDay);
                        } else {
                          const [s, e] = dates;
                          const nextStart = s ? s.slice(0, 10) : rangeStartDate;
                          const nextEnd = e ? e.slice(0, 10) : rangeEndDate;
                          setRangeStartDate(nextStart);
                          setRangeEndDate(nextEnd);
                          commitRange(nextStart, rangeStartTime, nextEnd, rangeEndTime, rangeAllDay);
                        }
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between px-1 py-1 text-xs text-foreground">
                    <span>全天任务</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={rangeAllDay}
                      className={`w-9 h-5 ${isPixelTheme ? "rounded-xs" : "rounded-full"} relative transition-colors cursor-pointer ${
                        rangeAllDay
                          ? isPixelTheme ? "bg-amber-600 shadow-[1px_1px_0px_#000]" : "bg-blue-600"
                          : isPixelTheme ? "bg-muted border border-border" : "bg-slate-200 dark:bg-slate-700"
                      }`}
                      onClick={() => {
                        const next = !rangeAllDay;
                        setRangeAllDay(next);
                        commitRange(rangeStartDate, rangeStartTime, rangeEndDate, rangeEndTime, next);
                      }}
                    >
                      <span className={`absolute top-0.5 left-0.5 size-4 ${isPixelTheme ? "rounded-xs" : "rounded-full"} bg-white shadow-xs transition-transform ${rangeAllDay ? "translate-x-4" : "translate-x-0"}`} />
                    </button>
                  </div>
                </div>
              )}

              {/* 时间 & 提醒 入口 */}
              <div className={`border-t ${isPixelTheme ? "border-border" : "border-slate-200/60 dark:border-slate-800"} mt-2.5 pt-1.5 flex flex-col gap-0.5`}>
                {scheduleMode === "point" && (
                <button
                  ref={timeRowRef}
                  type="button"
                  className={`w-full flex items-center gap-2.5 px-2 py-2 text-xs text-foreground text-left transition-colors cursor-pointer ${
                    isPixelTheme ? "rounded-xs hover:bg-muted" : "rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                  onClick={() => setThird((t) => (t === "time" ? null : "time"))}
                >
                  <Clock size={16} className="text-muted-foreground flex-shrink-0" />
                  <span>时间</span>
                  <span
                    className={`ml-auto text-xs ${
                      timeSel
                        ? isPixelTheme
                          ? "text-amber-600 dark:text-amber-400 font-bold"
                          : "text-blue-600 dark:text-blue-400 font-semibold"
                        : "text-muted-foreground"
                    }`}
                  >
                    {timeSel}
                  </span>
                  <span className="text-muted-foreground text-xs ml-0.5">›</span>
                </button>
                )}
                <button
                  ref={remindRowRef}
                  type="button"
                  className={`w-full flex items-center gap-2.5 px-2 py-2 text-xs text-foreground text-left transition-colors cursor-pointer ${
                    isPixelTheme ? "rounded-xs hover:bg-muted" : "rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                  onClick={() => (third === "remind" ? setThird(null) : openRemind())}
                >
                  <Bell size={16} className="text-muted-foreground flex-shrink-0" />
                  <span>提醒</span>
                  <span
                    className={`ml-auto text-xs ${
                      appliedReminder
                        ? isPixelTheme
                          ? "text-amber-600 dark:text-amber-400 font-bold"
                          : "text-blue-600 dark:text-blue-400 font-semibold"
                        : "text-muted-foreground"
                    }`}
                  >
                    {appliedReminder ? reminderLabel(appliedReminder) : ""}
                  </span>
                  <span className="text-muted-foreground text-xs ml-0.5">›</span>
                </button>
              </div>
            </div>
          )}

          {/* ===== 第三层 A：时间选择下拉 ===== */}
          {third === "time" && (
            <div
              ref={timePopRef}
              role="listbox"
              aria-label="选择时间"
              style={{
                top: l3Pos?.top ?? MARGIN,
                left: l3Pos?.left ?? MARGIN,
                width: L3_WIDTH,
              }}
              className={
                isPixelTheme
                  ? "fixed z-[1070] bg-card border-2 border-border shadow-[4px_4px_0px_#000] rounded-xl overflow-hidden font-mono text-foreground animate-in fade-in duration-100 select-none"
                  : "fixed z-[1070] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-t-2xl rounded-b-none shadow-2xl overflow-hidden animate-in fade-in duration-100 select-none"
              }
            >
              <div className="max-h-[252px] overflow-y-auto p-1.5 flex flex-col gap-0.5" ref={timeListRef}>
                {timeOptions.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs tabular-nums text-left transition-colors cursor-pointer ${
                      isPixelTheme ? "rounded-xs" : "rounded-lg"
                    } ${
                      t === timeSel
                        ? isPixelTheme
                          ? "sel bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border border-amber-800 font-bold shadow-[1px_1px_0px_#000]"
                          : "sel text-blue-600 dark:text-blue-400 font-semibold bg-blue-50/60 dark:bg-blue-950/40"
                        : isPixelTheme
                          ? "text-foreground hover:bg-muted"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                    onClick={() => {
                      commitDeadline(dateSel || todayStr, t);
                      setThird(null);
                    }}
                  >
                    <span>{t}</span>
                    {t === timeSel && <span className={isPixelTheme ? "text-amber-600 dark:text-amber-400 font-bold" : "text-blue-600 dark:text-blue-400 font-bold"}>✓</span>}
                  </button>
                ))}
              </div>
              <div className={`flex items-center gap-2 border-t px-3 py-2 ${isPixelTheme ? "border-border bg-muted/40" : "border-slate-200/60 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"}`}>
                <Clock size={15} className="text-muted-foreground flex-shrink-0" />
                <input
                  type="text"
                  value={timeInput}
                  placeholder="HH:mm"
                  aria-label="输入时间"
                  className={`flex-1 bg-transparent border-0 outline-none text-xs tabular-nums font-semibold min-w-0 ${
                    isPixelTheme ? "text-amber-700 dark:text-amber-300" : "text-blue-600 dark:text-blue-400"
                  }`}
                  onChange={(e) => setTimeInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && commitTimeInput()}
                  onBlur={commitTimeInput}
                />
                <button
                  type="button"
                  aria-label="清除时间"
                  className="text-muted-foreground hover:text-foreground text-sm px-1.5 py-0.5 rounded-md cursor-pointer"
                  onClick={() => {
                    setTimeInput("");
                    if (dateSel) commitDeadline(dateSel, "");
                    else setTimeSel("");
                  }}
                >
                  ×
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
                  ? "fixed z-[1070] bg-card border-2 border-border shadow-[4px_4px_0px_#000] rounded-xl p-2 animate-in fade-in duration-100 select-none flex flex-col gap-0.5 text-foreground font-mono"
                  : "fixed z-[1070] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-t-2xl rounded-b-none shadow-2xl p-2 animate-in fade-in duration-100 select-none flex flex-col gap-0.5 text-slate-900 dark:text-slate-100"
              }
            >
              {[0, 1, 2, 3, 7].map((off) => (
                <button
                  key={off}
                  type="button"
                  className={`w-full flex items-baseline justify-between px-3 py-2 text-xs text-left transition-colors cursor-pointer ${
                    isPixelTheme ? "rounded-xs" : "rounded-xl"
                  } ${
                    !customMode && draftOffset === off
                      ? isPixelTheme
                        ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border border-amber-800 font-bold shadow-[1px_1px_0px_#000]"
                        : "text-blue-600 dark:text-blue-400 font-semibold bg-blue-50/60 dark:bg-blue-950/40"
                      : isPixelTheme
                        ? "text-foreground hover:bg-muted"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                  onClick={() => {
                    setCustomMode(false);
                    setDraftOffset((prev) => (prev === off && !customMode ? null : off));
                  }}
                >
                  <span>{off === 0 ? "当天" : `提前 ${off} 天`}</span>
                  <span className="text-[11px] text-muted-foreground">({draftTime})</span>
                </button>
              ))}
              <button
                type="button"
                className={`w-full flex items-baseline gap-1.5 px-3 py-2 text-xs text-left transition-colors cursor-pointer ${
                  isPixelTheme ? "rounded-xs" : "rounded-xl"
                } ${
                  customMode
                    ? isPixelTheme
                      ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border border-amber-800 font-bold shadow-[1px_1px_0px_#000]"
                      : "text-blue-600 dark:text-blue-400 font-semibold bg-blue-50/60 dark:bg-blue-950/40"
                    : isPixelTheme
                      ? "text-foreground hover:bg-muted"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
                onClick={() => {
                  setCustomMode((v) => !v);
                  setDraftOffset((prev) => (customMode ? null : prev ?? 0));
                }}
              >
                <span>自定义</span>
              </button>
              {customMode && (
                <div className="flex items-center gap-2 px-3 py-2 text-xs text-foreground">
                  <label className="inline-flex items-center gap-1.5">
                    提前
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={draftOffset ?? 0}
                      className={`w-12 px-2 py-1 text-xs outline-none bg-background text-foreground ${
                        isPixelTheme ? "rounded-xs border border-border font-mono" : "border border-slate-200 dark:border-slate-700 rounded-lg"
                      }`}
                      onChange={(e) =>
                        setDraftOffset(Math.max(0, Math.min(30, Number(e.target.value) || 0)))
                      }
                    />
                    天
                  </label>
                  <label className="inline-flex items-center gap-1.5 ml-auto cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draftRepeat}
                      className="rounded border-input text-amber-600 focus:ring-amber-500"
                      onChange={(e) => setDraftRepeat(e.target.checked)}
                    />
                    每天提醒
                  </label>
                </div>
              )}
              <div className={`flex items-center justify-end gap-2 px-3 py-2 border-t mt-1 ${isPixelTheme ? "border-border" : "border-slate-200/60 dark:border-slate-800"}`}>
                <button
                  type="button"
                  className={`px-2.5 py-1 text-xs transition-colors cursor-pointer ${
                    isPixelTheme
                      ? "rounded-xs border border-border bg-muted hover:bg-accent text-foreground shadow-[1px_1px_0px_#000]"
                      : "rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                  onClick={() => setThird(null)}
                >
                  取消
                </button>
                <button
                  type="button"
                  className={`px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                    isPixelTheme
                      ? "rounded-xs bg-amber-600 hover:bg-amber-700 text-white shadow-[1px_1px_0px_#000]"
                      : "rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                  onClick={saveRemind}
                >
                  保存
                </button>
              </div>
            </div>
          )}
        </>
      );
    }
  )
);

interface TqeInitPayload {
  session: string;
  task: Task | null;
  quadrant: QuadrantType | null;
  anchor: AnchorRect;
}

function toWire(updates: Partial<Task>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(updates).map(([k, v]) => [k, v === undefined ? null : v])
  );
}

export function TaskQuickEditWindow() {
  const [init, setInit] = useState<TqeInitPayload | null>(null);
  const popRef = useRef<TaskQuickEditHandle>(null);

  useEffect(() => {
    document.documentElement.classList.add("tqe-window");
    applyAppThemeStyle();
    const pending: Promise<UnlistenFn>[] = [
      listen<TqeInitPayload>("tqe:init", (e) => {
        applyAppThemeStyle();
        setInit(e.payload);
      }),
      listen<{ session: string }>("tqe:discard", (e) => {
        setInit((active) => {
          if (e.payload?.session !== active?.session) return active;
          void getCurrentWindow().hide().catch(() => {});
          return null;
        });
      }),
      listen<{ session: string }>("tqe:flush", () => popRef.current?.closeAll()),
      listen("tqe:close-layer", () => popRef.current?.closeTopLayer()),
      listen("tqe:close-all", () => popRef.current?.closeAll()),
      listen("tqe:ping", () => void emit("tqe:ready")),
    ];
    void emit("tqe:ready");
    return () => {
      pending.forEach((p) => p.then((fn) => fn()));
    };
  }, []);

  useEffect(() => {
    if (!init) return;
    const win = getCurrentWindow();
    void win
      .show()
      .then(() => win.setFocus())
      .then(() => emit("tqe:shown", { session: init.session }))
      .catch(() => {});
  }, [init]);

  if (!init) return null;

  const session = init.session;
  return (
    <TaskQuickEditPopover
      ref={popRef}
      key={session}
      task={init.task ?? undefined}
      quadrant={init.quadrant ?? undefined}
      anchorRect={init.anchor}
      onCommit={(taskId, updates) => {
        void emit("tqe:commit", {
          session,
          taskId,
          updates: toWire(updates),
        });
      }}
      onCreate={(draft: TaskDraft) => {
        void emit("tqe:create", { session, draft });
      }}
      onClose={() => {
        void getCurrentWindow().hide().catch(() => {});
        void emit("tqe:closed", { session });
        setInit(null);
      }}
    />
  );
}
