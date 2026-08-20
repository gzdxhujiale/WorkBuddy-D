import { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  X,
  MoreHorizontal,
  ChevronRight,
  ChevronDown,
  Check,
  RotateCcw,
  RotateCw,
  Sparkles,
  Sun,
  Gamepad2,
  Coffee,
  Clock,
  Cat,
  Dog,
  Bot,
  FolderKanban,
  Layers,
  Volume2,
  VolumeX,
} from "lucide-react";
import { getCurrentWindow, LogicalSize, PhysicalPosition } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { useFocusTaskOptions } from "@/hooks/useTimeManagement";
import { useHabitData } from "@/hooks/useHabits";
import { useProjectsData } from "@/hooks/useProjects";
import { focusAssistantApi, FocusStats } from "@/services/focusAssistantService";
import { sendDesktopNotification } from "@/services/notificationService";
import {
  playVictorySound,
  playRestEndSound,
  playPokeSound,
  playTaskReminderSound,
  isSoundEnabled,
  setSoundEnabled,
} from "@/lib/soundFeedback";
import { useAuth } from "@/lib/auth";
import type { FocusSession, FocusSessionType } from "@/types/focusAssistant";
import { cn } from "@/lib/utils";
import { createFocusCycleId } from "@/lib/entityIds";
import { PixelPet, PetState } from "./pets/PixelPet";
import { PixelDog } from "./pets/PixelDog";
import { VectorPet } from "./pets/VectorPet";
import { SpeechBubble } from "./pets/SpeechBubble";
import { getPetDialogue, PetEvent, PetDialogueOptions } from "./pets/petDialogues";

type Status = "ready" | "running" | "paused";
type ActiveModal = "none" | "task-selector" | "time-editor" | "menu" | "style-menu";
export type StyleTheme =
  | "classic"
  | "pixel"
  | "pixel-pure"
  | "pixel-dog"
  | "pixel-dog-pure"
  | "vector"
  | "vector-pure";

export type FocusTargetType =
  | "none"
  | "project"
  | "project-stage"
  | "project-task"
  | "task"
  | "habit";

export interface SelectedTarget {
  type: FocusTargetType;
  id: string;
  name: string;
  projectId?: string;
  projectName?: string;
  stageId?: string;
  stageName?: string;
}

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
  const { data: tasks = [], refetch: refetchTasks, isFetching: isFetchingTasks } = useFocusTaskOptions();
  const { data: habitData, refetch: refetchHabits, isFetching: isFetchingHabits } = useHabitData();
  const habits = habitData?.habits ?? [];
  const { data: projectData, refetch: refetchProjects, isFetching: isFetchingProjects } = useProjectsData();
  const projects = projectData?.projects ?? [];
  const stages = projectData?.stages ?? [];
  const projectTasks = projectData?.tasks ?? [];

  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const handleRefreshData = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsManualRefreshing(true);
    try {
      await Promise.all([
        refetchTasks(),
        refetchHabits(),
        refetchProjects(),
      ]);
    } catch {
      // Ignore
    } finally {
      setIsManualRefreshing(false);
    }
  };

  const isDataRefreshing =
    isManualRefreshing || isFetchingTasks || isFetchingHabits || isFetchingProjects;

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
    const saved = localStorage.getItem("workbuddy.focusAssistant.theme") as StyleTheme;
    if (
      saved === "pixel" ||
      saved === "pixel-pure" ||
      saved === "pixel-dog" ||
      saved === "pixel-dog-pure" ||
      saved === "vector" ||
      saved === "vector-pure" ||
      saved === "classic"
    ) {
      return saved;
    }
    return "classic";
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
  const [bubbleText, setBubbleText] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragDirection, setDragDirection] = useState<"left" | "right">("right");
  const [petOverrideState, setPetOverrideState] = useState<PetState | null>(null);
  const [isGlowActive, setIsGlowActive] = useState<boolean>(false);
  const [soundOn, setSoundOn] = useState<boolean>(isSoundEnabled);

  // Modal Temp States
  const [editFocusInput, setEditFocusInput] = useState<string>(String(focusMinutes));
  const [editRestInput, setEditRestInput] = useState<string>(String(restMinutes));
  const [selectorTab, setSelectorTab] = useState<"project" | "task" | "habit">("project");
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({});

  const startedAt = useRef<number | null>(null);
  const remainingRef = useRef(secondsLeft);
  const sessionRef = useRef<FocusSession | null>(null);
  const sessionTypeRef = useRef<FocusSessionType>(sessionType);
  const isCompletingRef = useRef(false);
  const bubbleTimerRef = useRef<number | null>(null);

  const isPurePet = theme === "pixel-pure" || theme === "pixel-dog-pure" || theme === "vector-pure";
  const currentSpecies: "cat" | "dog" =
    theme.includes("dog") || theme.includes("vector") ? "dog" : "cat";
  const currentPetType: "cat" | "dog" | "shiba" = useMemo(() => {
    if (theme === "pixel-dog" || theme === "pixel-dog-pure") return "dog";
    if (theme === "vector" || theme === "vector-pure") return "shiba";
    return "cat";
  }, [theme]);
  const currentThemeStyle: "modern" | "pixel" = useMemo(() => {
    return theme.startsWith("pixel") ? "pixel" : "modern";
  }, [theme]);
  const notificationTitle = currentSpecies === "dog" ? "🐶 专注伴侣" : "🐱 专注伴侣";

  const getDialogue = (event: PetEvent, opts?: Partial<PetDialogueOptions>) => {
    return getPetDialogue(event, {
      species: currentSpecies,
      targetName: selectedTarget.name,
      focusMinutes,
      restMinutes,
      ...opts,
    });
  };

  const dragSessionRef = useRef<{
    isDown: boolean;
    hasMoved: boolean;
    startScreenX: number;
    startScreenY: number;
    startWindowX: number;
    startWindowY: number;
    scaleFactor: number;
    lastScreenX: number;
    rafId: number | null;
    pendingX: number | null;
    pendingY: number | null;
  }>({
    isDown: false,
    hasMoved: false,
    startScreenX: 0,
    startScreenY: 0,
    startWindowX: 0,
    startWindowY: 0,
    scaleFactor: 1,
    lastScreenX: 0,
    rafId: null,
    pendingX: null,
    pendingY: null,
  });

  const handleDragPointerDown = async (e: React.PointerEvent) => {
    // Only primary left click triggers window dragging
    if (e.button !== 0) return;

    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("input") ||
      target.closest("textarea") ||
      target.closest("[role='menu']") ||
      target.closest("[data-no-drag='true']")
    ) {
      return;
    }

    try {
      const win = getCurrentWindow();
      const [pos, scale] = await Promise.all([
        win.outerPosition(),
        win.scaleFactor().catch(() => 1),
      ]);

      dragSessionRef.current = {
        isDown: true,
        hasMoved: false,
        startScreenX: e.screenX,
        startScreenY: e.screenY,
        startWindowX: pos.x,
        startWindowY: pos.y,
        scaleFactor: scale || 1,
        lastScreenX: e.screenX,
        rafId: null,
        pendingX: null,
        pendingY: null,
      };

      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Fallback
    }
  };

  const handleDragPointerMove = (e: React.PointerEvent) => {
    const session = dragSessionRef.current;
    if (!session.isDown) return;

    const totalDx = e.screenX - session.startScreenX;
    const totalDy = e.screenY - session.startScreenY;
    const instantaneousDx = e.screenX - session.lastScreenX;

    // Deadzone threshold (6px) prevents accidental drags during clicks/poking
    if (!session.hasMoved && Math.hypot(totalDx, totalDy) < 6) {
      session.lastScreenX = e.screenX;
      return;
    }

    session.hasMoved = true;
    setIsDragging(true);

    if (Math.abs(instantaneousDx) > 0.5) {
      setDragDirection(instantaneousDx > 0 ? "right" : "left");
    }

    session.lastScreenX = e.screenX;

    const newPhysX = Math.round(session.startWindowX + totalDx * session.scaleFactor);
    const newPhysY = Math.round(session.startWindowY + totalDy * session.scaleFactor);

    session.pendingX = newPhysX;
    session.pendingY = newPhysY;

    // requestAnimationFrame throttling to match display refresh rate without IPC flooding
    if (session.rafId === null) {
      session.rafId = requestAnimationFrame(() => {
        session.rafId = null;
        if (!session.isDown || session.pendingX === null || session.pendingY === null) return;
        void getCurrentWindow()
          .setPosition(new PhysicalPosition(session.pendingX, session.pendingY))
          .catch(() => {});
      });
    }
  };

  const handleDragPointerUp = (e?: React.PointerEvent) => {
    const session = dragSessionRef.current;
    if (session.isDown) {
      session.isDown = false;
      if (session.rafId !== null) {
        cancelAnimationFrame(session.rafId);
        session.rafId = null;
      }
      if (session.pendingX !== null && session.pendingY !== null) {
        void getCurrentWindow()
          .setPosition(new PhysicalPosition(session.pendingX, session.pendingY))
          .catch(() => {});
        session.pendingX = null;
        session.pendingY = null;
      }
      setIsDragging(false);
      if (e) {
        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
          // Ignore
        }
      }
    }
  };

  // Global blur and pointerup safety to prevent stuck dragging state on Alt+Tab or mouse exit
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (dragSessionRef.current.isDown) {
        handleDragPointerUp();
      }
    };
    const handleBlur = () => {
      if (dragSessionRef.current.isDown) {
        handleDragPointerUp();
      }
    };

    window.addEventListener("pointerup", handleGlobalPointerUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("pointerup", handleGlobalPointerUp);
      window.removeEventListener("blur", handleBlur);
      if (dragSessionRef.current.rafId !== null) {
        cancelAnimationFrame(dragSessionRef.current.rafId);
      }
    };
  }, []);

  const speak = (text: string, durationMs = 4000) => {
    if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    setBubbleText(text);
    bubbleTimerRef.current = window.setTimeout(() => {
      setBubbleText(null);
      bubbleTimerRef.current = null;
    }, durationMs);
  };

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
      setWindowGeometry(210, 260);
    } else if (activeModal === "time-editor") {
      setWindowGeometry(210, 190);
    } else if (activeModal === "menu" || activeModal === "style-menu") {
      setWindowGeometry(210, 260);
    } else if (isPurePet) {
      setWindowGeometry(220, 180);
    } else if (showStats) {
      setWindowGeometry(205, 145);
    } else {
      setWindowGeometry(205, 80);
    }
  }, [activeModal, showStats, isPurePet, theme]);

  // Setup scale change & pin listener
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const setupListener = async () => {
      try {
        const win = getCurrentWindow();
        await win.setAlwaysOnTop(isPinned);
        unlisten = await win.onScaleChanged(async () => {
          if (activeModal === "task-selector") {
            await win.setSize(new LogicalSize(210, 260)).catch(() => undefined);
          } else if (activeModal === "time-editor") {
            await win.setSize(new LogicalSize(210, 190)).catch(() => undefined);
          } else if (activeModal === "menu" || activeModal === "style-menu") {
            await win.setSize(new LogicalSize(210, 260)).catch(() => undefined);
          } else if (isPurePet) {
            await win.setSize(new LogicalSize(220, 180)).catch(() => undefined);
          } else if (showStats) {
            await win.setSize(new LogicalSize(205, 145)).catch(() => undefined);
          } else {
            await win.setSize(new LogicalSize(205, 80)).catch(() => undefined);
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
  }, [isPinned, activeModal, showStats, isPurePet]);

  // Listen for global task reminders & focus selection events
  useEffect(() => {
    let unlistenReminder: (() => void) | undefined;
    let unlistenSelectTask: (() => void) | undefined;
    let glowTimer: number | null = null;
    let knockTimer: number | null = null;

    const setupListeners = async () => {
      try {
        unlistenReminder = await listen<{
          taskId: string;
          title: string;
          body?: string;
          dateText?: string;
        }>("workbuddy:task-reminder", (event) => {
          const { title } = event.payload;

          // 1. Trigger attention-grabbing glow
          setIsGlowActive(true);
          if (glowTimer) window.clearTimeout(glowTimer);
          glowTimer = window.setTimeout(() => {
            setIsGlowActive(false);
            glowTimer = null;
          }, 8000);

          // 2. Animate pet in knocking / attention state
          setPetOverrideState("knocking");
          if (knockTimer) window.clearTimeout(knockTimer);
          knockTimer = window.setTimeout(() => {
            setPetOverrideState(null);
            knockTimer = null;
          }, 6000);

          // 3. Pet speaks customized reminder dialogue
          const dialogueText = getDialogue("task_reminder", { targetName: title });
          speak(dialogueText, 7000);

          // 4. Audio chime
          void playTaskReminderSound(currentThemeStyle === "pixel");
        });

        unlistenSelectTask = await listen<{
          taskId: string;
          taskTitle: string;
        }>("workbuddy:select-focus-task", (event) => {
          const { taskId, taskTitle } = event.payload;
          const target: SelectedTarget = {
            type: "task",
            id: taskId,
            name: taskTitle || "专注任务",
          };
          setSelectedTarget(target);
          localStorage.setItem("workbuddy.focusAssistant.target", JSON.stringify(target));
          const text = getDialogue("focus_start", { targetName: target.name });
          speak(text, 4000);
        });
      } catch {
        // Browser fallback
      }
    };

    void setupListeners();

    return () => {
      if (unlistenReminder) unlistenReminder();
      if (unlistenSelectTask) unlistenSelectTask();
      if (glowTimer) window.clearTimeout(glowTimer);
      if (knockTimer) window.clearTimeout(knockTimer);
    };
  }, [currentSpecies, currentThemeStyle]);

  // Pet state
  const petState: PetState = useMemo(() => {
    if (petOverrideState) return petOverrideState;
    if (sessionType === "rest") {
      return status === "running" ? "resting" : "paused";
    }
    if (status === "running") return "working";
    if (status === "paused") return "paused";
    return "ready";
  }, [petOverrideState, sessionType, status]);

  const handlePokePet = () => {
    playPokeSound(currentThemeStyle === "pixel");
    const text = getDialogue("poke");
    speak(text);
  };

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

    const text = getDialogue("focus_start");
    speak(text);
    void sendDesktopNotification(notificationTitle, text, {
      petType: currentPetType,
      themeStyle: currentThemeStyle,
      eventType: "general",
    });

    try {
      const taskId =
        (selectedTarget.type === "task" || selectedTarget.type === "project-task") &&
        selectedTarget.id
          ? selectedTarget.id
          : null;
      const created = await focusAssistantApi.create({
        cycleId: createFocusCycleId(),
        taskId,
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

    const text = getDialogue("focus_pause");
    speak(text);

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

    const text = getDialogue("focus_resume");
    speak(text);

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

    // Audio & Action Celebrations
    playVictorySound(currentThemeStyle === "pixel");
    setPetOverrideState("celebrating");
    setIsGlowActive(true);
    setTimeout(() => {
      setPetOverrideState(null);
      setIsGlowActive(false);
    }, 4500);

    const text = getDialogue("focus_stop", { restMinutes });
    speak(text);
    void sendDesktopNotification(notificationTitle, text, {
      petType: currentPetType,
      themeStyle: currentThemeStyle,
      eventType: "focus_complete",
    });

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

    // Audio & Action Celebrations
    playVictorySound(currentThemeStyle === "pixel");
    setPetOverrideState("celebrating");
    setIsGlowActive(true);
    setTimeout(() => {
      setPetOverrideState(null);
      setIsGlowActive(false);
    }, 4500);

    const text = getDialogue("focus_complete", { restMinutes });
    speak(text);
    void sendDesktopNotification(notificationTitle, text, {
      petType: currentPetType,
      themeStyle: currentThemeStyle,
      eventType: "focus_complete",
    });

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

    // Audio & Action: Stretch (1.5s) -> Knocking table (2.5s)
    void playRestEndSound(currentThemeStyle === "pixel");
    setPetOverrideState("stretching");
    setTimeout(() => {
      setPetOverrideState("knocking");
    }, 1500);
    setTimeout(() => {
      setPetOverrideState(null);
    }, 4000);

    const text = getDialogue("rest_complete");
    speak(text);
    void sendDesktopNotification(notificationTitle, text, {
      petType: currentPetType,
      themeStyle: currentThemeStyle,
      eventType: "rest_complete",
    });

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

    void playRestEndSound(currentThemeStyle === "pixel");
    const text = getDialogue("rest_skip");
    speak(text);
    void sendDesktopNotification(notificationTitle, text, {
      petType: currentPetType,
      themeStyle: currentThemeStyle,
      eventType: "general",
    });

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

  const handleTogglePin = async () => {
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

  // Filtered Standalone Tasks (excluding project tasks) & Habits
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => !t.projectId);
  }, [tasks]);

  const filteredHabits = habits;

  const projectsTree = useMemo(() => {
    return projects.map((p) => {
      const pStages = stages
        .filter((s) => s.projectId === p.id)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const pTasks = projectTasks.filter((t) => t.projectId === p.id && !t.completed);
      return {
        project: p,
        stages: pStages,
        tasks: pTasks,
      };
    });
  }, [projects, stages, projectTasks]);

  const toggleProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedProjects((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleStage = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedStages((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getTargetLabel = () => {
    if (selectedTarget.type === "project") return `📁 ${selectedTarget.name}`;
    if (selectedTarget.type === "project-stage") return `📑 ${selectedTarget.name}`;
    if (selectedTarget.type === "project-task") return `📋 ${selectedTarget.name}`;
    if (selectedTarget.type === "task") return `📋 ${selectedTarget.name}`;
    if (selectedTarget.type === "habit") return `✨ ${selectedTarget.name}`;
    return selectedTarget.name || "专注";
  };

  // Window Background and Card Themes for Modals / Cards
  const getThemeClasses = () => {
    switch (theme) {
      case "pixel":
      case "pixel-pure":
        return "bg-amber-50 text-amber-950 border-2 border-amber-900 shadow-[2px_2px_0px_rgba(120,53,15,1)]";
      case "vector":
      case "vector-pure":
        return "bg-gradient-to-br from-orange-50/95 via-white/95 to-amber-50/95 text-slate-800 border border-orange-200/80 shadow-none";
      case "classic":
      default:
        return "bg-white text-slate-800 shadow-none";
    }
  };

  // ============================================================================
  // Modal: Task / Habit / Project Tree Selector
  // ============================================================================
  if (activeModal === "task-selector") {
    return (
      <div
        className={cn(
          "w-[210px] h-[260px] p-2 flex flex-col rounded-2xl select-none overflow-hidden text-xs border-0 outline-none",
          getThemeClasses()
        )}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) void getCurrentWindow().startDragging();
        }}
      >
        {/* Header Segmented Pill Tabs */}
        <div className="flex items-center justify-between pb-1.5 shrink-0">
          <div
            className={cn(
              "flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-full mx-auto text-[11px]",
              theme.startsWith("pixel") && "bg-amber-100/90 border border-amber-900/40 rounded-xs font-mono"
            )}
          >
            <button
              onClick={() => setSelectorTab("project")}
              className={cn(
                "px-2.5 py-0.5 rounded-full transition-colors font-medium cursor-pointer",
                selectorTab === "project"
                  ? theme.startsWith("pixel")
                    ? "bg-amber-900 text-amber-50 font-bold rounded-xs shadow-xs"
                    : "bg-blue-50 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400 font-semibold shadow-xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
              )}
            >
              项目
            </button>
            <button
              onClick={() => setSelectorTab("task")}
              className={cn(
                "px-2.5 py-0.5 rounded-full transition-colors font-medium cursor-pointer",
                selectorTab === "task"
                  ? theme.startsWith("pixel")
                    ? "bg-amber-900 text-amber-50 font-bold rounded-xs shadow-xs"
                    : "bg-blue-50 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400 font-semibold shadow-xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
              )}
            >
              任务
            </button>
            <button
              onClick={() => setSelectorTab("habit")}
              className={cn(
                "px-2.5 py-0.5 rounded-full transition-colors font-medium cursor-pointer",
                selectorTab === "habit"
                  ? theme.startsWith("pixel")
                    ? "bg-amber-900 text-amber-50 font-bold rounded-xs shadow-xs"
                    : "bg-blue-50 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400 font-semibold shadow-xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
              )}
            >
              习惯
            </button>
          </div>
          <div className="flex items-center gap-0.5 ml-1">
            <button
              onClick={handleRefreshData}
              disabled={isDataRefreshing}
              className={cn(
                "text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 p-0.5 rounded cursor-pointer transition-colors",
                theme.startsWith("pixel") && "hover:text-amber-900",
                isDataRefreshing && "opacity-70 cursor-not-allowed"
              )}
              title="刷新同步项目任务与习惯"
            >
              <RotateCw
                size={12}
                className={cn(
                  "transition-transform",
                  isDataRefreshing && "animate-spin text-blue-500"
                )}
              />
            </button>
            <button
              onClick={() => setActiveModal("none")}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
              title="关闭"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-0.5 pr-0.5 pt-0.5">
          {/* Universal Option: No association (pure focus) */}
          <div
            onClick={() => {
              const target: SelectedTarget = { type: "none", id: "", name: "专注" };
              setSelectedTarget(target);
              localStorage.setItem("workbuddy.focusAssistant.target", JSON.stringify(target));
              setActiveModal("none");
            }}
            className={cn(
              "flex items-center gap-2 px-1.5 py-1.5 rounded-md cursor-pointer transition-colors text-xs hover:bg-slate-100 dark:hover:bg-slate-800",
              theme.startsWith("pixel") && "hover:bg-amber-100/80 rounded-xs",
              selectedTarget.type === "none" &&
                (theme.startsWith("pixel")
                  ? "bg-amber-200/80 text-amber-950 font-bold"
                  : "bg-blue-50/60 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-medium")
            )}
          >
            <div
              className={cn(
                "size-3 rounded-full border flex items-center justify-center shrink-0",
                selectedTarget.type === "none"
                  ? theme.startsWith("pixel")
                    ? "border-amber-900 bg-amber-900 text-white"
                    : "border-blue-500 bg-blue-500 text-white"
                  : "border-slate-300 dark:border-slate-600"
              )}
            >
              {selectedTarget.type === "none" && <div className="size-1 bg-white rounded-full" />}
            </div>
            <span className="truncate">纯专注 (无关联)</span>
          </div>

          {/* ======================================================== */}
          {/* Tab 1: Project Tree (Projects -> Stages -> Tasks)         */}
          {/* ======================================================== */}
          {selectorTab === "project" && (
            <>
              {projectsTree.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-[11px]">暂无项目</div>
              ) : (
                projectsTree.map(({ project: p, stages: pStages, tasks: pTasks }) => {
                  const isProjectExpanded = Boolean(expandedProjects[p.id]);
                  const isProjectSelected =
                    selectedTarget.type === "project" && selectedTarget.id === p.id;
                  const unassignedTasks = pTasks.filter((t) => !t.projectStageId);
                  const hasChildren = pStages.length > 0 || unassignedTasks.length > 0;

                  return (
                    <div key={p.id} className="space-y-0.5">
                      {/* Project Row */}
                      <div
                        className={cn(
                          "group flex items-center justify-between px-1.5 py-1 rounded-md cursor-pointer transition-colors text-xs hover:bg-slate-100 dark:hover:bg-slate-800",
                          theme.startsWith("pixel") && "hover:bg-amber-100/80 rounded-xs",
                          isProjectSelected &&
                            (theme.startsWith("pixel")
                              ? "bg-amber-200/90 text-amber-950 font-bold"
                              : "bg-blue-50/70 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-medium")
                        )}
                      >
                        <div
                          className="flex items-center gap-1 min-w-0 flex-1"
                          onClick={() => {
                            const target: SelectedTarget = {
                              type: "project",
                              id: p.id,
                              name: p.name,
                              projectId: p.id,
                              projectName: p.name,
                            };
                            setSelectedTarget(target);
                            localStorage.setItem(
                              "workbuddy.focusAssistant.target",
                              JSON.stringify(target)
                            );
                            setActiveModal("none");
                          }}
                        >
                          {hasChildren ? (
                            <button
                              type="button"
                              onClick={(e) => toggleProject(p.id, e)}
                              className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors shrink-0"
                            >
                              {isProjectExpanded ? (
                                <ChevronDown size={11} />
                              ) : (
                                <ChevronRight size={11} />
                              )}
                            </button>
                          ) : (
                            <span className="w-3 shrink-0" />
                          )}
                          <FolderKanban
                            size={12}
                            className={cn(
                              "shrink-0",
                              theme.startsWith("pixel") ? "text-amber-800" : "text-blue-500"
                            )}
                          />
                          <span className="truncate flex-1 font-medium text-[11px]">{p.name}</span>
                        </div>

                        {/* Project Select Radio */}
                        <div
                          onClick={() => {
                            const target: SelectedTarget = {
                              type: "project",
                              id: p.id,
                              name: p.name,
                              projectId: p.id,
                              projectName: p.name,
                            };
                            setSelectedTarget(target);
                            localStorage.setItem(
                              "workbuddy.focusAssistant.target",
                              JSON.stringify(target)
                            );
                            setActiveModal("none");
                          }}
                          className={cn(
                            "size-3 rounded-full border flex items-center justify-center shrink-0 ml-1 cursor-pointer",
                            isProjectSelected
                              ? theme.startsWith("pixel")
                                ? "border-amber-900 bg-amber-900 text-white"
                                : "border-blue-500 bg-blue-500 text-white"
                              : "border-slate-300 dark:border-slate-600 hover:border-blue-400"
                          )}
                          title="关联整个项目"
                        >
                          {isProjectSelected && <div className="size-1 bg-white rounded-full" />}
                        </div>
                      </div>

                      {/* Expanded Stages & Tasks */}
                      {isProjectExpanded && hasChildren && (
                        <div className="pl-2 space-y-0.5 border-l border-slate-200/70 dark:border-slate-700/70 ml-2">
                          {/* Stages */}
                          {pStages.map((s) => {
                            const sTasks = pTasks.filter((t) => t.projectStageId === s.id);
                            const isStageExpanded = Boolean(expandedStages[s.id]);
                            const isStageSelected =
                              selectedTarget.type === "project-stage" &&
                              selectedTarget.id === s.id;

                            return (
                              <div key={s.id} className="space-y-0.5">
                                {/* Stage Row */}
                                <div
                                  className={cn(
                                    "flex items-center justify-between px-1 py-0.5 rounded-md cursor-pointer transition-colors text-xs hover:bg-slate-100 dark:hover:bg-slate-800",
                                    theme.startsWith("pixel") && "hover:bg-amber-100/80 rounded-xs",
                                    isStageSelected &&
                                      (theme.startsWith("pixel")
                                        ? "bg-amber-200/90 text-amber-950 font-bold"
                                        : "bg-purple-50/70 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 font-medium")
                                  )}
                                >
                                  <div
                                    className="flex items-center gap-1 min-w-0 flex-1"
                                    onClick={() => {
                                      const target: SelectedTarget = {
                                        type: "project-stage",
                                        id: s.id,
                                        name: `${p.name} · ${s.name}`,
                                        projectId: p.id,
                                        projectName: p.name,
                                        stageId: s.id,
                                        stageName: s.name,
                                      };
                                      setSelectedTarget(target);
                                      localStorage.setItem(
                                        "workbuddy.focusAssistant.target",
                                        JSON.stringify(target)
                                      );
                                      setActiveModal("none");
                                    }}
                                  >
                                    {sTasks.length > 0 ? (
                                      <button
                                        type="button"
                                        onClick={(e) => toggleStage(s.id, e)}
                                        className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors shrink-0"
                                      >
                                        {isStageExpanded ? (
                                          <ChevronDown size={10} />
                                        ) : (
                                          <ChevronRight size={10} />
                                        )}
                                      </button>
                                    ) : (
                                      <span className="w-2.5 shrink-0" />
                                    )}
                                    <Layers
                                      size={11}
                                      className={cn(
                                        "shrink-0",
                                        theme.startsWith("pixel")
                                          ? "text-amber-700"
                                          : "text-purple-500"
                                      )}
                                    />
                                    <span className="truncate flex-1 text-[10.5px]">
                                      {s.name}
                                    </span>
                                    <span className="text-[9px] text-slate-400 font-mono">
                                      ({sTasks.length})
                                    </span>
                                  </div>

                                  {/* Stage Select Radio */}
                                  <div
                                    onClick={() => {
                                      const target: SelectedTarget = {
                                        type: "project-stage",
                                        id: s.id,
                                        name: `${p.name} · ${s.name}`,
                                        projectId: p.id,
                                        projectName: p.name,
                                        stageId: s.id,
                                        stageName: s.name,
                                      };
                                      setSelectedTarget(target);
                                      localStorage.setItem(
                                        "workbuddy.focusAssistant.target",
                                        JSON.stringify(target)
                                      );
                                      setActiveModal("none");
                                    }}
                                    className={cn(
                                      "size-2.5 rounded-full border flex items-center justify-center shrink-0 ml-1 cursor-pointer",
                                      isStageSelected
                                        ? theme.startsWith("pixel")
                                          ? "border-amber-900 bg-amber-900 text-white"
                                          : "border-purple-500 bg-purple-500 text-white"
                                        : "border-slate-300 dark:border-slate-600 hover:border-purple-400"
                                    )}
                                    title="关联此阶段"
                                  >
                                    {isStageSelected && (
                                      <div className="size-0.5 bg-white rounded-full" />
                                    )}
                                  </div>
                                </div>

                                {/* Stage Tasks */}
                                {isStageExpanded && sTasks.length > 0 && (
                                  <div className="pl-3 space-y-0.5 border-l border-slate-200/50 dark:border-slate-700/50 ml-1.5">
                                    {sTasks.map((t) => {
                                      const isTaskSelected =
                                        selectedTarget.type === "project-task" &&
                                        selectedTarget.id === t.id;
                                      return (
                                        <div
                                          key={t.id}
                                          onClick={() => {
                                            const target: SelectedTarget = {
                                              type: "project-task",
                                              id: t.id,
                                              name: t.title,
                                              projectId: p.id,
                                              projectName: p.name,
                                              stageId: s.id,
                                              stageName: s.name,
                                            };
                                            setSelectedTarget(target);
                                            localStorage.setItem(
                                              "workbuddy.focusAssistant.target",
                                              JSON.stringify(target)
                                            );
                                            setActiveModal("none");
                                          }}
                                          className={cn(
                                            "flex items-center gap-1.5 px-1 py-0.5 rounded-md cursor-pointer transition-colors text-xs hover:bg-slate-100 dark:hover:bg-slate-800",
                                            theme.startsWith("pixel") && "hover:bg-amber-100/80 rounded-xs",
                                            isTaskSelected &&
                                              (theme.startsWith("pixel")
                                                ? "bg-amber-200/90 text-amber-950 font-bold"
                                                : "bg-emerald-50/70 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 font-medium")
                                          )}
                                        >
                                          <div
                                            className={cn(
                                              "size-2 rounded-full border flex items-center justify-center shrink-0",
                                              isTaskSelected
                                                ? theme.startsWith("pixel")
                                                  ? "border-amber-900 bg-amber-900 text-white"
                                                  : "border-emerald-500 bg-emerald-500 text-white"
                                                : "border-slate-300 dark:border-slate-600"
                                            )}
                                          >
                                            {isTaskSelected && (
                                              <div className="size-0.5 bg-white rounded-full" />
                                            )}
                                          </div>
                                          <span className="truncate flex-1 text-[10px]">
                                            {t.title}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Unassigned Tasks in Project */}
                          {unassignedTasks.length > 0 && (
                            <div className="pl-1 space-y-0.5">
                              {unassignedTasks.map((t) => {
                                const isTaskSelected =
                                  selectedTarget.type === "project-task" &&
                                  selectedTarget.id === t.id;
                                return (
                                  <div
                                    key={t.id}
                                    onClick={() => {
                                      const target: SelectedTarget = {
                                        type: "project-task",
                                        id: t.id,
                                        name: t.title,
                                        projectId: p.id,
                                        projectName: p.name,
                                      };
                                      setSelectedTarget(target);
                                      localStorage.setItem(
                                        "workbuddy.focusAssistant.target",
                                        JSON.stringify(target)
                                      );
                                      setActiveModal("none");
                                    }}
                                    className={cn(
                                      "flex items-center gap-1.5 px-1 py-0.5 rounded-md cursor-pointer transition-colors text-xs hover:bg-slate-100 dark:hover:bg-slate-800",
                                      theme.startsWith("pixel") && "hover:bg-amber-100/80 rounded-xs",
                                      isTaskSelected &&
                                        (theme.startsWith("pixel")
                                          ? "bg-amber-200/90 text-amber-950 font-bold"
                                          : "bg-emerald-50/70 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 font-medium")
                                    )}
                                  >
                                    <div
                                      className={cn(
                                        "size-2 rounded-full border flex items-center justify-center shrink-0",
                                        isTaskSelected
                                          ? theme.startsWith("pixel")
                                            ? "border-amber-900 bg-amber-900 text-white"
                                            : "border-emerald-500 bg-emerald-500 text-white"
                                          : "border-slate-300 dark:border-slate-600"
                                      )}
                                    >
                                      {isTaskSelected && (
                                        <div className="size-0.5 bg-white rounded-full" />
                                      )}
                                    </div>
                                    <span className="truncate flex-1 text-[10px]">
                                      {t.title}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}

          {/* ======================================================== */}
          {/* Tab 2: Standalone Tasks                                  */}
          {/* ======================================================== */}
          {selectorTab === "task" && (
            <>
              {filteredTasks.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-[11px]">暂无独立待办任务</div>
              ) : (
                filteredTasks.map((t) => {
                  const isSelected = selectedTarget.type === "task" && selectedTarget.id === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        const target: SelectedTarget = { type: "task", id: t.id, name: t.title };
                        setSelectedTarget(target);
                        localStorage.setItem(
                          "workbuddy.focusAssistant.target",
                          JSON.stringify(target)
                        );
                        setActiveModal("none");
                      }}
                      className={cn(
                        "flex items-center gap-2 px-1.5 py-1.5 rounded-md cursor-pointer transition-colors text-xs hover:bg-slate-100 dark:hover:bg-slate-800",
                        theme.startsWith("pixel") && "hover:bg-amber-100/80 rounded-xs",
                        isSelected &&
                          (theme.startsWith("pixel")
                            ? "bg-amber-200/90 text-amber-950 font-bold"
                            : "bg-blue-50/60 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-medium")
                      )}
                    >
                      <div
                        className={cn(
                          "size-3 rounded-full border flex items-center justify-center shrink-0",
                          isSelected
                            ? theme.startsWith("pixel")
                              ? "border-amber-900 bg-amber-900 text-white"
                              : "border-blue-500 bg-blue-500 text-white"
                            : "border-slate-300 dark:border-slate-600"
                        )}
                      >
                        {isSelected && <div className="size-1 bg-white rounded-full" />}
                      </div>
                      <span className="truncate flex-1 text-[11px]">{t.title}</span>
                    </div>
                  );
                })
              )}
            </>
          )}

          {/* ======================================================== */}
          {/* Tab 3: Habits                                            */}
          {/* ======================================================== */}
          {selectorTab === "habit" && (
            <>
              {filteredHabits.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-[11px]">暂无习惯</div>
              ) : (
                filteredHabits.map((h) => {
                  const isSelected = selectedTarget.type === "habit" && selectedTarget.id === h.id;
                  return (
                    <div
                      key={h.id}
                      onClick={() => {
                        const target: SelectedTarget = { type: "habit", id: h.id, name: h.name };
                        setSelectedTarget(target);
                        localStorage.setItem(
                          "workbuddy.focusAssistant.target",
                          JSON.stringify(target)
                        );
                        setActiveModal("none");
                      }}
                      className={cn(
                        "flex items-center gap-2 px-1.5 py-1.5 rounded-md cursor-pointer transition-colors text-xs hover:bg-slate-100 dark:hover:bg-slate-800",
                        theme.startsWith("pixel") && "hover:bg-amber-100/80 rounded-xs",
                        isSelected &&
                          (theme.startsWith("pixel")
                            ? "bg-amber-200/90 text-amber-950 font-bold"
                            : "bg-blue-50/60 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-medium")
                      )}
                    >
                      <div
                        className={cn(
                          "size-3 rounded-full border flex items-center justify-center shrink-0",
                          isSelected
                            ? theme.startsWith("pixel")
                              ? "border-amber-900 bg-amber-900 text-white"
                              : "border-blue-500 bg-blue-500 text-white"
                            : "border-slate-300 dark:border-slate-600"
                        )}
                      >
                        {isSelected && <div className="size-1 bg-white rounded-full" />}
                      </div>
                      <span className="truncate flex-1 text-[11px]">{h.name}</span>
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
          "w-[200px] h-[180px] p-2.5 flex flex-col justify-between rounded-2xl select-none overflow-hidden text-xs border-0 outline-none",
          getThemeClasses()
        )}
      >
        <div className="flex items-center justify-between pb-1 border-b border-slate-200/80 dark:border-slate-700/80">
          <div className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-100">
            <Clock size={13} className="text-orange-500" />
            <span>调整专注时长</span>
          </div>
          <button
            onClick={() => setActiveModal("none")}
            className="size-5 rounded-full hover:bg-slate-200/60 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 cursor-pointer"
          >
            <X size={12} />
          </button>
        </div>

        <div className="space-y-2 py-1">
          {/* Focus minutes */}
          <div className="flex items-center justify-between">
            <label className="text-slate-600 dark:text-slate-300 text-xs">专注时长 (分)</label>
            <input
              type="number"
              min={1}
              max={180}
              value={editFocusInput}
              onChange={(e) => setEditFocusInput(e.target.value)}
              className="w-14 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-center font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
            />
          </div>

          {/* Rest minutes */}
          <div className="flex items-center justify-between">
            <label className="text-slate-600 dark:text-slate-300 text-xs">休息时长 (分)</label>
            <input
              type="number"
              min={1}
              max={60}
              value={editRestInput}
              onChange={(e) => setEditRestInput(e.target.value)}
              className="w-14 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-center font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 pt-1 border-t border-slate-200/80 dark:border-slate-700/80">
          <button
            onClick={() => setActiveModal("none")}
            className="flex-1 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={handleSaveTime}
            className="flex-1 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
          >
            保存并重置
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // Modal: Right-Click / More Menu & Style Menu
  // ============================================================================
  if (activeModal === "menu" || activeModal === "style-menu") {
    return (
      <div
        className={cn(
          "w-[200px] h-[250px] p-2.5 flex flex-col justify-between rounded-2xl select-none overflow-hidden text-xs border-0 outline-none",
          getThemeClasses()
        )}
      >
        <div className="flex items-center justify-between pb-1 border-b border-slate-200/80 dark:border-slate-700/80">
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            {activeModal === "style-menu" ? "选择主题风格" : "专注助手选项"}
          </span>
          <button
            onClick={() => setActiveModal("none")}
            className="size-5 rounded-full hover:bg-slate-200/60 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 cursor-pointer"
          >
            <X size={12} />
          </button>
        </div>

        {activeModal === "menu" ? (
          <div className="flex-1 py-1 space-y-1 overflow-y-auto no-scrollbar text-xs">
            {/* Modify Time Settings */}
            <button
              onClick={() => {
                setEditFocusInput(String(focusMinutes));
                setEditRestInput(String(restMinutes));
                setActiveModal("time-editor");
              }}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2">
                <Clock size={13} className="text-orange-500" />
                <span>修改时间设置 ({focusMinutes}分/{restMinutes}分)</span>
              </div>
              <ChevronRight size={12} className="text-slate-400" />
            </button>

            {/* Switch Style */}
            <button
              onClick={() => setActiveModal("style-menu")}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2">
                <Sparkles size={13} className="text-blue-500" />
                <span>切换主题风格</span>
              </div>
              <ChevronRight size={12} className="text-slate-400" />
            </button>

            {/* Toggle Always on Top */}
            <button
              onClick={handleTogglePin}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left"
            >
              <span>窗口置顶</span>
              <span className="text-[11px] text-slate-400 font-medium">
                {isPinned ? "已开启" : "已关闭"}
              </span>
            </button>

            {/* Toggle Sound Effects */}
            <button
              onClick={() => {
                const next = !soundOn;
                setSoundOn(next);
                setSoundEnabled(next);
              }}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2">
                {soundOn ? (
                  <Volume2 size={13} className="text-emerald-500" />
                ) : (
                  <VolumeX size={13} className="text-slate-400" />
                )}
                <span>提示音效</span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                {soundOn ? "已开启" : "已静音"}
              </span>
            </button>

            {/* Toggle Stats expansion (in card modes) */}
            {!isPurePet && (
              <button
                onClick={() => {
                  setShowStats(!showStats);
                  setActiveModal("none");
                }}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left"
              >
                <span>统计详情面板</span>
                <span className="text-[11px] text-slate-400 font-medium">
                  {showStats ? "折叠" : "展开"}
                </span>
              </button>
            )}

            {/* Reset Timer */}
            <button
              onClick={() => {
                const resetSec = (sessionType === "rest" ? restMinutes : focusMinutes) * 60;
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
          <div className="flex-1 py-1 space-y-1 overflow-y-auto no-scrollbar text-xs">
            {/* 1. Classic Light */}
            <button
              onClick={() => handleSetTheme("classic")}
              className={cn(
                "w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left",
                theme === "classic" && "bg-blue-50/80 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 font-medium"
              )}
            >
              <div className="flex items-center gap-2">
                <Sun size={13} className="text-amber-500" />
                <span>经典浅色卡片</span>
              </div>
              {theme === "classic" && <Check size={13} className="text-blue-500" />}
            </button>

            {/* 2. Retro Pixel Cat Card */}
            <button
              onClick={() => handleSetTheme("pixel")}
              className={cn(
                "w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left",
                theme === "pixel" && "bg-amber-100/80 text-amber-900 font-medium"
              )}
            >
              <div className="flex items-center gap-2">
                <Gamepad2 size={13} className="text-orange-600" />
                <span>复古像素猫 (卡片)</span>
              </div>
              {theme === "pixel" && <Check size={13} className="text-amber-700" />}
            </button>

            {/* 3. Retro Pixel Cat Pure Pet */}
            <button
              onClick={() => handleSetTheme("pixel-pure")}
              className={cn(
                "w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left",
                theme === "pixel-pure" && "bg-amber-200/80 text-amber-950 font-bold"
              )}
            >
              <div className="flex items-center gap-2">
                <Cat size={13} className="text-orange-600" />
                <span>复古像素猫 (纯宠物)</span>
              </div>
              {theme === "pixel-pure" && <Check size={13} className="text-amber-900" />}
            </button>

            {/* 4. Retro Pixel Dog Card */}
            <button
              onClick={() => handleSetTheme("pixel-dog")}
              className={cn(
                "w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left",
                theme === "pixel-dog" && "bg-amber-100/80 text-amber-900 font-medium"
              )}
            >
              <div className="flex items-center gap-2">
                <Gamepad2 size={13} className="text-amber-700" />
                <span>复古像素狗 (卡片)</span>
              </div>
              {theme === "pixel-dog" && <Check size={13} className="text-amber-700" />}
            </button>

            {/* 5. Retro Pixel Dog Pure Pet */}
            <button
              onClick={() => handleSetTheme("pixel-dog-pure")}
              className={cn(
                "w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left",
                theme === "pixel-dog-pure" && "bg-amber-200/80 text-amber-950 font-bold"
              )}
            >
              <div className="flex items-center gap-2">
                <Dog size={13} className="text-amber-700" />
                <span>复古像素狗 (纯宠物)</span>
              </div>
              {theme === "pixel-dog-pure" && <Check size={13} className="text-amber-900" />}
            </button>

            {/* 6. Modern Vector Dog Card */}
            <button
              onClick={() => handleSetTheme("vector")}
              className={cn(
                "w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left",
                theme === "vector" && "bg-orange-100/80 text-orange-900 font-medium"
              )}
            >
              <div className="flex items-center gap-2">
                <Sparkles size={13} className="text-orange-500" />
                <span>现代矢量柴犬 (卡片)</span>
              </div>
              {theme === "vector" && <Check size={13} className="text-orange-600" />}
            </button>

            {/* 7. Modern Vector Dog Pure Pet */}
            <button
              onClick={() => handleSetTheme("vector-pure")}
              className={cn(
                "w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left",
                theme === "vector-pure" && "bg-orange-200/80 text-orange-950 font-bold"
              )}
            >
              <div className="flex items-center gap-2">
                <Bot size={13} className="text-orange-600" />
                <span>现代矢量柴犬 (纯宠物)</span>
              </div>
              {theme === "vector-pure" && <Check size={13} className="text-orange-700" />}
            </button>
          </div>
        )}

        <div className="pt-1 border-t border-slate-200/80 dark:border-slate-700/80">
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
  // Pure Pet View
  // ============================================================================
  if (isPurePet) {
    return (
      <div
        className="relative w-[220px] h-[180px] select-none flex flex-col items-center justify-center overflow-visible outline-none group mx-auto cursor-grab active:cursor-grabbing"
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setActiveModal("menu");
        }}
        onPointerDown={handleDragPointerDown}
        onPointerMove={handleDragPointerMove}
        onPointerUp={handleDragPointerUp}
        onPointerCancel={handleDragPointerUp}
      >
        {/* Header: Speech Bubble / Timer */}
        <div className="w-full flex items-center justify-center relative z-30 shrink-0 mb-0.5 pointer-events-auto">
          {bubbleText ? (
            <SpeechBubble
              text={bubbleText}
              theme={theme}
              onDismiss={() => setBubbleText(null)}
            />
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditFocusInput(String(focusMinutes));
                setEditRestInput(String(restMinutes));
                setActiveModal("time-editor");
              }}
              className={cn(
                "px-2.5 py-0.5 rounded-full text-xs font-bold transition-transform cursor-pointer hover:scale-105 active:scale-95 shadow-xs",
                theme.startsWith("pixel")
                  ? "bg-amber-50 text-amber-950 border border-amber-900 font-mono text-[11px]"
                  : sessionType === "rest"
                  ? "bg-emerald-500/90 text-white backdrop-blur-xs text-[11px]"
                  : "bg-orange-500/90 text-white backdrop-blur-xs text-[11px]"
              )}
              title="点击修改专注/休息时间（右键宠物呼出菜单）"
            >
              {sessionType === "rest" && "☕ "}
              {formatTime(secondsLeft)}
            </button>
          )}
        </div>

        {/* Pet Display */}
        <div
          className={cn(
            "relative flex items-center justify-center pointer-events-auto transition-all duration-300 rounded-full",
            isGlowActive && "ring-8 ring-amber-400/50 shadow-[0_0_30px_rgba(245,158,11,0.6)] animate-pulse"
          )}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setActiveModal("menu");
          }}
        >
          {theme === "pixel-pure" ? (
            <PixelPet
              state={petState}
              size="lg"
              isWalking={isDragging}
              direction={dragDirection}
              onPoke={handlePokePet}
            />
          ) : theme === "pixel-dog-pure" ? (
            <PixelDog
              state={petState}
              size="lg"
              isWalking={isDragging}
              direction={dragDirection}
              onPoke={handlePokePet}
            />
          ) : (
            <VectorPet
              state={petState}
              size="lg"
              isWalking={isDragging}
              direction={dragDirection}
              onPoke={handlePokePet}
            />
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none group-hover:pointer-events-auto z-20 shrink-0 mt-0.5">
          {status === "paused" ? (
            <div className="flex items-center gap-1 bg-white/95 dark:bg-slate-800/95 p-1 rounded-full shadow-md border border-slate-200/80 dark:border-slate-700">
              <button
                onClick={(e) => { e.stopPropagation(); void resume(); }}
                className="size-5 rounded-full bg-blue-500 text-white flex items-center justify-center cursor-pointer hover:scale-110"
              >
                <Play size={9} className="fill-current ml-0.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); sessionType === "rest" ? void skipRest() : void stopFocusAndStartRest(); }}
                className="size-5 rounded-full bg-slate-500 text-white flex items-center justify-center cursor-pointer hover:scale-110"
              >
                <div className="size-1.5 bg-white rounded-[0.5px]" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveModal("menu"); }}
                className="size-5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                <MoreHorizontal size={11} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 bg-white/95 dark:bg-slate-800/95 px-1.5 py-0.5 rounded-full shadow-md border border-slate-200/80 dark:border-slate-700">
              <button
                onClick={(e) => { e.stopPropagation(); status === "ready" ? void startFocus() : void pause(); }}
                className={cn("size-5 rounded-full text-white flex items-center justify-center cursor-pointer hover:scale-110", sessionType === "rest" ? "bg-emerald-500" : "bg-orange-500")}
              >
                {status === "running" ? <Pause size={10} className="fill-current" /> : <Play size={10} className="fill-current ml-0.5" />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveModal("task-selector"); }}
                className="px-1.5 py-0.5 text-[10px] text-slate-600 dark:text-slate-300 hover:text-blue-500 max-w-[65px] truncate cursor-pointer font-medium"
              >
                {getTargetLabel()}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveModal("menu"); }}
                className="size-5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                <MoreHorizontal size={11} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // Main Floating Card View
  // ============================================================================
  return (
    <div
      className={cn(
        "relative w-[200px] rounded-2xl select-none transition-all duration-300 flex flex-col justify-between overflow-visible outline-none mx-auto cursor-grab active:cursor-grabbing",
        showStats ? "h-[140px] p-2.5" : "h-[75px] px-3 py-2",
        isGlowActive && (
          theme.startsWith("pixel")
            ? "shadow-[0px_0px_0px_3px_#F59E0B,0px_0px_16px_rgba(245,158,11,0.6)]"
            : "ring-4 ring-amber-400/70 dark:ring-amber-500/70 shadow-[0_0_24px_rgba(245,158,11,0.55)] animate-pulse"
        ),
        getThemeClasses()
      )}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setActiveModal("menu");
      }}
      onPointerDown={handleDragPointerDown}
      onPointerMove={handleDragPointerMove}
      onPointerUp={handleDragPointerUp}
      onPointerCancel={handleDragPointerUp}
    >
      {/* Speech Bubble floating on top inside card */}
      {bubbleText && (
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-50 w-auto max-w-[185px]">
          <SpeechBubble text={bubbleText} theme={theme} onDismiss={() => setBubbleText(null)} />
        </div>
      )}

      {/* Top Right: Window Actions (Stats, Menu, Close) */}
      <div className="absolute top-1.5 right-2 flex items-center gap-0.5 text-slate-400 dark:text-slate-500 z-20">
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

      {/* Main Row: Pet Avatar + Middle Info + Right Control Button */}
      <div className="flex items-center w-full h-[58px] mt-0.5" data-drag="true">
        {/* Left Side: Avatar / Pet / Circular Ring according to Theme */}
        {theme === "pixel" ? (
          <PixelPet
            state={petState}
            size="md"
            isWalking={isDragging}
            direction={dragDirection}
            onPoke={handlePokePet}
            className="shrink-0 mr-1.5"
          />
        ) : theme === "pixel-dog" ? (
          <PixelDog
            state={petState}
            size="md"
            isWalking={isDragging}
            direction={dragDirection}
            onPoke={handlePokePet}
            className="shrink-0 mr-1.5"
          />
        ) : theme === "vector" ? (
          <VectorPet
            state={petState}
            size="md"
            isWalking={isDragging}
            direction={dragDirection}
            onPoke={handlePokePet}
            className="shrink-0 mr-1.5"
          />
        ) : (
          /* Classic Light Circular Ring */
          <div className="relative size-11 flex items-center justify-center shrink-0 mr-1.5">
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

            {/* Center Action Button (Classic) */}
            {status === "paused" ? (
              <div className="absolute inset-0 m-auto w-[33px] h-[26px] rounded-full bg-slate-50 dark:bg-slate-800/95 flex items-center justify-center">
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
                <div className="w-[1px] h-3 bg-slate-200/90 dark:bg-slate-700 shrink-0" />
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
        )}

        {/* Center: Title & Timer */}
        <div className="flex flex-col justify-center flex-1 min-w-0 pr-1" data-drag="true">
          {/* Target Title (Clickable in focus mode, status indicator in rest mode) */}
          {sessionType === "rest" ? (
            <div
              className={cn(
                "flex items-center gap-1 text-xs font-semibold select-none max-w-[85px] truncate",
                theme.startsWith("pixel")
                  ? "text-emerald-800 font-mono text-[11px]"
                  : "text-emerald-600 dark:text-emerald-400"
              )}
              title="休息时段"
            >
              <Coffee size={12} className="shrink-0" />
              <span className="truncate">休息时段</span>
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveModal("task-selector");
              }}
              className={cn(
                "flex items-center gap-0.5 text-xs font-medium cursor-pointer select-none max-w-[85px] truncate text-left",
                theme.startsWith("pixel")
                  ? "text-amber-800 hover:text-amber-950 font-mono text-[11px]"
                  : "text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
              )}
              title="点击选择关联任务/习惯"
            >
              <span className="truncate">{getTargetLabel()}</span>
              <ChevronRight size={11} className="shrink-0 opacity-70" />
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
              theme.startsWith("pixel") && "font-mono tracking-tighter text-amber-950",
              !theme.startsWith("pixel") && sessionType === "rest" && "text-emerald-600 dark:text-emerald-400 hover:text-emerald-700",
              !theme.startsWith("pixel") && sessionType !== "rest" && "text-slate-900 dark:text-slate-100 hover:text-blue-600"
            )}
            title="点击修改时间设置"
          >
            {formatTime(secondsLeft)}
          </button>
        </div>

        {/* Right: Action / Play-Pause for Pet Themes (Pixel & Vector Card mode) */}
        {theme !== "classic" && (
          <div className="flex items-center justify-center shrink-0 mt-3 mr-0.5">
            {status === "paused" ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void resume();
                  }}
                  className={cn(
                    "size-6 rounded-md flex items-center justify-center cursor-pointer transition-transform hover:scale-110",
                    theme.startsWith("pixel")
                      ? "bg-amber-200 border border-amber-900 text-amber-900"
                      : "bg-orange-100 text-orange-600"
                  )}
                  title={sessionType === "rest" ? "继续休息" : "继续专注"}
                >
                  <Play size={11} className="fill-current ml-0.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (sessionType === "rest") {
                      void skipRest();
                    } else {
                      void stopFocusAndStartRest();
                    }
                  }}
                  className={cn(
                    "size-6 rounded-md flex items-center justify-center cursor-pointer transition-transform hover:scale-110",
                    theme.startsWith("pixel")
                      ? "bg-amber-200 border border-amber-900 text-amber-900"
                      : "bg-slate-100 text-slate-600"
                  )}
                  title={sessionType === "rest" ? "跳过休息" : "结束专注并开始休息"}
                >
                  <div className="size-2 rounded-[1px] bg-current" />
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
                className={cn(
                  "size-7 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-105 active:scale-95 shadow-xs",
                  theme.startsWith("pixel")
                    ? "bg-amber-300 border-2 border-amber-900 text-amber-950"
                    : sessionType === "rest"
                    ? "bg-emerald-500 text-white"
                    : "bg-orange-500 text-white"
                )}
                title={
                  status === "running"
                    ? sessionType === "rest"
                      ? "暂停休息"
                      : "暂停专注"
                    : "开始专注"
                }
              >
                {status === "running" ? (
                  <Pause size={12} className="fill-current" />
                ) : (
                  <Play size={12} className="fill-current ml-0.5" />
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bottom Expanded Stats Section */}
      {showStats && (
        <div
          className={cn(
            "pt-2 flex items-center justify-around text-center shrink-0 border-t",
            theme === "pixel"
              ? "border-amber-900/30 text-amber-950 font-mono"
              : "border-slate-200/60 dark:border-slate-800/80"
          )}
        >
          {/* Column 1: Today Focus */}
          <div className="flex-1 flex flex-col items-center">
            <span className="text-[10px] opacity-70 font-normal">今日专注</span>
            <span className="text-sm font-bold leading-tight">
              {stats.todayMinutes}
              <span className="text-[11px] font-normal opacity-80 ml-0.5">m</span>
            </span>
          </div>

          <div className={cn("h-6 w-px", theme === "pixel" ? "bg-amber-900/30" : "bg-slate-200/60 dark:bg-slate-800/80")} />

          {/* Column 2: This Week Focus */}
          <div className="flex-1 flex flex-col items-center">
            <span className="text-[10px] opacity-70 font-normal">本周专注</span>
            <span className="text-sm font-bold leading-tight">
              {stats.weekMinutes}
              <span className="text-[11px] font-normal opacity-80 ml-0.5">m</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
