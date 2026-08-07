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

// ==========================================
// TaskQuickEdit — Tailwind v4 规范精简 3-Layer 快捷编辑浮层
// 第一层：标题/描述 + 「日期与提醒」字段 + 象限旗标
// 第二层：快捷日期 + 月历 + 时间/提醒入口
// 第三层：时间下拉 / 提醒设置
// ==========================================

const QUADRANT_META: Record<QuadrantType, { name: string; color: string }> = {
  Q1: { name: "重要且紧急", color: "#d32f2f" },
  Q2: { name: "重要不紧急", color: "#25845a" },
  Q3: { name: "紧急不重要", color: "#d97706" },
  Q4: { name: "不重要不紧急", color: "#697381" },
};

const L1_WIDTH = 420;
const L2_WIDTH = 316;
const L3_WIDTH = 288;
const MARGIN = 8;

function splitDeadline(deadline?: number): { date: string | null; time: string } {
  if (!deadline) return { date: null, time: "" };
  const d = dayjs(deadline);
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
  roles?: unknown[];
  onSave?: (taskId: string, updates: Partial<Task>, isHighFreq?: boolean) => void;
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
    ({ task, quadrant, anchorRect, onSave, onCreate, onClose }, handleRef) => {
      const isCreate = !task;
      const meta = QUADRANT_META[task?.quadrant ?? quadrant ?? "Q2"];

      // ---------- 标题 / 描述 ----------
      const [title, setTitle] = useState(task?.title ?? "");
      const [description, setDescription] = useState(task?.description ?? "");
      const latestTitle = useRef(task?.title ?? "");
      const latestDescription = useRef(task?.description ?? "");
      const timers = useRef<Record<string, number>>({});

      useEffect(() => {
        latestTitle.current = title;
      }, [title]);

      useEffect(() => {
        latestDescription.current = description;
      }, [description]);

      const triggerAutoSave = (updates: Partial<Task>, isHighFreq = true) => {
        if (!task || !onSave) return;
        const key = Object.keys(updates)[0];
        if (timers.current[key]) {
          window.clearTimeout(timers.current[key]);
        }
        timers.current[key] = window.setTimeout(() => {
          onSave(task.id, updates, isHighFreq);
          delete timers.current[key];
        }, 500);
      };

      const flushSaves = () => {
        Object.keys(timers.current).forEach((key) => window.clearTimeout(timers.current[key]));
        timers.current = {};
        if (!task || !onSave) return;

        const updates: Partial<Task> = {};
        if (latestTitle.current.trim() && latestTitle.current.trim() !== task.title) {
          updates.title = latestTitle.current.trim();
        }
        const finalDesc = latestDescription.current.trim();
        if (finalDesc !== (task.description || "")) {
          updates.description = finalDesc || undefined;
        }
        if (Object.keys(updates).length > 0) {
          onSave(task.id, updates, false);
        }
      };

      // ---------- 日期 / 时间 / 提醒状态 ----------
      const { date: initDate, time: initTime } = splitDeadline(task?.deadline);
      const [dateSel, setDateSel] = useState<string | null>(initDate);
      const [timeSel, setTimeSel] = useState<string>(initTime);
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
        if (task && onSave) {
          onSave(
            task.id,
            {
              deadline: nextDate ? composeDeadline(nextDate, nextTime) : undefined,
              scheduledDate: nextDate || undefined,
            },
            false
          );
        }
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
        if (task && onSave) {
          onSave(task.id, { reminder: next ? serializeReminder(next) : undefined }, false);
        }
        setThird(null);
      };

      // ---------- 新建模式提交 ----------
      const draftRef = useRef({ dateSel, timeSel, appliedReminder });
      useEffect(() => {
        draftRef.current = { dateSel, timeSel, appliedReminder };
      });

      const submitCreate = () => {
        const t = latestTitle.current.trim();
        if (!t) return;
        const { dateSel: d, timeSel: tm, appliedReminder: r } = draftRef.current;
        const finalDesc = latestDescription.current.trim();
        onCreate?.({
          title: t,
          description: finalDesc || undefined,
          deadline: d ? composeDeadline(d, tm) : undefined,
          scheduledDate: d || undefined,
          reminder: r ? serializeReminder(r) : undefined,
        });
      };

      const handleClose = () => {
        if (isCreate) submitCreate();
        else flushSaves();
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
      }, [dateOpen, l1Pos, viewYM]);

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

      useEffect(() => {
        if (third === "time") {
          const sel = timeListRef.current?.querySelector(".sel");
          sel?.scrollIntoView({ block: "center" });
        }
      }, [third]);

      // ---------- 分层关闭 ----------
      const closeOneLayer = () => {
        if (third) {
          setThird(null);
          return;
        }
        if (dateOpen) {
          setDateOpen(false);
          return;
        }
        handleClose();
      };

      useImperativeHandle(handleRef, () => ({
        closeTopLayer: closeOneLayer,
        closeAll: handleClose,
      }));

      useEffect(() => {
        const onMouseDown = (e: MouseEvent) => {
          const t = e.target as Node;
          if (!t || !document.body.contains(t)) return;

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
          if (e.key !== "Escape") return;
          closeOneLayer();
        };
        document.addEventListener("mousedown", onMouseDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
          document.removeEventListener("mousedown", onMouseDown);
          document.removeEventListener("keydown", onKeyDown);
        };
      }, [third, dateOpen, task?.id]);

      // ---------- 字段文本 ----------
      const fieldText = useMemo(() => {
        if (!dateSel) return "日期与提醒";
        const d = dayjs(dateSel);
        let text = `${d.month() + 1}月${d.date()}日`;
        if (timeSel) text += ` ${timeSel}`;
        if (appliedReminder) text += ` · ${reminderLabel(appliedReminder)}提醒`;
        return text;
      }, [dateSel, timeSel, appliedReminder]);

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
        const el = popRef.current?.querySelector<HTMLTextAreaElement>(".tqe-desc-input");
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
            className="fixed z-[1050] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-2xl text-slate-900 dark:text-slate-100 animate-in fade-in duration-100 select-none overflow-hidden"
          >
            {/* 顶栏：日期与提醒入口 + 象限 Flag */}
            <div className="flex items-center gap-2.5 px-3.5 py-3 border-b border-slate-200/60 dark:border-slate-800/80">
              <button
                ref={dateFieldRef}
                type="button"
                className={`flex-1 inline-flex items-center gap-2 text-[13.5px] px-2 py-1 rounded-lg transition-colors cursor-pointer min-w-0 ${
                  dateSel
                    ? "text-blue-600 dark:text-blue-400 font-semibold bg-blue-50/50 dark:bg-blue-950/30"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
                onClick={() => {
                  setThird(null);
                  setDateOpen((v) => !v);
                }}
              >
                <CalendarDays size={17} className="flex-shrink-0" />
                <span className="truncate">{fieldText}</span>
              </button>
              <button
                type="button"
                className="p-1 rounded-lg flex-shrink-0 grid place-items-center cursor-default"
                title={`所属象限：${meta.name}`}
                aria-label={`所属象限：${meta.name}`}
                style={{ color: meta.color }}
              >
                <Flag size={17} fill="currentColor" />
              </button>
            </div>

            {/* 编辑主体：标题 + 描述 */}
            <div className="p-3.5 flex flex-col gap-2.5">
              <div className="flex items-center gap-2.5">
                <input
                  type="text"
                  placeholder="准备做什么？"
                  value={title}
                  autoFocus
                  className="flex-1 bg-transparent border-0 outline-none text-base font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 min-w-0"
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (e.target.value.trim()) {
                      triggerAutoSave({ title: e.target.value.trim() }, true);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    if (isCreate) handleClose();
                    else (e.currentTarget as HTMLInputElement).blur();
                  }}
                  onBlur={() => {
                    if (!title.trim() && task) setTitle(task.title);
                  }}
                />
                <button
                  type="button"
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer flex-shrink-0"
                  title="任务描述"
                  aria-label="任务描述"
                  onClick={focusDesc}
                >
                  <AlignLeft size={17} />
                </button>
              </div>

              <div className="min-h-[148px] max-h-[260px] overflow-y-auto">
                <textarea
                  placeholder="添加任务备注描述..."
                  value={description}
                  className="tqe-desc-input w-full h-full min-h-[148px] bg-transparent border-0 outline-none resize-none text-xs leading-relaxed text-slate-600 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  onChange={(e) => {
                    setDescription(e.target.value);
                    triggerAutoSave({ description: e.target.value }, true);
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
              className="fixed z-[1060] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-2xl p-3.5 text-slate-900 dark:text-slate-100 animate-in fade-in duration-100 select-none"
            >
              {/* 快捷日期图标 */}
              <div className="flex justify-around mb-3">
                <button
                  type="button"
                  title="今天"
                  aria-label="今天"
                  className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer grid place-items-center"
                  onClick={() => quickPick(0)}
                >
                  <Sun size={20} />
                </button>
                <button
                  type="button"
                  title="明天"
                  aria-label="明天"
                  className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer grid place-items-center"
                  onClick={() => quickPick(1)}
                >
                  <Sunrise size={20} />
                </button>
                <button
                  type="button"
                  title="下周（+7 天）"
                  aria-label="下周，加 7 天"
                  className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer grid place-items-center"
                  onClick={() => quickPick(7)}
                >
                  <CalendarPlus size={20} />
                </button>
                <button
                  type="button"
                  title="今晚 20:00"
                  aria-label="今晚"
                  className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer grid place-items-center"
                  onClick={() => quickPick(0, "20:00")}
                >
                  <Moon size={20} />
                </button>
              </div>

              {/* 年月导航 */}
              <div className="flex items-center text-sm font-bold text-slate-900 dark:text-slate-100 px-1 py-1 mb-1">
                {viewYM.y}年{viewYM.m + 1}月
                <span className="ml-auto flex items-center gap-0.5">
                  <button
                    type="button"
                    aria-label="上个月"
                    className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
                    onClick={() => shiftMonth(-1)}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label="回到今天"
                    className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
                    onClick={() => setViewYM({ y: dayjs().year(), m: dayjs().month() })}
                  >
                    <Circle size={7} />
                  </button>
                  <button
                    type="button"
                    aria-label="下个月"
                    className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
                    onClick={() => shiftMonth(1)}
                  >
                    <ChevronRight size={14} />
                  </button>
                </span>
              </div>

              {/* 日历网格 */}
              <div className="grid grid-cols-7 gap-y-0.5 text-center">
                {["一", "二", "三", "四", "五", "六", "日"].map((w) => (
                  <span key={w} className="text-xs text-slate-400 dark:text-slate-500 py-1">
                    {w}
                  </span>
                ))}
                {calendarCells.map((cell) => (
                  <button
                    key={cell.ymd}
                    type="button"
                    className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center text-xs tabular-nums transition-colors cursor-pointer ${
                      cell.dim
                        ? "text-slate-300 dark:text-slate-600 opacity-60"
                        : cell.ymd === dateSel
                        ? "bg-blue-600 text-white font-bold"
                        : cell.ymd === todayStr
                        ? "ring-1 ring-blue-500/50 text-slate-900 dark:text-slate-100 font-semibold"
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

              {/* 时间 & 提醒 入口 */}
              <div className="border-t border-slate-200/60 dark:border-slate-800 mt-2.5 pt-1.5 flex flex-col gap-0.5">
                <button
                  ref={timeRowRef}
                  type="button"
                  className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors cursor-pointer"
                  onClick={() => setThird((t) => (t === "time" ? null : "time"))}
                >
                  <Clock size={16} className="text-slate-400 flex-shrink-0" />
                  <span>时间</span>
                  <span
                    className={`ml-auto text-xs ${
                      timeSel
                        ? "text-blue-600 dark:text-blue-400 font-semibold"
                        : "text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    {timeSel}
                  </span>
                  <span className="text-slate-400 text-xs ml-0.5">›</span>
                </button>
                <button
                  ref={remindRowRef}
                  type="button"
                  className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors cursor-pointer"
                  onClick={() => (third === "remind" ? setThird(null) : openRemind())}
                >
                  <Bell size={16} className="text-slate-400 flex-shrink-0" />
                  <span>提醒</span>
                  <span
                    className={`ml-auto text-xs ${
                      appliedReminder
                        ? "text-blue-600 dark:text-blue-400 font-semibold"
                        : "text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    {appliedReminder ? reminderLabel(appliedReminder) : ""}
                  </span>
                  <span className="text-slate-400 text-xs ml-0.5">›</span>
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
              className="fixed z-[1070] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in duration-100 select-none"
            >
              <div className="max-h-[252px] overflow-y-auto p-1.5 flex flex-col gap-0.5" ref={timeListRef}>
                {timeOptions.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs tabular-nums rounded-lg text-left transition-colors cursor-pointer ${
                      t === timeSel
                        ? "sel text-blue-600 dark:text-blue-400 font-semibold bg-blue-50/60 dark:bg-blue-950/40"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                    onClick={() => {
                      commitDeadline(dateSel || todayStr, t);
                      setThird(null);
                    }}
                  >
                    <span>{t}</span>
                    {t === timeSel && <span className="text-blue-600 dark:text-blue-400 font-bold">✓</span>}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 border-t border-slate-200/60 dark:border-slate-800 px-3 py-2 bg-slate-50 dark:bg-slate-950">
                <Clock size={15} className="text-slate-400 flex-shrink-0" />
                <input
                  type="text"
                  value={timeInput}
                  placeholder="HH:mm"
                  aria-label="输入时间"
                  className="flex-1 bg-transparent border-0 outline-none text-xs tabular-nums text-blue-600 dark:text-blue-400 font-semibold min-w-0"
                  onChange={(e) => setTimeInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && commitTimeInput()}
                  onBlur={commitTimeInput}
                />
                <button
                  type="button"
                  aria-label="清除时间"
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm px-1.5 py-0.5 rounded-md cursor-pointer"
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
              className="fixed z-[1070] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-2xl p-2 animate-in fade-in duration-100 select-none flex flex-col gap-0.5 text-slate-900 dark:text-slate-100"
            >
              {[0, 1, 2, 3, 7].map((off) => (
                <button
                  key={off}
                  type="button"
                  className={`w-full flex items-baseline gap-1.5 px-3 py-2 text-xs rounded-xl text-left transition-colors cursor-pointer ${
                    !customMode && draftOffset === off
                      ? "text-blue-600 dark:text-blue-400 font-semibold bg-blue-50/60 dark:bg-blue-950/40"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                  onClick={() => {
                    setCustomMode(false);
                    setDraftOffset((prev) => (prev === off && !customMode ? null : off));
                  }}
                >
                  <span>{off === 0 ? "当天" : `提前 ${off} 天`}</span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">({draftTime})</span>
                </button>
              ))}
              <button
                type="button"
                className={`w-full flex items-baseline gap-1.5 px-3 py-2 text-xs rounded-xl text-left transition-colors cursor-pointer ${
                  customMode
                    ? "text-blue-600 dark:text-blue-400 font-semibold bg-blue-50/60 dark:bg-blue-950/40"
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
                <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
                  <label className="inline-flex items-center gap-1.5">
                    提前
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={draftOffset ?? 0}
                      className="w-12 px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      onChange={(e) =>
                        setDraftOffset(Math.max(0, Math.min(30, Number(e.target.value) || 0)))
                      }
                    />
                    天
                  </label>
                  <input
                    type="time"
                    value={draftTime}
                    className="px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    onChange={(e) => setDraftTime(e.target.value || "09:00")}
                  />
                </div>
              )}
              <div className="flex items-center justify-between border-t border-slate-200/60 dark:border-slate-800 mt-1 pt-2 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300">
                <span>持续提醒</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={draftRepeat}
                  aria-label="持续提醒"
                  className={`w-9 h-5 rounded-full relative transition-colors cursor-pointer ${
                    draftRepeat ? "bg-blue-600" : "bg-slate-200 dark:bg-slate-700"
                  }`}
                  onClick={() => setDraftRepeat((v) => !v)}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-xs transition-transform ${
                      draftRepeat ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
              <div className="flex gap-2 p-1.5 pt-2">
                <button
                  type="button"
                  className="flex-1 text-xs font-semibold py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer"
                  onClick={saveRemind}
                >
                  保存
                </button>
                <button
                  type="button"
                  className="flex-1 text-xs font-semibold py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  onClick={() => setThird(null)}
                >
                  取消
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
  session: number;
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
    const pending: Promise<UnlistenFn>[] = [
      listen<TqeInitPayload>("tqe:init", (e) => setInit(e.payload)),
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
      onSave={(taskId, updates, isHighFreq) => {
        void emit("tqe:save", {
          session,
          taskId,
          updates: toWire(updates),
          isHighFreq: isHighFreq ?? true,
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
