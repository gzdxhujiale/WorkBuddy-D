import { Extension } from "@tiptap/core";

export interface SnapshotExtensionOptions {
  onSaveSnapshot?: (name?: string) => void | boolean;
  onOpenHistory?: () => void | boolean;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    snapshot: {
      saveSnapshot: (name?: string) => ReturnType;
      openVersionHistory: () => ReturnType;
    };
  }
}

export const SnapshotExtension = Extension.create<SnapshotExtensionOptions>({
  name: "snapshot",

  addOptions() {
    return {
      onSaveSnapshot: undefined,
      onOpenHistory: undefined,
    };
  },

  addCommands() {
    return {
      saveSnapshot:
        (name?: string) =>
        ({ editor }) => {
          if (this.options.onSaveSnapshot) {
            const res = this.options.onSaveSnapshot(name);
            return res !== false;
          }
          if (typeof window !== "undefined" && editor?.view?.dom) {
            editor.view.dom.dispatchEvent(
              new CustomEvent("tiptap:save-snapshot", {
                bubbles: true,
                detail: { name },
              })
            );
          }
          return true;
        },

      openVersionHistory:
        () =>
        ({ editor }) => {
          if (this.options.onOpenHistory) {
            const res = this.options.onOpenHistory();
            return res !== false;
          }
          if (typeof window !== "undefined" && editor?.view?.dom) {
            editor.view.dom.dispatchEvent(
              new CustomEvent("tiptap:open-history", {
                bubbles: true,
              })
            );
          }
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-s": () => {
        return this.editor.commands.saveSnapshot();
      },
      "Mod-Shift-h": () => {
        return this.editor.commands.openVersionHistory();
      },
    };
  },
});
