import { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  X,
  MoreHorizontal,
  ChevronRight,
  Search,
  Check,
  RotateCcw,
  Sparkles,
  Sun,
  Moon,
  Layers,
  StopCircle,
  Coffee,
} from "lucide-react";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { useFocusTaskOptions } from "@/hooks/useTimeManagement";
import { useHabitData } from "@/hooks/useHabits";
import { focusAssistantApi, FocusStats } from "@/services/focusAssistantService";
import { sendDesktopNotification } from "@/services/notificationService";
import { useAuth } from "@/lib/auth";
import type { FocusSession, FocusSessionType } from "@/types/focusAssistant";
import { cn } from "@/lib/utils";
import { createFocusCycleId } from "@/lib/entityIds";

type Status = "ready" | "running" | "paused";
type ActiveModal = "none" | "task-selector" | "time-editor" | "menu" | "style-menu";
type StyleTheme = "light" | "dark" | "glass" | "minimal";

interface SelectedTarget {
  type: "none" | "task" | "habit";
  id: string;
  name: string;
}

const REST_MINUTES = 5;
const clamp = (val: number, min = 1, max = 180) => Math.max(min, Math.min(max, Number.isFinite(val) ? Math.floor(val) : min));

async function setWindowGeometry(width: number, height: number) {
  try {
    const win = getCurrentWindow();
    await win.setSize(new LogicalSize(width, height));
  } catch {
    // Non-tauri fallback
  }
}

export function FocusAssistant() {
  const { userId } = useAuth();
  const { data: tasks = [] } = useFocusTaskOptions();
  const { data: habitData } = useHabitData();
  const habits = habitData?.habits ?? [];

  // Persistent preferences
  const [focusMinutes, setFocusMinutes] = useState<number>(() => {
    const saved = localStorage.getItem("workbuddy.focusAssistant.minutes");
    return saved ? clamp(Number(saved)) : 25;
  });

  const [restMinutes, setRestMinutes] = useState<number>(() => {
    const saved = localStorage.getItem("workbuddy.focusAssistant.restMinutes");
    return saved ? clamp(Number(saved), 1, 60) : 5;
  });

  const [selectedTarget, setSelectedTarget] = useState<SelectedTarget>(() => {
    const saved = localStorage.getItem("workbuddy.focusAssistant.target");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return { type: "none", id: "", name: "专注" };
  });

  const [theme, setTheme] = useState<StyleTheme>(() => {
    return (localStorage.getItem("workbuddy.focusAssistant.theme") as StyleTheme) || "light";
  });

  const [isPinned, setIsPinned] = useState<boolean>(() => {
    const saved = localStorage.getItem("workbuddy.focusAssistant.pinned");
    return saved !== null ? saved === "true" : true;
  });

  const [showStats, setShowStats] = useState<boolean>(() => {
    return localStorage.getItem("workbuddy.focusAssistant.showStats") === "true";
  });

  // State
  const [activeModal, setActiveModal] = useState<ActiveModal>("none");
  const [status, setStatus] = useState<Status>("ready");
  const [sessionType, setSessionType] = useState<FocusSessionType>("focus");
  const [secondsLeft, setSecondsLeft] = useState(focusMinutes * 60);
  const [session, setSession] = useState<FocusSession | null>(null);
  const [stats, setStats] = useState<FocusStats>({ todayMinutes: 0, weekMinutes: 0 });

  // Modal Temp States
  const [editFocusInput, setEditFocusInput] = useState<string>(String(focusMinutes));
  const [editRestInput, setEditRestInput] = useState<string>(String(restMinutes));
  const [selectorTab, setSelectorTab] = useState<"task" | "habit">("task");
  const [searchQuery, setSearchQuery] = useState("");

  const startedAt = useRef<number | null>(null);
  const remainingRef = useRef(secondsLeft);
  const sessionRef = useRef<FocusSession | null>(null);
  const sessionTypeRef = useRef<FocusSessionType>(sessionType);
  const isCompletingRef = useRef(false);

  useEffect(() => {
    remainingRef.current = secondsLeft;
  }, [secondsLeft]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    sessionTypeRef.current = sessionType;
  }, [sessionType]);

  // Load stats
  const refreshStats = async () => {
    if (!userId) return;
    try {
      const data = await focusAssistantApi.getFocusStats(userId);
      setStats(data);
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    refreshStats();
  }, [userId, status]);

  // Handle window sizing according to active state/modal
  useEffect(() => {
    if (activeModal === "task-selector") {
      setWindowGeometry(200, 280);
    } else if (activeModal === "time-editor") {
      setWindowGeometry(200, 180);
    } else if (activeModal === "menu" || activeModal === "style-menu") {
      setWindowGeometry(200, 210);
    } else if (showStats) {
      setWindowGeometry(200, 140);
    } else {
      setWindowGeometry(200, 75);
    }
  }, [activeModal, showStats]);

  // Setup scale change & pin listener
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const setupListener = async () => {
      try {
        const win = getCurrentWindow();
        await win.setAlwaysOnTop(isPinned);
        unlisten = await win.onScaleChanged(async () => {
          if (activeModal === "task-selector") {
            await win.setSize(new LogicalSize(200, 280)).catch(() => undefined);
          } else if (activeModal === "time-editor") {
            await win.setSize(new LogicalSize(200, 180)).catch(() => undefined);
          } else if (activeModal === "menu" || activeModal === "style-menu") {
            await win.setSize(new LogicalSize(200, 210)).catch(() => undefined);
          } else if (showStats) {
            await win.setSize(new LogicalSize(200, 140)).catch(() => undefined);
          } else {
            await win.setSize(new LogicalSize(200, 75)).catch(() => undefined);
          }
        });
      } catch {
        // Browser fallback
      }
    };
    setupListener();
    return () => {
      if (unlisten) unlisten();
    };
  }, [isPinned, activeModal, showStats]);

  // Actions
  const startFocus = async () => {
    isCompletingRef.current = false;
    const minutes = focusMinutes;
    setSessionType("focus");
    sessionTypeRef.current = "focus";
    setSecondsLeft(minutes * 60);
    remainingRef.current = minutes * 60;
    startedAt.current = Date.now();
    setStatus("running");

    try {
      const created = await focusAssistantApi.create({
        cycleId: createFocusCycleId(),
        taskId: selectedTarget.type === "task" && selectedTarget.id ? selectedTarget.id : null,
        type: "focus",
        status: "running",
        plannedMinutes: minutes,
        activeSeconds: 0,
        restCompleted: false,
      });
      setSession(created);
    } catch (e) {
      console.error("Failed to start focus session", e);
    }
  };

  const startRest = async (cycleId?: string, taskId?: string | null) => {
    isCompletingRef.current = false;
    const minutes = restMinutes;
    setSessionType("rest");
    sessionTypeRef.current = "rest";
    setSecondsLeft(minutes * 60);
    remainingRef.current = minutes * 60;
    startedAt.current = Date.now();
    setStatus("running");

    try {
      const created = await focusAssistantApi.create({
        cycleId: cycleId || createFocusCycleId(),
        taskId: taskId ?? (selectedTarget.type === "task" && selectedTarget.id ? selectedTarget.id : null),
        type: "rest",
        status: "running",
        plannedMinutes: minutes,
        activeSeconds: 0,
        restCompleted: false,
      });
      setSession(created);
    } catch (e) {
      console.error("Failed to start rest session", e);
    }
  };

  const pause = async () => {
    if (!session) return;
    const totalPlannedSec = (sessionTypeRef.current === "rest" ? restMinutes : focusMinutes) * 60;
    const activeSec = Math.max(0, totalPlannedSec - remainingRef.current);
    startedAt.current = null;
    setStatus("paused");
    try {
      await focusAssistantApi.update(session.id, { status: "paused", activeSeconds: activeSec });
      setSession({ ...session, status: "paused", activeSeconds: activeSec });
    } catch (e) {
      console.error("Failed to pause session", e);
    }
  };

  const resume = async () => {
    if (!session) return;
    startedAt.current = Date.now();
    setStatus("running");
    try {
      await focusAssistantApi.update(session.id, { status: "running" });
      setSession({ ...session, status: "running" });
    } catch (e) {
      console.error("Failed to resume session", e);
    }
  };

  const stopFocusAndStartRest = async () => {
    if (isCompletingRef.current) return;
    isCompletingRef.current = true;
    const cur = sessionRef.current;
    const activeSec = Math.max(0, focusMinutes * 60 - remainingRef.current);
    const cycleId = cur?.cycleId || createFocusCycleId();
    const taskId = cur?.taskId ?? (selectedTarget.type === "task" && selectedTarget.id ? selectedTarget.id : null);

    if (cur) {
      try {
        await focusAssistantApi.update(cur.id, {
          status: activeSec >= 60 ? "completed" : "interrupted",
          activeSeconds: activeSec,
        });
      } catch (e) {
        console.error("Failed to stop focus session", e);
      }
    }

    void sendDesktopNotification(
      "专注结束",
      `本次专注已结束，开始 ${restMinutes} 分钟休息时段。`
    );

    refreshStats();
    void startRest(cycleId, taskId);
  };

  const completeFocusAndStartRest = async () => {
    if (isCompletingRef.current) return;
    const cur = sessionRef.current;
    isCompletingRef.current = true;

    const cycleId = cur?.cycleId || createFocusCycleId();
    const taskId = cur?.taskId ?? (selectedTarget.type === "task" && selectedTarget.id ? selectedTarget.id : null);

    if (cur) {
      try {
        await focusAssistantApi.update(cur.id, {
          status: "completed",
          activeSeconds: cur.plannedMinutes * 60,
        });
      } catch (e) {
        console.error("Failed to complete focus session", e);
      }
    }

    void sendDesktopNotification(
      "专注完成",
      `🎉 恭喜！已完成「${selectedTarget.name || "专注"}」时段，开始 ${restMinutes} 分钟休息放松一下吧！`
    );

    refreshStats();
    void startRest(cycleId, taskId);
  };

  const completeRest = async () => {
    if (isCompletingRef.current) return;
    const cur = sessionRef.current;
    isCompletingRef.current = true;

    if (cur) {
      try {
        await focusAssistantApi.update(cur.id, {
          status: "completed",
          activeSeconds: restMinutes * 60,
          restCompleted: true,
        });
      } catch (e) {
        console.error("Failed to complete rest session", e);
      }
    }

    void sendDesktopNotification(
      "休息结束",
      `☕ ${restMinutes} 分钟休息时段已结束，准备好开始新的专注了吗？`
    );

    setSession(null);
    setSessionType("focus");
    sessionTypeRef.current = "focus";
    setStatus("ready");
    setSecondsLeft(focusMinutes * 60);
    remainingRef.current = focusMinutes * 60;
    startedAt.current = null;
    isCompletingRef.current = false;
    refreshStats();
  };

  const skipRest = async () => {
    isCompletingRef.current = false;
    const cur = sessionRef.current;
    if (cur) {
      const activeSec = Math.max(0, restMinutes * 60 - remainingRef.current);
      try {
        await focusAssistantApi.update(cur.id, {
          status: "interrupted",
          activeSeconds: activeSec,
        });
      } catch (e) {
        console.error("Failed to interrupt rest session", e);
      }
    }

    void sendDesktopNotification(
      "已跳过休息",
      "休息时段已跳过，已恢复专注就绪状态。"
    );

    setSession(null);
    setSessionType("focus");
    sessionTypeRef.current = "focus";
    setStatus("ready");
    setSecondsLeft(focusMinutes * 60);
    remainingRef.current = focusMinutes * 60;
    startedAt.current = null;
    refreshStats();
  };

  // Timer Tick
  useEffect(() => {
    if (status !== "running") return;
    const timer = window.setInterval(() => {
      const next = Math.max(0, remainingRef.current - 1);
      remainingRef.current = next;
      setSecondsLeft(next);
      if (next === 0) {
        if (sessionTypeRef.current === "focus") {
          void completeFocusAndStartRest();
        } else {
          void completeRest();
        }
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  // Cleanup on window close
  useEffect(() => {
    return () => {
      const cur = sessionRef.current;
      if (cur && (cur.status === "running" || cur.status === "paused")) {
        const planned = cur.plannedMinutes || (cur.type === "rest" ? restMinutes : 25);
        const activeSec = Math.max(0, planned * 60 - remainingRef.current);
        void focusAssistantApi.update(cur.id, {
          status: "interrupted",
          activeSeconds: activeSec,
        });
      }
    };
  }, [restMinutes, focusMinutes]);

  const hideWindow = () => {
    void getCurrentWindow().hide().catch(() => undefined);
  };

  const togglePin = async () => {
    const next = !isPinned;
    await getCurrentWindow().setAlwaysOnTop(next).catch(() => undefined);
    setIsPinned(next);
    localStorage.setItem("workbuddy.focusAssistant.pinned", String(next));
  };

  const handleToggleStats = () => {
    const next = !showStats;
    setShowStats(next);
    localStorage.setItem("workbuddy.focusAssistant.showStats", String(next));
  };

  const handleSetTheme = (newTheme: StyleTheme) => {
    setTheme(newTheme);
    localStorage.setItem("workbuddy.focusAssistant.theme", newTheme);
    setActiveModal("none");
  };

  // Time format
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // Progress Calculation
  const totalSeconds = (sessionType === "rest" ? restMinutes : focusMinutes) * 60;
  const progressRatio = totalSeconds > 0 ? (totalSeconds - secondsLeft) / totalSeconds : 0;
  const strokeDashoffset = 113.1 * (1 - progressRatio); // 2 * PI * 18 ≈ 113.1


  // Filtered Task & Habit list
  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return tasks;
    const q = searchQuery.toLowerCase();
    return tasks.filter((t) => t.title.toLowerCase().includes(q));
  }, [tasks, searchQuery]);

  const filteredHabits = useMemo(() => {
    if (!searchQuery.trim()) return habits;
    const q = searchQuery.toLowerCase();
    return habits.filter((h) => h.name.toLowerCase().includes(q));
  }, [habits, searchQuery]);

  // Window Background and Card Themes (No borders or heavy shadows to prevent dark shadow artifacts on transparent windows)
  const getThemeClasses = () => {
    switch (theme) {
      case "dark":
        return "bg-slate-900 text-slate-100 shadow-none";
      case "glass":
        return "bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-slate-800 dark:text-slate-100 shadow-none";
      case "minimal":
        return "bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 shadow-none";
      case "light":
      default:
        return "bg-white text-slate-800 shadow-none";
    }
  };

  // ============================================================================
  // Modal: Task / Habit Selector (Image 3)
  // ============================================================================
  if (activeModal === "task-selector") {
    return (
      <div
        className={cn(
          "w-[200px] h-[280px] p-2.5 flex flex-col rounded-2xl select-none overflow-hidden text-xs border-0 outline-none",
          getThemeClasses()
        )}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) void getCurrentWindow().startDragging();
        }}
      >
        {/* Header Segmented Pill Tabs */}
        <div className="flex items-center justify-between pb-1.5 shrink-0">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-full mx-auto">
            <button
              onClick={() => setSelectorTab("task")}
              className={cn(
                "px-3 py-0.5 rounded-full text-xs transition-colors font-medium cursor-pointer",
                selectorTab === "task"
                  ? "bg-blue-50 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400 font-semibold shadow-xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
              )}
            >
              任务
            </button>
            <button
              onClick={() => setSelectorTab("habit")}
              className={cn(
                "px-3 py-0.5 rounded-full text-xs transition-colors font-medium cursor-pointer",
                selectorTab === "habit"
                  ? "bg-blue-50 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400 font-semibold shadow-xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
              )}
            >
              习惯
            </button>
          </div>
          <button
            onClick={() => {
              setActiveModal("none");
              setSearchQuery("");
            }}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer ml-1"
          >
            <X size={13} />
          </button>
        </div>

        {/* Search Input */}
        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100/90 dark:bg-slate-800/80 rounded-lg mb-2 shrink-0">
          <Search size={12} className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索"
            className="bg-transparent text-xs outline-none w-full text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
          />
        </div>

        {/* Section Tag */}
        <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 px-1 pb-1 shrink-0">
          <span>{selectorTab === "task" ? "📅 今日待办" : "📅 今日习惯"}</span>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-0.5 pr-0.5">
          {/* Option: No association (pure focus) */}
          <div
            onClick={() => {
              const target: SelectedTarget = { type: "none", id: "", name: "专注" };
              setSelectedTarget(target);
              localStorage.setItem("workbuddy.focusAssistant.target", JSON.stringify(target));
              setActiveModal("none");
              setSearchQuery("");
            }}
            className={cn(
              "flex items-center gap-2 px-1.5 py-1.5 rounded-md cursor-pointer transition-colors text-xs hover:bg-slate-100 dark:hover:bg-slate-800",
              selectedTarget.type === "none" && "bg-blue-50/60 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-medium"
            )}
          >
            <div
              className={cn(
                "size-3 rounded-full border flex items-center justify-center shrink-0",
                selectedTarget.type === "none" ? "border-blue-500 bg-blue-500 text-white" : "border-slate-300 dark:border-slate-600"
              )}
            >
              {selectedTarget.type === "none" && <div className="size-1 bg-white rounded-full" />}
            </div>
            <span className="truncate">纯专注 (无关联)</span>
          </div>

          {/* Tab 1: Tasks */}
          {selectorTab === "task" && (
            <>
              {filteredTasks.length === 0 ? (
                <div className="text-center py-4 text-slate-400 text-[11px]">暂无待办任务</div>
              ) : (
                filteredTasks.map((t) => {
                  const isSelected = selectedTarget.type === "task" && selectedTarget.id === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        const target: SelectedTarget = { type: "task", id: t.id, name: t.title };
                        setSelectedTarget(target);
                        localStorage.setItem("workbuddy.focusAssistant.target", JSON.stringify(target));
                        setActiveModal("none");
                        setSearchQuery("");
                      }}
                      className={cn(
                        "flex items-center gap-2 px-1.5 py-1.5 rounded-md cursor-pointer transition-colors text-xs hover:bg-slate-100 dark:hover:bg-slate-800",
                        isSelected && "bg-blue-50/60 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-medium"
                      )}
                    >
                      <div
                        className={cn(
                          "size-3 rounded-full border flex items-center justify-center shrink-0",
                          isSelected ? "border-blue-500 bg-blue-500 text-white" : "border-slate-300 dark:border-slate-600"
                        )}
                      >
                        {isSelected && <div className="size-1 bg-white rounded-full" />}
                      </div>
                      <span className="truncate flex-1">{t.title}</span>
                    </div>
                  );
                })
              )}
            </>
          )}

          {/* Tab 2: Habits */}
          {selectorTab === "habit" && (
            <>
              {filteredHabits.length === 0 ? (
                <div className="text-center py-4 text-slate-400 text-[11px]">暂无习惯</div>
              ) : (
                filteredHabits.map((h) => {
                  const isSelected = selectedTarget.type === "habit" && selectedTarget.id === h.id;
                  return (
                    <div
                      key={h.id}
                      onClick={() => {
                        const target: SelectedTarget = { type: "habit", id: h.id, name: h.name };
                        setSelectedTarget(target);
                        localStorage.setItem("workbuddy.focusAssistant.target", JSON.stringify(target));
                        setActiveModal("none");
                        setSearchQuery("");
                      }}
                      className={cn(
                        "flex items-center gap-2 px-1.5 py-1.5 rounded-md cursor-pointer transition-colors text-xs hover:bg-slate-100 dark:hover:bg-slate-800",
                        isSelected && "bg-blue-50/60 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-medium"
                      )}
                    >
                      <div
                        className={cn(
                          "size-3 rounded-full border flex items-center justify-center shrink-0",
                          isSelected ? "border-blue-500 bg-blue-500 text-white" : "border-slate-300 dark:border-slate-600"
                        )}
                      >
                        {isSelected && <div className="size-1 bg-white rounded-full" />}
                      </div>
                      <span className="truncate flex-1">{h.name}</span>
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // Modal: Time Editor
  // ============================================================================
  if (activeModal === "time-editor") {
    const handleSaveTime = () => {
      const fNum = clamp(Number(editFocusInput) || 25, 1, 180);
      const rNum = clamp(Number(editRestInput) || 5, 1, 60);
      setFocusMinutes(fNum);
      setRestMinutes(rNum);
      localStorage.setItem("workbuddy.focusAssistant.minutes", String(fNum));
      localStorage.setItem("workbuddy.focusAssistant.restMinutes", String(rNum));
      if (status === "ready") {
        if (sessionType === "focus") {
          setSecondsLeft(fNum * 60);
          remainingRef.current = fNum * 60;
        } else {
          setSecondsLeft(rNum * 60);
          remainingRef.current = rNum * 60;
        }
      }
      setActiveModal("none");
    };

    return (
      <div
        className={cn(
          "w-[200px] h-[180px] p-2.5 flex flex-col justify-between rounded-2xl select-none text-xs border-0 outline-none",
          getThemeClasses()
        )}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) void getCurrentWindow().startDragging();
        }}
      >
        <div>
          <div className="flex items-center justify-between pb-1 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-100 dark:border-slate-800">
            <span>时间设置</span>
            <button
              onClick={() => setActiveModal("none")}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5 rounded"
            >
              <X size={13} />
            </button>
          </div>

          <div className="space-y-2 py-2">
            {/* Focus time row */}
            <div className="flex items-center justify-between px-0.5">
              <span className="text-slate-600 dark:text-slate-300 font-medium">专注时间</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={180}
                  autoFocus
                  value={editFocusInput}
                  onChange={(e) => setEditFocusInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveTime();
                    if (e.key === "Escape") setActiveModal("none");
                  }}
                  className="w-13 px-1.5 py-0.5 border border-blue-500 rounded-md text-xs font-bold text-center text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 outline-none"
                />
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">分钟</span>
              </div>
            </div>

            {/* Rest time row */}
            <div className="flex items-center justify-between px-0.5">
              <span className="text-slate-600 dark:text-slate-300 font-medium">休息时间</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={editRestInput}
                  onChange={(e) => setEditRestInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveTime();
                    if (e.key === "Escape") setActiveModal("none");
                  }}
                  className="w-13 px-1.5 py-0.5 border border-emerald-500 rounded-md text-xs font-bold text-center text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 outline-none"
                />
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">分钟</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleSaveTime}
            className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            确定
          </button>
          <button
            onClick={() => setActiveModal("none")}
            className="flex-1 py-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            取消
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // Modal: More Menu / Style Menu
  // ============================================================================
  if (activeModal === "menu" || activeModal === "style-menu") {
    return (
      <div
        className={cn(
          "w-[200px] h-[210px] p-2.5 flex flex-col justify-between rounded-2xl select-none text-xs border-0 outline-none",
          getThemeClasses()
        )}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) void getCurrentWindow().startDragging();
        }}
      >
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {activeModal === "style-menu" ? "选择样式主题" : "选项设置"}
          </span>
          <button
            onClick={() => setActiveModal("none")}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5 rounded"
          >
            <X size={13} />
          </button>
        </div>

        {activeModal === "menu" ? (
          <div className="flex-1 py-1 space-y-1 overflow-y-auto no-scrollbar">
            {/* Toggle Pin */}
            <button
              onClick={() => {
                void togglePin();
                setActiveModal("none");
              }}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left"
            >
              <span>{isPinned ? "取消置顶" : "窗口置顶"}</span>
              {isPinned && <Check size={13} className="text-blue-500" />}
            </button>

            {/* Change Style */}
            <button
              onClick={() => setActiveModal("style-menu")}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left"
            >
              <span>修改样式</span>
              <ChevronRight size={13} className="text-slate-400" />
            </button>

            {/* Toggle Stats */}
            <button
              onClick={() => {
                handleToggleStats();
                setActiveModal("none");
              }}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left"
            >
              <span>{showStats ? "收起统计" : "展开统计"}</span>
              {showStats && <Check size={13} className="text-blue-500" />}
            </button>

            {/* Stop current focus if running/paused (Focus mode) */}
            {sessionType === "focus" && status !== "ready" && (
              <button
                onClick={() => {
                  void stopFocusAndStartRest();
                  setActiveModal("none");
                }}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer text-left font-medium"
              >
                <span>结束专注并休息</span>
                <StopCircle size={13} />
              </button>
            )}

            {/* Skip rest if in rest mode */}
            {sessionType === "rest" && (
              <button
                onClick={() => {
                  void skipRest();
                  setActiveModal("none");
                }}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer text-left font-medium"
              >
                <span>跳过休息 / 重新专注</span>
                <StopCircle size={13} />
              </button>
            )}

            {/* Reset Timer */}
            <button
              onClick={() => {
                const resetSec = (sessionType === "rest" ? REST_MINUTES : focusMinutes) * 60;
                setSecondsLeft(resetSec);
                remainingRef.current = resetSec;
                setActiveModal("none");
              }}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left"
            >
              <span>重置倒计时</span>
              <RotateCcw size={12} className="text-slate-400" />
            </button>
          </div>
        ) : (
          <div className="flex-1 py-1 space-y-1 overflow-y-auto no-scrollbar">
            <button
              onClick={() => handleSetTheme("light")}
              className={cn(
                "w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left",
                theme === "light" && "bg-blue-50/80 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 font-medium"
              )}
            >
              <div className="flex items-center gap-2">
                <Sun size={13} className="text-amber-500" />
                <span>经典浅色</span>
              </div>
              {theme === "light" && <Check size={13} className="text-blue-500" />}
            </button>

            <button
              onClick={() => handleSetTheme("dark")}
              className={cn(
                "w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left",
                theme === "dark" && "bg-blue-50/80 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 font-medium"
              )}
            >
              <div className="flex items-center gap-2">
                <Moon size={13} className="text-indigo-400" />
                <span>暗黑夜色</span>
              </div>
              {theme === "dark" && <Check size={13} className="text-blue-500" />}
            </button>

            <button
              onClick={() => handleSetTheme("glass")}
              className={cn(
                "w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left",
                theme === "glass" && "bg-blue-50/80 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 font-medium"
              )}
            >
              <div className="flex items-center gap-2">
                <Sparkles size={13} className="text-cyan-500" />
                <span>毛玻璃透明</span>
              </div>
              {theme === "glass" && <Check size={13} className="text-blue-500" />}
            </button>

            <button
              onClick={() => handleSetTheme("minimal")}
              className={cn(
                "w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left",
                theme === "minimal" && "bg-blue-50/80 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 font-medium"
              )}
            >
              <div className="flex items-center gap-2">
                <Layers size={13} className="text-emerald-500" />
                <span>极简纯色</span>
              </div>
              {theme === "minimal" && <Check size={13} className="text-blue-500" />}
            </button>
          </div>
        )}

        <div className="pt-1 text-center">
          <button
            onClick={() => setActiveModal("none")}
            className="w-full py-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-xs font-medium cursor-pointer"
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // Main Floating Card View (200 x 75px, or 200 x 140px when stats open)
  // ============================================================================
  return (
    <div
      className={cn(
        "w-[200px] rounded-2xl select-none transition-all flex flex-col justify-between overflow-hidden border-0 outline-none",
        showStats ? "h-[140px] p-2.5" : "h-[75px] px-3 py-2",
        getThemeClasses()
      )}
      onMouseDown={(e) => {
        // Drag window on non-interactive click
        if (
          e.target === e.currentTarget ||
          (e.target as HTMLElement).getAttribute("data-drag") === "true"
        ) {
          void getCurrentWindow().startDragging();
        }
      }}
      data-drag="true"
    >
      {/* Top 75px Main Floating Area */}
      <div className="flex items-center justify-between w-full h-[58px]" data-drag="true">
        {/* Left Circular Play/Pause button with circular progress */}
        <div className="relative size-11 flex items-center justify-center shrink-0">
          <svg className="size-11 -rotate-90" viewBox="0 0 44 44">
            {/* Background ring */}
            <circle
              cx="22"
              cy="22"
              r="18"
              fill="none"
              className="stroke-slate-200/90 dark:stroke-slate-700/80"
              strokeWidth="3"
            />
            {/* Active progress ring */}
            {status !== "ready" && (
              <circle
                cx="22"
                cy="22"
                r="18"
                fill="none"
                className={cn(
                  "transition-all duration-300",
                  sessionType === "rest" ? "stroke-emerald-500" : "stroke-blue-500"
                )}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="113.1"
                strokeDashoffset={strokeDashoffset}
              />
            )}
          </svg>

          {/* Center Action Button */}
          {status === "paused" ? (
            <div className="absolute inset-0 m-auto w-[33px] h-[26px] rounded-full bg-slate-50 dark:bg-slate-800/95 flex items-center justify-center">
              {/* Resume Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void resume();
                }}
                className={cn(
                  "flex-1 h-full flex items-center justify-center cursor-pointer hover:scale-110 active:scale-95 transition-transform",
                  sessionType === "rest"
                    ? "text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                    : "text-blue-600 hover:text-blue-700 dark:text-blue-400"
                )}
                title={sessionType === "rest" ? "继续休息" : "继续专注"}
              >
                <Play
                  size={10}
                  className={cn(
                    "ml-0.5",
                    sessionType === "rest"
                      ? "fill-emerald-600 dark:fill-emerald-400"
                      : "fill-blue-600 dark:fill-blue-400"
                  )}
                />
              </button>

              {/* Vertical Divider */}
              <div className="w-[1px] h-3 bg-slate-200/90 dark:bg-slate-700 shrink-0" />

              {/* Stop / Finish Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (sessionType === "rest") {
                    void skipRest();
                  } else {
                    void stopFocusAndStartRest();
                  }
                }}
                className="flex-1 h-full flex items-center justify-center text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer hover:scale-110 active:scale-95 transition-transform"
                title={sessionType === "rest" ? "跳过休息" : "结束专注并开始休息"}
              >
                <div className="size-2.5 rounded-[1.5px] bg-slate-600 dark:bg-slate-300 hover:bg-slate-800 dark:hover:bg-slate-100" />
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (status === "ready") {
                  void startFocus();
                } else if (status === "running") {
                  void pause();
                }
              }}
              className="absolute inset-0 m-auto size-8 rounded-full bg-slate-50 dark:bg-slate-800/90 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-pointer"
              title={
                status === "running"
                  ? sessionType === "rest"
                    ? "暂停休息"
                    : "暂停专注"
                  : "开始专注"
              }
            >
              {status === "running" ? (
                <Pause
                  size={14}
                  className={cn(
                    sessionType === "rest"
                      ? "text-emerald-600 dark:text-emerald-400 fill-emerald-600 dark:fill-emerald-400"
                      : "text-blue-600 dark:text-blue-400 fill-blue-600 dark:fill-blue-400"
                  )}
                />
              ) : (
                <Play size={14} className="text-blue-600 dark:text-blue-400 fill-blue-600 dark:fill-blue-400 ml-0.5" />
              )}
            </button>
          )}
        </div>

        {/* Center: Title & Timer */}
        <div className="flex flex-col justify-center ml-2.5 flex-1 min-w-0" data-drag="true">
          {/* Target Title (Clickable in focus mode, status indicator in rest mode) */}
          {sessionType === "rest" ? (
            <div
              className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-semibold select-none max-w-[85px] truncate"
              title="休息时段"
            >
              <Coffee size={12} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="truncate">休息时段</span>
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSearchQuery("");
                setActiveModal("task-selector");
              }}
              className="flex items-center gap-0.5 text-xs text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 font-medium cursor-pointer select-none max-w-[85px] truncate text-left"
              title="点击选择关联任务/习惯"
            >
              <span className="truncate">{selectedTarget.name || "专注"}</span>
              <ChevronRight size={11} className="shrink-0 text-slate-400" />
            </button>
          )}

          {/* Digital Timer */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditFocusInput(String(focusMinutes));
              setEditRestInput(String(restMinutes));
              setActiveModal("time-editor");
            }}
            className={cn(
              "text-[22px] font-bold tracking-tight leading-none cursor-pointer select-none text-left mt-0.5",
              sessionType === "rest"
                ? "text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
                : "text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400"
            )}
            title="点击修改时间设置"
          >
            {formatTime(secondsLeft)}
          </button>
        </div>

        {/* Right: Actions (Toggle Stats, Menu, Close) */}
        <div className="flex items-center gap-0.5 self-start -mt-0.5 -mr-1 text-slate-400 dark:text-slate-500">
          {/* Toggle Stats */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggleStats();
            }}
            className={cn(
              "p-0.5 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer rounded",
              showStats && "text-blue-500 dark:text-blue-400"
            )}
            title={showStats ? "收起统计" : "展开今日/本周统计"}
          >
            <RotateCcw size={12} className={cn("transition-transform", showStats && "rotate-180")} />
          </button>

          {/* More Menu */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveModal("menu");
            }}
            className="p-0.5 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer rounded"
            title="更多选项"
          >
            <MoreHorizontal size={13} />
          </button>

          {/* Close / Hide Window */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              hideWindow();
            }}
            className="p-0.5 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer rounded"
            title="关闭悬浮助手"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Bottom Expanded Stats Section (Image 2) */}
      {showStats && (
        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-around text-center shrink-0">
          {/* Column 1: Today Focus */}
          <div className="flex-1 flex flex-col items-center">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">今日专注</span>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">
              {stats.todayMinutes}
              <span className="text-[11px] font-normal text-slate-500 ml-0.5">m</span>
            </span>
          </div>

          <div className="h-6 w-px bg-slate-200/60 dark:bg-slate-800/80" />

          {/* Column 2: This Week Focus */}
          <div className="flex-1 flex flex-col items-center">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">本周专注</span>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">
              {stats.weekMinutes}
              <span className="text-[11px] font-normal text-slate-500 ml-0.5">m</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

