import { create } from "zustand";

interface UiState {
  userId: string | null;
  activeListId: string | null;
  isSidebarCollapsed: boolean;
  setUserId: (userId: string | null) => void;
  setActiveListId: (id: string | null) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  hydrateForUser: (userId: string) => void;
}

const initialState = {
  userId: null,
  activeListId: null,
  isSidebarCollapsed: false,
};

export const useUiStore = create<UiState>((set) => ({
  ...initialState,
  setUserId: (userId) => set((state) => state.userId === userId ? state : { ...initialState, userId }),
  setActiveListId: (activeListId) => set({ activeListId }),
  setSidebarCollapsed: (isSidebarCollapsed) => set({ isSidebarCollapsed }),
  hydrateForUser: (userId) => {
    try {
      const key = `workbuddy:ui:${userId}`;
      const raw = localStorage.getItem(key);
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
