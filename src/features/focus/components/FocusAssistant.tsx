import { useEffect, useState } from "react";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { isSoundEnabled, setSoundEnabled } from "@/lib/soundFeedback";
import { useAuth } from "@/features/auth";
import { cn } from "@/lib/utils";
import { useFocusTimer } from "../hooks/useFocusTimer";
import { useWindowDrag } from "../hooks/useWindowDrag";
import { FocusTimerControls } from "./assistant/FocusTimerControls";
import { FocusPurePetView } from "./assistant/FocusPurePetView";
import { FocusTargetModal } from "./assistant/FocusTargetModal";
import { FocusTimeModal } from "./assistant/FocusTimeModal";
import { FocusStyleMenu } from "./assistant/FocusStyleMenu";
import {
  clamp,
  getAssistantWindowSize,
  getThemeClasses,
  setWindowGeometry,
  ActiveModal,
  FocusTargetData,
  SelectedTarget,
  StyleTheme,
} from "./assistant/types";

export interface FocusAssistantProps {
  targetData?: FocusTargetData;
}

export function FocusAssistant({ targetData }: FocusAssistantProps = {}) {
  const { userId } = useAuth();
  const tasks = targetData?.tasks ?? [];
  const habits = targetData?.habits ?? [];
  const projects = targetData?.projects ?? [];
  const stages = targetData?.stages ?? [];
  const projectTasks = targetData?.projectTasks ?? [];
  const isDataRefreshing = targetData?.isDataRefreshing ?? false;

  const handleRefreshData = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (targetData?.onRefreshData) await targetData.onRefreshData();
  };

  const [focusMinutes, setFocusMinutes] = useState<number>(() =>
    clamp(Number(localStorage.getItem("workbuddy.focusAssistant.minutes")) || 25)
  );
  const [restMinutes, setRestMinutes] = useState<number>(() =>
    clamp(Number(localStorage.getItem("workbuddy.focusAssistant.restMinutes")) || 5, 1, 60)
  );

  const [selectedTarget, setSelectedTarget] = useState<SelectedTarget>(() => {
    const s = localStorage.getItem("workbuddy.focusAssistant.target");
    if (s) {
      try {
        return JSON.parse(s);
      } catch {
        /* fallback */
      }
    }
    return { type: "none", id: "", name: "专注" };
  });

  const [theme, setTheme] = useState<StyleTheme>(() => {
    const s = localStorage.getItem("workbuddy.focusAssistant.theme") as StyleTheme;
    const all = ["pixel", "pixel-pure", "pixel-dog", "pixel-dog-pure", "vector", "vector-pure", "classic"];
    return all.includes(s) ? s : "classic";
  });

  const [isPinned, setIsPinned] = useState<boolean>(
    () => localStorage.getItem("workbuddy.focusAssistant.pinned") !== "false"
  );
  const [showStats, setShowStats] = useState<boolean>(
    () => localStorage.getItem("workbuddy.focusAssistant.showStats") === "true"
  );

  const [activeModal, setActiveModal] = useState<ActiveModal>("none");
  const [soundOn, setSoundOn] = useState<boolean>(isSoundEnabled);

  // 自动校验并清理已在主窗口完成或删除的幽灵任务目标
  useEffect(() => {
    if (selectedTarget.type === "task" && tasks.length > 0) {
      const exists = tasks.some((t) => t.id === selectedTarget.id);
      if (!exists) {
        const fallbackTarget: SelectedTarget = { type: "none", id: "", name: "专注" };
        setSelectedTarget(fallbackTarget);
        localStorage.setItem("workbuddy.focusAssistant.target", JSON.stringify(fallbackTarget));
      }
    }
  }, [tasks, selectedTarget]);

  const isPurePet =
    theme === "pixel-pure" || theme === "pixel-dog-pure" || theme === "vector-pure";

  const {
    isDragging,
    dragDirection,
    handleDragPointerDown,
    handleDragPointerMove,
    handleDragPointerUp,
    hasMovedRecently,
  } = useWindowDrag();

  const {
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
    pause,
    resume,
    stopFocusAndStartRest,
    skipRest,
    resetTimer,
    triggerPoke,
  } = useFocusTimer({
    userId,
    focusMinutes,
    restMinutes,
    selectedTarget,
    onSelectTarget: setSelectedTarget,
    theme,
  });

  useEffect(() => {
    const { width, height } = getAssistantWindowSize(activeModal, showStats, isPurePet);
    void setWindowGeometry(width, height);
  }, [activeModal, showStats, isPurePet, theme]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const setup = async () => {
      try {
        const win = getCurrentWindow();
        await win.setAlwaysOnTop(isPinned);
        unlisten = await win.onScaleChanged(async () => {
          const { width, height } = getAssistantWindowSize(activeModal, showStats, isPurePet);
          await win.setSize(new LogicalSize(width, height)).catch(() => undefined);
        });
      } catch {
        /* fallback */
      }
    };
    void setup();
    return () => {
      if (unlisten) unlisten();
    };
  }, [isPinned, activeModal, showStats, isPurePet]);

  const handlePokePet = () => {
    if (hasMovedRecently()) return;
    triggerPoke();
  };

  const handleSetTheme = (newTheme: StyleTheme) => {
    setTheme(newTheme);
    localStorage.setItem("workbuddy.focusAssistant.theme", newTheme);
    setActiveModal("none");
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

  const closeModal = () => setActiveModal("none");

  if (activeModal === "task-selector") {
    return (
      <FocusTargetModal
        theme={theme}
        selectedTarget={selectedTarget}
        projects={projects}
        stages={stages}
        projectTasks={projectTasks}
        tasks={tasks}
        habits={habits}
        isDataRefreshing={isDataRefreshing}
        getThemeClasses={() => getThemeClasses(theme)}
        onRefreshData={handleRefreshData}
        onSelectTarget={(t) => {
          setSelectedTarget(t);
          localStorage.setItem("workbuddy.focusAssistant.target", JSON.stringify(t));
          closeModal();
        }}
        onClose={closeModal}
      />
    );
  }

  if (activeModal === "time-editor") {
    return (
      <FocusTimeModal
        focusMinutes={focusMinutes}
        restMinutes={restMinutes}
        getThemeClasses={() => getThemeClasses(theme)}
        onSave={(f, r) => {
          setFocusMinutes(f);
          setRestMinutes(r);
          localStorage.setItem("workbuddy.focusAssistant.minutes", String(f));
          localStorage.setItem("workbuddy.focusAssistant.restMinutes", String(r));
          resetTimer();
          closeModal();
        }}
        onClose={closeModal}
      />
    );
  }

  if (activeModal === "menu" || activeModal === "style-menu") {
    return (
      <FocusStyleMenu
        activeModal={activeModal}
        theme={theme}
        focusMinutes={focusMinutes}
        restMinutes={restMinutes}
        isPinned={isPinned}
        soundOn={soundOn}
        showStats={showStats}
        isPurePet={isPurePet}
        getThemeClasses={() => getThemeClasses(theme)}
        onOpenTimeEditor={() => setActiveModal("time-editor")}
        onOpenStyleMenu={() => setActiveModal("style-menu")}
        onTogglePin={handleTogglePin}
        onToggleSound={() => {
          const next = !soundOn;
          setSoundOn(next);
          setSoundEnabled(next);
        }}
        onToggleStats={handleToggleStats}
        onResetTimer={() => {
          resetTimer();
          closeModal();
        }}
        onSetTheme={handleSetTheme}
        onClose={closeModal}
      />
    );
  }

  const commonProps = {
    theme,
    status,
    sessionType,
    secondsLeft,
    selectedTarget,
    bubbleText,
    petState,
    isDragging,
    dragDirection,
    isGlowActive,
    isPetPoked,
    onPokePet: handlePokePet,
    onDismissBubble: dismissBubble,
    onOpenMenu: () => setActiveModal("menu"),
    onOpenTimeEditor: () => setActiveModal("time-editor"),
    onOpenTaskSelector: () => setActiveModal("task-selector"),
    onStartFocus: () => void startFocus(),
    onPause: () => void pause(),
    onResume: () => void resume(),
    onStopFocusAndStartRest: () => void stopFocusAndStartRest(),
    onSkipRest: () => void skipRest(),
  };

  return (
    <div
      className={cn(
        "select-none flex items-center justify-center cursor-grab active:cursor-grabbing",
        isPurePet ? "w-full h-full" : "relative w-full h-full overflow-visible outline-none"
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
      {isPurePet ? (
        <FocusPurePetView {...commonProps} />
      ) : (
        <FocusTimerControls
          {...commonProps}
          plannedMinutes={
            session?.plannedMinutes || (sessionType === "rest" ? restMinutes : focusMinutes)
          }
          stats={stats}
          showStats={showStats}
          onToggleStats={handleToggleStats}
          onCloseWindow={() => void getCurrentWindow().hide().catch(() => undefined)}
        />
      )}
    </div>
  );
}

