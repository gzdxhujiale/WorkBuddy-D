import { create } from "zustand";

interface KnowledgeUiState {
  activeNoteId: string | null;
  isDrawerOpen: boolean;
  isTemplateModalOpen: boolean;
  setActiveNoteId: (id: string | null) => void;
  setDrawerOpen: (open: boolean) => void;
  setTemplateModalOpen: (open: boolean) => void;
}

export const useKnowledgeUiStore = create<KnowledgeUiState>((set) => ({
  activeNoteId: null,
  isDrawerOpen: false,
  isTemplateModalOpen: false,
  setActiveNoteId: (activeNoteId) => set({ activeNoteId }),
  setDrawerOpen: (isDrawerOpen) => set({ isDrawerOpen }),
  setTemplateModalOpen: (isTemplateModalOpen) => set({ isTemplateModalOpen }),
}));
