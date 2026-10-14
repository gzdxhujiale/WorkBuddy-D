import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import type { Project, ProjectStage, ProjectTask } from "@/types/project";

export type Status = "ready" | "running" | "paused";
export type ActiveModal = "none" | "task-selector" | "time-editor" | "menu" | "style-menu";

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

export interface FocusTargetData {
  tasks?: Array<{ id: string; title: string; projectId?: string }>;
  habits?: Array<{ id: string; name: string }>;
  projects?: Project[];
  stages?: ProjectStage[];
  projectTasks?: ProjectTask[];
  onRefreshData?: () => Promise<void>;
  isDataRefreshing?: boolean;
}

export const clamp = (val: number, min = 1, max = 180) =>
  Math.max(min, Math.min(max, Number.isFinite(val) ? Math.floor(val) : min));

export function getAssistantWindowSize(
  activeModal: ActiveModal,
  showStats: boolean,
  isPurePet: boolean
): { width: number; height: number } {
  if (activeModal === "task-selector") {
    return { width: 210, height: 260 };
  }
  if (activeModal === "time-editor") {
    return { width: 210, height: 190 };
  }
  if (activeModal === "menu" || activeModal === "style-menu") {
    return { width: 210, height: 260 };
  }

  // Pure pet mode: compact 140 x 165
  if (isPurePet) {
    return { width: 140, height: 165 };
  }

  // Standard card mode sizing (with stats expanded: 150, normal: 85)
  if (showStats) {
    return { width: 190, height: 150 };
  }

  return { width: 190, height: 85 };
}

export async function setWindowGeometry(width: number, height: number) {
  try {
    const win = getCurrentWindow();
    await win.setSize(new LogicalSize(width, height));
  } catch {
    // Non-tauri fallback
  }
}

export const formatTime = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export const getThemeClasses = (theme: StyleTheme) => {
  switch (theme) {
    case "pixel":
    case "pixel-pure":
    case "pixel-dog":
    case "pixel-dog-pure":
      return "bg-amber-50 text-amber-950 border-2 border-amber-900 shadow-[2px_2px_0px_rgba(120,53,15,1)]";
    case "vector":
    case "vector-pure":
      return "bg-gradient-to-br from-orange-50/95 via-white/95 to-amber-50/95 text-slate-800 border border-orange-200/80 shadow-none";
    case "classic":
    default:
      return "bg-white text-slate-800 shadow-none";
  }
};

export const getTargetLabel = (selectedTarget: SelectedTarget) => {
  if (selectedTarget.type === "project") return `📁 ${selectedTarget.name}`;
  if (selectedTarget.type === "project-stage") return `📑 ${selectedTarget.name}`;
  if (selectedTarget.type === "project-task") return `📋 ${selectedTarget.name}`;
  if (selectedTarget.type === "task") return `📋 ${selectedTarget.name}`;
  if (selectedTarget.type === "habit") return `✨ ${selectedTarget.name}`;
  return selectedTarget.name || "专注";
};

