import { create } from "zustand";

interface TodayHighlightState {
  hoveredTaskId: string | null;
  hoveredStageId: string | null;
  setHoveredTask: (taskId: string | null) => void;
  setHoveredStage: (stageId: string | null) => void;
}

export const useTodayHighlightStore = create<TodayHighlightState>((set) => ({
  hoveredTaskId: null,
  hoveredStageId: null,
  setHoveredTask: (hoveredTaskId) =>
    set((state) => (state.hoveredTaskId === hoveredTaskId ? state : { hoveredTaskId })),
  setHoveredStage: (hoveredStageId) =>
    set((state) => (state.hoveredStageId === hoveredStageId ? state : { hoveredStageId })),
}));
