import { create } from "zustand";

interface UiState {
  userId: string | null;
  activeListId: string | null;
  isSidebarCollapsed: boolean;
  isTemplateModalOpen: boolean;
  activeNoteId: string | null;
  isDrawerOpen: boolean;
  hoveredStageId: string | null;
  activeProjectId: string | null;
  setUserId: (userId: string | null) => void;
  setActiveListId: (id: string | null) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTemplateModalOpen: (open: boolean) => void;
  setActiveNoteId: (id: string | null) => void;
  setDrawerOpen: (open: boolean) => void;
  setHoveredStageId: (id: string | null) => void;
  setActiveProjectId: (id: string | null) => void;
  hydrateForUser: (userId: string) => void;
}

const initialState = {
  userId: null,
  activeListId: null,
  isSidebarCollapsed: false,
  isTemplateModalOpen: false,
  activeNoteId: null,
  isDrawerOpen: false,
  hoveredStageId: null,
  activeProjectId: null,
};

export const useUiStore = create<UiState>((set) => ({
  ...initialState,
  setUserId: (userId) => set((state) => state.userId === userId ? state : { ...initialState, userId }),
  setActiveListId: (activeListId) => set({ activeListId }),
  setSidebarCollapsed: (isSidebarCollapsed) => set({ isSidebarCollapsed }),
  setTemplateModalOpen: (isTemplateModalOpen) => set({ isTemplateModalOpen }),
  setActiveNoteId: (activeNoteId) => set({ activeNoteId }),
  setDrawerOpen: (isDrawerOpen) => set({ isDrawerOpen }),
  setHoveredStageId: (hoveredStageId) => set({ hoveredStageId }),
  setActiveProjectId: (activeProjectId) => set({ activeProjectId }),
  hydrateForUser: (userId) => {
    try {
      const key = `workbuddy:ui:${userId}`;
      const legacyKey = `fishbuddy:ui:${userId}`;
      const raw = localStorage.getItem(key) ?? localStorage.getItem(legacyKey);
      const saved = raw ? (JSON.parse(raw) as Partial<UiState>) : {};
      set({
        ...initialState,
        userId,
        activeListId: saved.activeListId ?? null,
        isSidebarCollapsed: saved.isSidebarCollapsed ?? false,
      });
    } catch {
      set({ ...initialState, userId });
    }
  },
}));

useUiStore.subscribe((state, previous) => {
  if (!state.userId || state.userId !== previous.userId) return;
  localStorage.setItem(`workbuddy:ui:${state.userId}`, JSON.stringify({
    activeListId: state.activeListId,
    isSidebarCollapsed: state.isSidebarCollapsed,
  }));
});
