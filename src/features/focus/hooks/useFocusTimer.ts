import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { focusAssistantApi, FocusStats } from "../api/focusAssistantService";
import { sendDesktopNotification } from "@/lib/notifications/notificationService";
import {
  playVictorySound,
  playRestEndSound,
  playPokeSound,
} from "@/lib/soundFeedback";
import type { FocusSession, FocusSessionType } from "../types";
import { createFocusCycleId } from "@/lib/entityIds";
import type { PetState } from "../components/pets/PixelPet";
import { getPetDialogue, PetEvent, PetDialogueOptions } from "../components/pets/petDialogues";
import { getNotificationDisplayOptions, NotificationDisplayOptions } from "@/lib/preferences";
import type { SelectedTarget, Status, StyleTheme } from "../components/assistant/types";

export interface UseFocusTimerOptions {
  userId?: string | null;
  focusMinutes: number;
  restMinutes: number;
  selectedTarget: SelectedTarget;
  onSelectTarget?: (target: SelectedTarget) => void;
  theme: StyleTheme;
}

export function useFocusTimer({
  userId,
  focusMinutes,
  restMinutes,
  selectedTarget,
  onSelectTarget,
  theme,
}: UseFocusTimerOptions) {
  const [status, setStatus] = useState<Status>("ready");
  const [sessionType, setSessionType] = useState<FocusSessionType>("focus");
  const [secondsLeft, setSecondsLeft] = useState(focusMinutes * 60);
  const [session, setSession] = useState<FocusSession | null>(null);
  const [stats, setStats] = useState<FocusStats>({ todayMinutes: 0, weekMinutes: 0 });
  const [bubbleText, setBubbleText] = useState<string | null>(null);
  const [petOverrideState, setPetOverrideState] = useState<PetState | null>(null);
  const [isPetPoked, setIsPetPoked] = useState<boolean>(false);
  const [isGlowActive, setIsGlowActive] = useState<boolean>(false);

  const startedAt = useRef<number | null>(null);
  const remainingRef = useRef(secondsLeft);
  const targetEndTimeRef = useRef<number | null>(null);
  const sessionRef = useRef<FocusSession | null>(null);
  const sessionTypeRef = useRef<FocusSessionType>(sessionType);
  const statusRef = useRef<Status>(status);
  const isCompletingRef = useRef(false);
  const bubbleTimerRef = useRef<number | null>(null);

  // Derived pet properties
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

  const getDialogue = useCallback(
    (event: PetEvent, opts?: Partial<PetDialogueOptions>) => {
      return getPetDialogue(event, {
        species: currentSpecies,
        targetName: selectedTarget.name,
        focusMinutes,
        restMinutes,
        ...opts,
      });
    },
    [currentSpecies, selectedTarget.name, focusMinutes, restMinutes]
  );

  const speak = useCallback((text: string, durationMs = 4000) => {
    const { assistantBubble } = getNotificationDisplayOptions();
    if (!assistantBubble) return;
    if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    setBubbleText(text);
    bubbleTimerRef.current = window.setTimeout(() => {
      setBubbleText(null);
      bubbleTimerRef.current = null;
    }, durationMs);
  }, []);

  const dismissBubble = useCallback(() => {
    if (bubbleTimerRef.current) {
      clearTimeout(bubbleTimerRef.current);
      bubbleTimerRef.current = null;
    }
    setBubbleText(null);
  }, []);

  useEffect(() => {
    remainingRef.current = secondsLeft;
  }, [secondsLeft]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    sessionTypeRef.current = sessionType;
  }, [sessionType]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Load stats
  const refreshStats = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await focusAssistantApi.getFocusStats();
      setStats(data);
    } catch {
      // Ignore
    }
  }, [userId]);

  useEffect(() => {
    refreshStats();
  }, [refreshStats, status]);

  // Actions
  const startFocus = useCallback(
    async (customMinutes?: number) => {
      isCompletingRef.current = false;
      const minutes = customMinutes ?? focusMinutes;
      const totalSec = minutes * 60;
      setSessionType("focus");
      sessionTypeRef.current = "focus";
      setSecondsLeft(totalSec);
      remainingRef.current = totalSec;
      startedAt.current = Date.now();
      targetEndTimeRef.current = Date.now() + totalSec * 1000;
      setStatus("running");
      statusRef.current = "running";

      const text = getDialogue("focus_start");
      speak(text);

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
    },
    [focusMinutes, getDialogue, speak, selectedTarget]
  );

  const startRest = useCallback(
    async (cycleId?: string, taskId?: string | null, customMinutes?: number) => {
      isCompletingRef.current = false;
      const minutes = customMinutes ?? restMinutes;
      const totalSec = minutes * 60;
      setSessionType("rest");
      sessionTypeRef.current = "rest";
      setSecondsLeft(totalSec);
      remainingRef.current = totalSec;
      startedAt.current = Date.now();
      targetEndTimeRef.current = Date.now() + totalSec * 1000;
      setStatus("running");
      statusRef.current = "running";

      try {
        const created = await focusAssistantApi.create({
          cycleId: cycleId || createFocusCycleId(),
          taskId:
            taskId ??
            (selectedTarget.type === "task" && selectedTarget.id ? selectedTarget.id : null),
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
    },
    [restMinutes, selectedTarget]
  );

  const pause = useCallback(async () => {
    if (!sessionRef.current) return;
    const cur = sessionRef.current;
    const totalPlannedSec =
      (cur.plannedMinutes || (sessionTypeRef.current === "rest" ? restMinutes : focusMinutes)) * 60;
    const activeSec = Math.max(0, totalPlannedSec - remainingRef.current);
    startedAt.current = null;
    targetEndTimeRef.current = null;
    setStatus("paused");
    statusRef.current = "paused";

    const text = getDialogue("focus_pause");
    speak(text);

    try {
      await focusAssistantApi.update(cur.id, { status: "paused", activeSeconds: activeSec });
      setSession({ ...cur, status: "paused", activeSeconds: activeSec });
    } catch (e) {
      console.error("Failed to pause session", e);
    }
  }, [restMinutes, focusMinutes, getDialogue, speak]);

  const resume = useCallback(async () => {
    if (!sessionRef.current) return;
    const cur = sessionRef.current;
    startedAt.current = Date.now();
    targetEndTimeRef.current = Date.now() + remainingRef.current * 1000;
    setStatus("running");
    statusRef.current = "running";

    const text = getDialogue("focus_resume");
    speak(text);

    try {
      await focusAssistantApi.update(cur.id, { status: "running" });
      setSession({ ...cur, status: "running" });
    } catch (e) {
      console.error("Failed to resume session", e);
    }
  }, [getDialogue, speak]);

  const stopFocusAndStartRest = useCallback(async () => {
    if (isCompletingRef.current) return;
    isCompletingRef.current = true;
    const cur = sessionRef.current;
    const activeSec = Math.max(0, focusMinutes * 60 - remainingRef.current);
    const cycleId = cur?.cycleId || createFocusCycleId();
    const taskId =
      cur?.taskId ??
      (selectedTarget.type === "task" && selectedTarget.id ? selectedTarget.id : null);

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
  }, [
    focusMinutes,
    restMinutes,
    selectedTarget,
    currentThemeStyle,
    currentPetType,
    notificationTitle,
    getDialogue,
    speak,
    refreshStats,
    startRest,
  ]);

  const completeFocusAndStartRest = useCallback(async () => {
    if (isCompletingRef.current) return;
    const cur = sessionRef.current;
    isCompletingRef.current = true;

    const cycleId = cur?.cycleId || createFocusCycleId();
    const taskId =
      cur?.taskId ??
      (selectedTarget.type === "task" && selectedTarget.id ? selectedTarget.id : null);

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
  }, [
    restMinutes,
    selectedTarget,
    currentThemeStyle,
    currentPetType,
    notificationTitle,
    getDialogue,
    speak,
    refreshStats,
    startRest,
  ]);

  const completeRest = useCallback(async () => {
    if (isCompletingRef.current) return;
    const cur = sessionRef.current;
    isCompletingRef.current = true;

    if (cur) {
      try {
        await focusAssistantApi.update(cur.id, {
          status: "completed",
          activeSeconds: (cur.plannedMinutes || restMinutes) * 60,
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
    statusRef.current = "ready";
    setSecondsLeft(focusMinutes * 60);
    remainingRef.current = focusMinutes * 60;
    startedAt.current = null;
    isCompletingRef.current = false;
    refreshStats();
  }, [
    restMinutes,
    focusMinutes,
    currentThemeStyle,
    currentPetType,
    notificationTitle,
    getDialogue,
    speak,
    refreshStats,
  ]);

  const skipRest = useCallback(async () => {
    isCompletingRef.current = false;
    const cur = sessionRef.current;
    if (cur) {
      const planned = cur.plannedMinutes || restMinutes;
      const activeSec = Math.max(0, planned * 60 - remainingRef.current);
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
    statusRef.current = "ready";
    setSecondsLeft(focusMinutes * 60);
    remainingRef.current = focusMinutes * 60;
    startedAt.current = null;
    refreshStats();
  }, [
    restMinutes,
    focusMinutes,
    currentThemeStyle,
    currentPetType,
    notificationTitle,
    getDialogue,
    speak,
    refreshStats,
  ]);

  const resetTimer = useCallback(() => {
    const resetSec = (sessionTypeRef.current === "rest" ? restMinutes : focusMinutes) * 60;
    setSecondsLeft(resetSec);
    remainingRef.current = resetSec;
    if (statusRef.current === "running") {
      targetEndTimeRef.current = Date.now() + resetSec * 1000;
    } else {
      targetEndTimeRef.current = null;
    }
  }, [restMinutes, focusMinutes]);

  const triggerPoke = useCallback(() => {
    setIsPetPoked(true);
    setTimeout(() => setIsPetPoked(false), 600);
    playPokeSound(currentThemeStyle === "pixel");
    const text = getDialogue("poke");
    speak(text);
  }, [currentThemeStyle, getDialogue, speak]);

  // Timer Tick with wall-clock calibration (resilient against sleep/throttling)
  useEffect(() => {
    if (status !== "running") return;

    if (targetEndTimeRef.current === null) {
      targetEndTimeRef.current = Date.now() + remainingRef.current * 1000;
    }

    const checkTime = () => {
      const now = Date.now();
      const target = targetEndTimeRef.current ?? (now + remainingRef.current * 1000);
      const diffSec = Math.max(0, Math.ceil((target - now) / 1000));
      remainingRef.current = diffSec;
      setSecondsLeft(diffSec);

      if (diffSec === 0) {
        targetEndTimeRef.current = null;
        if (sessionTypeRef.current === "focus") {
          void completeFocusAndStartRest();
        } else {
          void completeRest();
        }
      }
    };

    // Immediate check
    checkTime();

    const timer = window.setInterval(checkTime, 1000);
    const handleSync = () => {
      if (document.visibilityState === "visible") {
        checkTime();
      }
    };

    document.addEventListener("visibilitychange", handleSync);
    window.addEventListener("focus", checkTime);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleSync);
      window.removeEventListener("focus", checkTime);
    };
  }, [status, completeFocusAndStartRest, completeRest]);

  // Cleanup on unmount
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

  // Listen for global events
  useEffect(() => {
    let unlistenReminder: (() => void) | undefined;
    let unlistenSelectTask: (() => void) | undefined;
    let unlistenStartRest: (() => void) | undefined;
    let unlistenExtendFocus: (() => void) | undefined;
    let unlistenStartFocus: (() => void) | undefined;
    let unlistenExtendRest: (() => void) | undefined;
    let unlistenNotificationOptions: (() => void) | undefined;
    let glowTimer: number | null = null;
    let knockTimer: number | null = null;

    const setupListeners = async () => {
      try {
        unlistenNotificationOptions = await listen<NotificationDisplayOptions>(
          "workbuddy:notification-options-change",
          () => {
            // 实时感知通知配置变更
          }
        );

        unlistenReminder = await listen<{
          taskId: string;
          title: string;
          body?: string;
          dateText?: string;
        }>("workbuddy:task-reminder", (event) => {
          const { title } = event.payload;
          const { assistantBubble } = getNotificationDisplayOptions();

          if (assistantBubble) {
            setIsGlowActive(true);
            if (glowTimer) window.clearTimeout(glowTimer);
            glowTimer = window.setTimeout(() => {
              setIsGlowActive(false);
              glowTimer = null;
            }, 8000);

            setPetOverrideState("knocking");
            if (knockTimer) window.clearTimeout(knockTimer);
            knockTimer = window.setTimeout(() => {
              setPetOverrideState(null);
              knockTimer = null;
            }, 6000);

            const dialogueText = getDialogue("task_reminder", { targetName: title });
            speak(dialogueText, 7000);
          }
          // 音频由 taskReminderScheduler 单一所有权统一播报，避免多窗口双重重叠回音
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
          if (onSelectTarget) {
            onSelectTarget(target);
          }
          localStorage.setItem("workbuddy.focusAssistant.target", JSON.stringify(target));
          const text = getDialogue("focus_start", { targetName: target.name });
          speak(text, 4000);
        });

        unlistenStartRest = await listen<{ durationMinutes?: number }>(
          "workbuddy:start-rest-action",
          (event) => {
            const mins = event.payload?.durationMinutes || restMinutes;
            void startRest(undefined, undefined, mins);
          }
        );

        unlistenExtendFocus = await listen<{ durationMinutes?: number }>(
          "workbuddy:extend-focus-action",
          (event) => {
            const mins = event.payload?.durationMinutes || 15;
            void startFocus(mins);
          }
        );

        unlistenStartFocus = await listen("workbuddy:start-focus-action", () => {
          void startFocus();
        });

        unlistenExtendRest = await listen<{ durationMinutes?: number }>(
          "workbuddy:extend-rest-action",
          (event) => {
            const mins = event.payload?.durationMinutes || 3;
            if (sessionTypeRef.current === "rest" && statusRef.current === "running") {
              const extraSec = mins * 60;
              remainingRef.current += extraSec;
              setSecondsLeft((prev) => prev + extraSec);
              const cur = sessionRef.current;
              if (cur) {
                const newPlanned = (cur.plannedMinutes || restMinutes) + mins;
                setSession((prev) => (prev ? { ...prev, plannedMinutes: newPlanned } : null));
              }
              const text =
                currentSpecies === "dog"
                  ? `汪！再多休息 ${mins} 分钟，好好放松一下吧 ☕`
                  : `喵！再多休息 ${mins} 分钟，好好放松一下吧 ☕`;
              speak(text);
            } else {
              void startRest(undefined, undefined, mins);
              const text =
                currentSpecies === "dog"
                  ? `汪！再多眯 ${mins} 分钟，好好充电哦 ☕`
                  : `喵！再多眯 ${mins} 分钟，好好充电哦 ☕`;
              speak(text);
            }
          }
        );
      } catch {
        // Browser fallback
      }
    };

    void setupListeners();

    return () => {
      if (unlistenReminder) unlistenReminder();
      if (unlistenSelectTask) unlistenSelectTask();
      if (unlistenStartRest) unlistenStartRest();
      if (unlistenExtendFocus) unlistenExtendFocus();
      if (unlistenStartFocus) unlistenStartFocus();
      if (unlistenExtendRest) unlistenExtendRest();
      if (unlistenNotificationOptions) unlistenNotificationOptions();
      if (glowTimer) window.clearTimeout(glowTimer);
      if (knockTimer) window.clearTimeout(knockTimer);
    };
  }, [
    currentSpecies,
    currentThemeStyle,
    restMinutes,
    focusMinutes,
    getDialogue,
    speak,
    onSelectTarget,
    startFocus,
    startRest,
  ]);

  // Compute PetState
  const petState: PetState = useMemo(() => {
    if (petOverrideState) return petOverrideState;
    if (sessionType === "rest") {
      return status === "running" ? "resting" : "paused";
    }
    if (status === "running") return "working";
    if (status === "paused") return "paused";
    return "ready";
  }, [petOverrideState, sessionType, status]);

  return {
    status,
    sessionType,
    secondsLeft,
    session,
    stats,
    bubbleText,
    dismissBubble,
    isGlowActive,
    petState,
    isPetPoked,
    startFocus,
    startRest,
    pause,
    resume,
    stopFocusAndStartRest,
    skipRest,
    resetTimer,
    refreshStats,
    triggerPoke,
    speak,
    getDialogue,
    currentSpecies,
    currentPetType,
    currentThemeStyle,
  };
}
