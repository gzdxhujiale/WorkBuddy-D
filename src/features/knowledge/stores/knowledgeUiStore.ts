import { create } from "zustand";

export type NoteViewMode = "drawer" | "full";
export type NoteDefaultOpenMode = "drawer" | "full" | "window";

interface KnowledgeUiState {
  activeNoteId: string | null;
  isDrawerOpen: boolean;
  isTemplateModalOpen: boolean;
  viewMode: NoteViewMode;
  defaultOpenMode: NoteDefaultOpenMode;
  autoFocusEditor: boolean;
  standaloneNoteIds: string[];
  setActiveNoteId: (id: string | null) => void;
  setDrawerOpen: (open: boolean) => void;
  setTemplateModalOpen: (open: boolean) => void;
  setViewMode: (mode: NoteViewMode) => void;
  setDefaultOpenMode: (mode: NoteDefaultOpenMode) => void;
  setAutoFocusEditor: (autoFocus: boolean) => void;
  addStandaloneNoteId: (id: string) => void;
  removeStandaloneNoteId: (id: string) => void;
  setStandaloneNoteIds: (ids: string[]) => void;
}

const DEFAULT_OPEN_MODE_KEY = "workbuddy_knowledge_default_open_mode";

function getInitialDefaultOpenMode(): NoteDefaultOpenMode {
  if (typeof window === "undefined") return "drawer";
  const saved = localStorage.getItem(DEFAULT_OPEN_MODE_KEY);
  if (saved === "full" || saved === "window" || saved === "drawer") {
    return saved;
  }
  return "drawer";
}

export const useKnowledgeUiStore = create<KnowledgeUiState>((set) => ({
  activeNoteId: null,
  isDrawerOpen: false,
  isTemplateModalOpen: false,
  viewMode: "drawer",
  defaultOpenMode: getInitialDefaultOpenMode(),
  autoFocusEditor: false,
  standaloneNoteIds: [],
  setActiveNoteId: (activeNoteId) => set({ activeNoteId }),
  setDrawerOpen: (isDrawerOpen) => set({ isDrawerOpen }),
  setTemplateModalOpen: (isTemplateModalOpen) => set({ isTemplateModalOpen }),
  setViewMode: (viewMode) => set({ viewMode }),
  setDefaultOpenMode: (defaultOpenMode) => {
    try {
      localStorage.setItem(DEFAULT_OPEN_MODE_KEY, defaultOpenMode);
    } catch {
      // Ignore storage errors
    }
    set({ defaultOpenMode });
  },
  setAutoFocusEditor: (autoFocusEditor) => set({ autoFocusEditor }),
  addStandaloneNoteId: (id) =>
    set((state) => ({
      standaloneNoteIds: state.standaloneNoteIds.includes(id)
        ? state.standaloneNoteIds
        : [...state.standaloneNoteIds, id],
    })),
  removeStandaloneNoteId: (id) =>
    set((state) => ({
      standaloneNoteIds: state.standaloneNoteIds.filter((item) => item !== id),
    })),
  setStandaloneNoteIds: (standaloneNoteIds) => set({ standaloneNoteIds }),
}));
