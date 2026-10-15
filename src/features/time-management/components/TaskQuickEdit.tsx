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
  AlignLeft,
  CalendarDays,
  X,
} from "lucide-react";
import dayjs from "dayjs";
import {
  QuadrantType,
  Task,
  TaskReminder,
  parseReminder,
  serializeReminder,
  TaskDraft,
} from "../types";
import type { Project, ProjectStage } from "@/types/project";
import { hasTaskDescription } from "@/lib/taskDescription";
import { ReactjsTiptapEditor } from "@/components/ui/reactjs-tiptap-editor";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { applyAppThemeStyle } from "@/lib/preferences";
import { PixelScroll } from "@/components/pixel/PixelIcons";
import { TaskProjectPicker } from "./quick-edit/TaskProjectPicker";
import { TaskQuadrantSelector, QUADRANT_META } from "./quick-edit/TaskQuadrantSelector";
import { TaskSchedulePicker } from "./quick-edit/TaskSchedulePicker";

// ==========================================
// TaskQuickEdit — Tailwind v4 规范精简 3-Layer 快捷编辑浮层
// 第一层：标题/描述 + 「日期与提醒」字段 + 象限/优先级旗标
// 第二层：快捷日期 + 月历 + 时间/提醒入口
// 第三层：时间下拉 / 提醒设置
// ==========================================

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
  projects?: Project[];
  stages?: ProjectStage[];
  anchorRect?: AnchorRect;
  initialDate?: string;
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
    ({ task, quadrant, projects = [], stages = [], anchorRect, initialDate, onCommit, onCreate, onClose }, handleRef) => {
      const { isPixelTheme } = useAppThemeStyle();
      const isCreate = !task;
      const [selectedQuadrant, setSelectedQuadrant] = useState<QuadrantType>(
        task?.quadrant ?? quadrant ?? "Q2"
      );
      const quadrantChanged = useRef(false);
      const [flagMenuOpen, setFlagMenuOpen] = useState(false);
      const flagRef = useRef<HTMLButtonElement>(null);
      const flagMenuRef = useRef<HTMLDivElement>(null);
      // ---------- 项目 / 阶段 ----------
      const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
        task?.projectId ?? null
      );
      const [selectedProjectStageId, setSelectedProjectStageId] = useState<string | null>(
        task?.projectStageId ?? null
      );
      const [projectMenuOpen, setProjectMenuOpen] = useState(false);
      const projectRef = useRef<HTMLButtonElement>(null);
      const projectMenuRef = useRef<HTMLDivElement>(null);

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
      const effectiveInitialDate = initDate ?? initialDate ?? null;
      const [dateSel, setDateSel] = useState<string | null>(effectiveInitialDate);
      const [timeSel, setTimeSel] = useState<string>(initTime);
      const [scheduleMode, setScheduleMode] = useState<"point" | "range">(
        task?.scheduleMode === "range" ? "range" : "point"
      );
      const [rangeStartDate, setRangeStartDate] = useState(
        initStartDate ?? effectiveInitialDate ?? dayjs().format("YYYY-MM-DD")
      );
      const [rangeStartTime, setRangeStartTime] = useState(initStartTime || "09:00");
      const [rangeEndDate, setRangeEndDate] = useState(effectiveInitialDate ?? dayjs().format("YYYY-MM-DD"));
      const [rangeEndTime, setRangeEndTime] = useState(initTime || "10:00");
      const [rangeAllDay, setRangeAllDay] = useState(
        task?.scheduleMode === "range" && !initStartTime && !initTime
      );
      const [appliedReminder, setAppliedReminder] = useState<TaskReminder | null>(() =>
        parseReminder(task?.reminder)
      );

      const todayStr = dayjs().format("YYYY-MM-DD");

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
        selectedProjectId,
        selectedProjectStageId,
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
          selectedProjectId,
          selectedProjectStageId,
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
        selectedProjectId,
        selectedProjectStageId,
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
        const effectiveStageId = draft.selectedProjectId
          ? draft.selectedProjectStageId || stages.find((s) => s.projectId === draft.selectedProjectId)?.id
          : undefined;
        onCreate?.({
          title: t,
          description: hasTaskDescription(finalDesc) ? finalDesc : undefined,
          quadrant: q,
          priority: QUADRANT_META[q].priority,
          scheduleMode: scheduledEndAt ? draft.scheduleMode : undefined,
          scheduledStartAt,
          scheduledEndAt,
          reminder: draft.appliedReminder ? serializeReminder(draft.appliedReminder) : undefined,
          projectId: draft.selectedProjectId || undefined,
          projectStageId: effectiveStageId,
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
        const projectChanged = draft.selectedProjectId !== (task.projectId ?? null);
        const effectiveStageId = draft.selectedProjectId
          ? (draft.selectedProjectStageId || (projectChanged ? stages.find((s) => s.projectId === draft.selectedProjectId)?.id : undefined))
          : undefined;
        const next: Partial<Task> = {
          title: latestTitle.current.trim() || task.title,
          description: hasTaskDescription(latestDescription.current)
            ? latestDescription.current
            : undefined,
          quadrant: quadrantChanged.current ? q : task.quadrant,
          priority: quadrantChanged.current ? QUADRANT_META[q].priority : task.priority,
          scheduleMode: scheduledEndAt ? draft.scheduleMode : undefined,
          scheduledStartAt,
          scheduledEndAt,
          reminder: draft.appliedReminder ? serializeReminder(draft.appliedReminder) : undefined,
          projectId: draft.selectedProjectId || undefined,
          projectStageId: effectiveStageId,
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
      const timePopRef = useRef<HTMLDivElement>(null);
      const remindPopRef = useRef<HTMLDivElement>(null);

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
      }, [dateOpen, l1Pos, scheduleMode, rangeAllDay]);

      useLayoutEffect(() => {
        if (!third) {
          setL3Pos(null);
          return;
        }
        const el = third === "time" ? timePopRef.current : remindPopRef.current;
        if (!el) return;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const h = el.offsetHeight;
        const baseLeft = l2Pos ? l2Pos.left : (l1Pos?.left ?? MARGIN);
        const baseTop = l2Pos ? l2Pos.top : (l1Pos?.top ?? MARGIN);
        const left = Math.min(Math.max(baseLeft, MARGIN), vw - L3_WIDTH - MARGIN);
        const top = Math.min(Math.max(baseTop, MARGIN), vh - h - MARGIN);
        setL3Pos({ top, left });
      }, [third, l2Pos, l1Pos]);

      // ---------- 分层关闭 ----------
      const closeOneLayer = (isEscape = false) => {
        if (projectMenuOpen) {
          setProjectMenuOpen(false);
          return;
        }
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

          if (projectMenuRef.current?.contains(t) || projectRef.current?.contains(t)) return;
          if (projectMenuOpen) {
            setProjectMenuOpen(false);
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
      }, [third, dateOpen, flagMenuOpen, projectMenuOpen, task?.id]);

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
            {/* 顶栏：日期与提醒入口 + 项目/阶段选择器 + 象限 / 优先级 Flag + 完成按钮 */}
            <div className={`flex items-center gap-2 px-3.5 py-3 border-b ${isPixelTheme ? "border-border bg-muted/30" : "border-slate-200/60 dark:border-slate-800/80"}`}>
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
                  setProjectMenuOpen(false);
                  setDateOpen((v) => !v);
                }}
              >
                {isPixelTheme ? <PixelScroll size={16} className="flex-shrink-0" /> : <CalendarDays size={17} className="flex-shrink-0" />}
                <span className="truncate">{fieldText}</span>
              </button>

              {/* 项目 / 阶段选择器 */}
              <TaskProjectPicker
                projects={projects}
                stages={stages}
                selectedProjectId={selectedProjectId}
                selectedProjectStageId={selectedProjectStageId}
                onSelectProjectStage={(pId, sId) => {
                  setSelectedProjectId(pId);
                  setSelectedProjectStageId(sId);
                }}
                isOpen={projectMenuOpen}
                onOpenChange={(v) => {
                  if (typeof v === "function" ? v(projectMenuOpen) : v) {
                    setDateOpen(false);
                    setThird(null);
                    setFlagMenuOpen(false);
                  }
                  setProjectMenuOpen(v);
                }}
                triggerRef={projectRef}
                menuRef={projectMenuRef}
              />

              {/* 优先级 / 象限 Flag 选择器 */}
              <TaskQuadrantSelector
                selectedQuadrant={selectedQuadrant}
                onSelectQuadrant={(q) => {
                  setSelectedQuadrant(q);
                  quadrantChanged.current = true;
                }}
                isOpen={flagMenuOpen}
                onOpenChange={(v) => {
                  if (typeof v === "function" ? v(flagMenuOpen) : v) {
                    setDateOpen(false);
                    setThird(null);
                    setProjectMenuOpen(false);
                  }
                  setFlagMenuOpen(v);
                }}
                triggerRef={flagRef}
                menuRef={flagMenuRef}
              />

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

          {/* ===== 第二层与第三层：日期、日程范围与提醒设置 ===== */}
          <TaskSchedulePicker
            dateOpen={dateOpen}
            scheduleMode={scheduleMode}
            onSwitchScheduleMode={switchScheduleMode}
            dateSel={dateSel}
            timeSel={timeSel}
            onCommitDeadline={commitDeadline}
            rangeStartDate={rangeStartDate}
            rangeStartTime={rangeStartTime}
            rangeEndDate={rangeEndDate}
            rangeEndTime={rangeEndTime}
            rangeAllDay={rangeAllDay}
            onCommitRange={(s, st, e, et, allDay) => {
              setRangeStartDate(s);
              setRangeStartTime(st);
              setRangeEndDate(e);
              setRangeEndTime(et);
              setRangeAllDay(allDay);
            }}
            appliedReminder={appliedReminder}
            onSaveReminder={setAppliedReminder}
            third={third}
            setThird={setThird}
            datePopRef={datePopRef}
            timePopRef={timePopRef}
            remindPopRef={remindPopRef}
            l1Pos={l1Pos}
            l2Pos={l2Pos}
            l3Pos={l3Pos}
          />
        </>
      );
    }
  )
);

interface TqeInitPayload {
  session: string;
  task: Task | null;
  quadrant: QuadrantType | null;
  projects?: Project[];
  stages?: ProjectStage[];
  anchor: AnchorRect;
  initialDate?: string;
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
      projects={init.projects ?? []}
      stages={init.stages ?? []}
      anchorRect={init.anchor}
      initialDate={init.initialDate}
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


