import { useEffect, useMemo, useRef, useState } from "react";
import {
  Maximize2,
  Minimize2,
  Pause,
  Pin,
  PinOff,
  Play,
  SkipForward,
  Square,
  X,
} from "lucide-react";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { useFocusTaskOptions } from "@/hooks/useTimeManagement";
import { focusAssistantApi } from "@/services/focusAssistantService";
import { sendDesktopNotification } from "@/services/notificationService";
import type { FocusSession, FocusSessionType } from "@/types/focusAssistant";

type Status = "ready" | "running" | "paused";
type ViewMode = "normal" | "minimized";

const clamp = (value: number) => Math.max(1, Math.min(180, Number.isFinite(value) ? Math.floor(value) : 1));

// Clock Ring with Dotted Dial (Matching Screenshot Style)
function ClockRing({
  secondsLeft,
  totalSeconds,
  size = 170,
  dotCount = 30,
}: {
  secondsLeft: number;
  totalSeconds: number;
  size?: number;
  dotCount?: number;
}) {
  const progressRatio = totalSeconds > 0 ? (totalSeconds - secondsLeft) / totalSeconds : 0;
  const radius = size * 0.38;
  const center = size / 2;
  const activeDots = Math.round(progressRatio * dotCount);

  const dots = useMemo(() => {
    const list = [];
    for (let i = 0; i < dotCount; i++) {
      const angle = (i / dotCount) * 2 * Math.PI - Math.PI / 2;
      const x = center + radius * Math.cos(angle);
      const y = center + radius * Math.sin(angle);
      list.push({ x, y, isActive: i < activeDots });
    }
    return list;
  }, [dotCount, radius, center, activeDots]);

  const displayMinutes = Math.max(1, Math.ceil(secondsLeft / 60));

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0">
        {dots.map((dot, idx) => (
          <circle
            key={idx}
            cx={dot.x}
            cy={dot.y}
            r={size * 0.019}
            className={
              dot.isActive
                ? "fill-blue-500 transition-colors duration-300"
                : "fill-slate-200 dark:fill-slate-700 transition-colors duration-300"
            }
          />
        ))}
      </svg>
      <div className="z-10 flex items-baseline justify-center gap-1 select-none">
        <span className="text-4xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
          {secondsLeft < 60 ? secondsLeft : displayMinutes}
        </span>
        <span className="text-base font-medium text-slate-600 dark:text-slate-300">
          {secondsLeft < 60 ? "秒" : "分钟"}
        </span>
      </div>
    </div>
  );
}

export function FocusAssistant() {
  const { data: tasks = [] } = useFocusTaskOptions();

  const [focusMinutes, setFocusMinutes] = useState(25);
  const [restMinutes, setRestMinutes] = useState(5);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [status, setStatus] = useState<Status>("ready");
  const [viewMode, setViewMode] = useState<ViewMode>("normal");
  const [type, setType] = useState<FocusSessionType>("focus");
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [session, setSession] = useState<FocusSession | null>(null);
  const [focusSessionId, setFocusSessionId] = useState<string | null>(null);
  const [isPinned, setIsPinned] = useState(true);

  const startedAt = useRef<number | null>(null);
  const remainingRef = useRef(secondsLeft);
  const sessionRef = useRef<FocusSession | null>(null);
  const typeRef = useRef(type);
  const statusRef = useRef(status);
  const viewModeRef = useRef(viewMode);
  const selectedTaskRef = useRef(selectedTaskId);
  const isCompletingRef = useRef(false);

  useEffect(() => {
    remainingRef.current = secondsLeft;
  }, [secondsLeft]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    typeRef.current = type;
  }, [type]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    selectedTaskRef.current = selectedTaskId;
  }, [selectedTaskId]);

  useEffect(() => {
    if (status === "ready" && selectedTaskId && !tasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId("");
    }
  }, [status, selectedTaskId, tasks]);

  const activeSeconds = () =>
    Math.max(
      0,
      (sessionRef.current?.plannedMinutes ?? (typeRef.current === "focus" ? focusMinutes : restMinutes)) * 60 -
      remainingRef.current
    );

  const setDuration = (setter: (v: number) => void, value: number, currentType: FocusSessionType) => {
    const next = clamp(value);
    setter(next);
    if (status === "ready" && currentType === type) {
      setSecondsLeft(next * 60);
    }
  };

  const start = async (nextType: FocusSessionType = "focus", existingCycle?: string) => {
    isCompletingRef.current = false;
    const minutes = nextType === "focus" ? focusMinutes : restMinutes;

    // Synchronously set local state so state & timer transition immediately
    setType(nextType);
    setSecondsLeft(minutes * 60);
    remainingRef.current = minutes * 60;
    startedAt.current = Date.now();
    setStatus("running");

    try {
      const created = await focusAssistantApi.create({
        cycleId: existingCycle ?? crypto.randomUUID(),
        taskId: nextType === "focus" ? selectedTaskId || null : selectedTaskRef.current || null,
        type: nextType,
        status: "running",
        plannedMinutes: minutes,
        activeSeconds: 0,
        restCompleted: false,
        startedAt: new Date().toISOString(),
      });
      if (nextType === "focus") setFocusSessionId(created.id);
      setSession(created);
    } catch (e) {
      console.error("Failed to create focus session", e);
    }
  };

  const pause = async () => {
    if (!session) return;
    const elapsed = activeSeconds();
    startedAt.current = null;
    setStatus("paused");
    await focusAssistantApi.update(session.id, { status: "paused", activeSeconds: elapsed });
    setSession({ ...session, status: "paused", activeSeconds: elapsed });
  };

  const resume = async () => {
    if (!session) return;
    startedAt.current = Date.now();
    setStatus("running");
    await focusAssistantApi.update(session.id, { status: "running" });
    setSession({ ...session, status: "running" });
  };

  const stop = async () => {
    isCompletingRef.current = false;
    if (!session) return;
    const elapsed = activeSeconds();
    await focusAssistantApi.update(session.id, {
      status: "interrupted",
      activeSeconds: elapsed,
      endedAt: new Date().toISOString(),
    });
    setSession(null);
    setFocusSessionId(null);
    setStatus("ready");
    setType("focus");
    setSecondsLeft(focusMinutes * 60);
    startedAt.current = null;
  };

  const complete = async () => {
    if (isCompletingRef.current) return;
    const current = sessionRef.current;
    if (!current) return;

    isCompletingRef.current = true;
    setStatus("paused"); // Freeze timer interval

    const currentSessionType = typeRef.current; // Snapshot session type

    await focusAssistantApi.update(current.id, {
      status: "completed",
      activeSeconds: current.plannedMinutes * 60,
      endedAt: new Date().toISOString(),
    });

    if (currentSessionType === "focus") {
      if (viewModeRef.current === "minimized") {
        void sendDesktopNotification("专注完成", "专注完成，请开始休息吧");
      }
      await start("rest", current.cycleId);
    } else {
      if (focusSessionId) await focusAssistantApi.update(focusSessionId, { restCompleted: true });
      if (viewModeRef.current === "minimized") {
        void sendDesktopNotification("休息结束", "准备开始下一轮专注。");
      }
      setSession(null);
      setFocusSessionId(null);
      setType("focus");
      setSecondsLeft(focusMinutes * 60);
      setStatus("ready");
      startedAt.current = null;
      isCompletingRef.current = false;
    }
  };

  const skipFocus = async () => {
    if (isCompletingRef.current) return;
    const current = sessionRef.current;
    if (!current || typeRef.current !== "focus") return;

    isCompletingRef.current = true;
    setStatus("paused"); // Freeze timer interval

    const elapsed = activeSeconds();
    await focusAssistantApi.update(current.id, {
      status: "completed",
      activeSeconds: elapsed,
      endedAt: new Date().toISOString(),
    });
    if (viewModeRef.current === "minimized") {
      void sendDesktopNotification("已跳过专注", "开始休息吧");
    }
    await start("rest", current.cycleId);
  };

  useEffect(() => {
    if (status !== "running") return;
    const timer = window.setInterval(() => {
      const next = Math.max(0, remainingRef.current - 1);
      setSecondsLeft(next);
      if (next === 0) void complete();
    }, 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => {
    return () => {
      const current = sessionRef.current;
      if (current && (current.status === "running" || current.status === "paused")) {
        void focusAssistantApi.update(current.id, {
          status: "interrupted",
          activeSeconds: activeSeconds(),
          endedAt: new Date().toISOString(),
        });
      }
    };
  }, []);

  const hide = () => void getCurrentWindow().hide().catch(() => undefined);
  const minimize = () => {
    setViewMode("minimized");
    void getCurrentWindow().setSize(new LogicalSize(140, 140)).catch(() => undefined);
  };
  const restore = () => {
    setViewMode("normal");
    void getCurrentWindow().setSize(new LogicalSize(340, 400)).catch(() => undefined);
  };
  const togglePin = async () => {
    const next = !isPinned;
    await getCurrentWindow().setAlwaysOnTop(next);
    setIsPinned(next);
  };

  const totalSeconds = (type === "focus" ? focusMinutes : restMinutes) * 60;

  // 1. Minimized / Floating Ball View (悬浮球状态 - 时钟表盘)
  if (viewMode === "minimized") {
    return (
      <div
        className="flex h-screen w-screen items-center justify-center bg-transparent"
        data-tauri-drag-region
      >
        <div
          onClick={restore}
          data-tauri-drag-region
          className="group relative flex h-32 w-32 items-center justify-center rounded-full border border-slate-200/80 bg-white/95 shadow-2xl backdrop-blur transition-transform hover:scale-105 active:scale-95 cursor-pointer select-none dark:border-slate-700/80 dark:bg-slate-900/95"
          title="点击展开专注助手，拖拽移动"
        >
          <ClockRing secondsLeft={secondsLeft} totalSeconds={totalSeconds} size={120} dotCount={24} />
          <div
            data-tauri-drag-region
            className="absolute inset-0 flex items-center justify-center rounded-full bg-slate-900/10 opacity-0 transition-opacity group-hover:opacity-100 dark:bg-white/10"
          >
            <Maximize2 size={20} className="text-blue-600 dark:text-blue-400" />
          </div>
        </div>
      </div>
    );
  }

  // 2. Normal View (Ready / Running / Paused - 全局背景可拖拽，除按钮/输入框外)
  return (
    <div
      data-tauri-drag-region
      className="flex h-screen w-screen flex-col rounded-3xl border border-white/60 bg-white/95 p-4 text-slate-800 shadow-2xl backdrop-blur select-none dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100"
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between shrink-0" data-tauri-drag-region>
        <button
          onClick={minimize}
          title="缩小为悬浮球"
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          data-tauri-drag-region="false"
        >
          <Minimize2 size={16} />
        </button>

        <div className="text-sm font-semibold text-slate-800 dark:text-slate-200" data-tauri-drag-region>
          {status === "ready"
            ? "专注设置"
            : type === "focus"
            ? "专注时间段"
            : "休息时间段"}
        </div>

        <div className="flex items-center gap-1" data-tauri-drag-region="false">
          <button
            onClick={togglePin}
            title={isPinned ? "取消置顶" : "置顶"}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            data-tauri-drag-region="false"
          >
            {isPinned ? <Pin size={15} className="text-blue-600" /> : <PinOff size={15} />}
          </button>
          <button
            onClick={hide}
            title="关闭"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            data-tauri-drag-region="false"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Main Body */}
      {status === "ready" ? (
        // 配置状态
        <div className="flex flex-1 flex-col justify-center px-3 py-2 space-y-4" data-tauri-drag-region>
          {/* 关联 标签 + 下拉框 */}
          <div className="flex items-center gap-3" data-tauri-drag-region>
            <label className="w-12 text-sm font-medium text-slate-700 dark:text-slate-300 shrink-0" data-tauri-drag-region>
              关联
            </label>
            <select
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-xs focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              data-tauri-drag-region="false"
            >
              <option value="">选择关联任务</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </div>

          {/* 专注 标签 + 输入框 */}
          <div className="flex items-center gap-3" data-tauri-drag-region>
            <label className="w-12 text-sm font-medium text-slate-700 dark:text-slate-300 shrink-0" data-tauri-drag-region>
              专注
            </label>
            <div
              className="flex flex-1 items-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-xs focus-within:border-blue-500 dark:border-slate-700 dark:bg-slate-800"
              data-tauri-drag-region="false"
            >
              <input
                type="number"
                min="1"
                max="180"
                value={focusMinutes}
                onChange={(e) => setDuration(setFocusMinutes, Number(e.target.value), "focus")}
                className="w-full bg-transparent text-sm font-medium text-slate-800 outline-none dark:text-slate-100"
                data-tauri-drag-region="false"
              />
              <span className="ml-2 text-sm text-slate-500 shrink-0" data-tauri-drag-region="false">分钟</span>
            </div>
          </div>

          {/* 休息 标签 + 输入框 */}
          <div className="flex items-center gap-3" data-tauri-drag-region>
            <label className="w-12 text-sm font-medium text-slate-700 dark:text-slate-300 shrink-0" data-tauri-drag-region>
              休息
            </label>
            <div
              className="flex flex-1 items-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-xs focus-within:border-blue-500 dark:border-slate-700 dark:bg-slate-800"
              data-tauri-drag-region="false"
            >
              <input
                type="number"
                min="1"
                max="180"
                value={restMinutes}
                onChange={(e) => setDuration(setRestMinutes, Number(e.target.value), "rest")}
                className="w-full bg-transparent text-sm font-medium text-slate-800 outline-none dark:text-slate-100"
                data-tauri-drag-region="false"
              />
              <span className="ml-2 text-sm text-slate-500 shrink-0" data-tauri-drag-region="false">分钟</span>
            </div>
          </div>

          {/* 开始专注按钮 */}
          <div className="pt-2" data-tauri-drag-region>
            <button
              onClick={() => void start()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-blue-700 active:bg-blue-800"
              data-tauri-drag-region="false"
            >
              <Play size={16} fill="currentColor" />
              开始专注时段
            </button>
          </div>
        </div>
      ) : (
        // 倒计时运行 / 暂停状态
        <div className="flex flex-1 flex-col items-center justify-between py-2" data-tauri-drag-region>
          {/* 时钟表盘 */}
          <div className="my-auto flex flex-col items-center" data-tauri-drag-region>
            <ClockRing secondsLeft={secondsLeft} totalSeconds={totalSeconds} size={175} dotCount={30} />

            {/* 控制按钮组 */}
            <div className="mt-4 flex items-center justify-center gap-4" data-tauri-drag-region="false">
              <button
                onClick={() => void (status === "paused" ? resume() : pause())}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-white shadow-md transition-transform hover:scale-105 active:scale-95"
                title={status === "paused" ? "继续" : "暂停"}
                data-tauri-drag-region="false"
              >
                {status === "paused" ? <Play size={18} fill="currentColor" /> : <Pause size={18} fill="currentColor" />}
              </button>

              {type === "focus" && (
                <button
                  onClick={() => void skipFocus()}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-transform hover:scale-105 active:scale-95"
                  title="跳过当前专注，开始休息"
                  data-tauri-drag-region="false"
                >
                  <SkipForward size={15} />
                </button>
              )}

              <button
                onClick={() => void stop()}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                title="提前结束"
                data-tauri-drag-region="false"
              >
                <Square size={14} fill="currentColor" />
              </button>
            </div>
          </div>

          {/* 下一个阶段提示 */}
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400" data-tauri-drag-region>
            下一个: {type === "focus" ? `${restMinutes} 分钟休息` : `${focusMinutes} 分钟专注`}
          </div>
        </div>
      )}
    </div>
  );
}
