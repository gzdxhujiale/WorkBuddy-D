import { WebviewWindow, getAllWebviewWindows } from "@tauri-apps/api/webviewWindow";
import { emit } from "@tauri-apps/api/event";

export function isTauriEnv(): boolean {
  return typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
}

export async function getActiveStandaloneNoteIds(): Promise<string[]> {
  if (!isTauriEnv()) return [];
  try {
    const windows = await getAllWebviewWindows();
    const ids: string[] = [];
    for (const win of windows) {
      if (win.label.startsWith("note-window-")) {
        ids.push(win.label.replace("note-window-", ""));
      }
    }
    return ids;
  } catch {
    return [];
  }
}

export async function focusStandaloneNoteWindow(noteId: string): Promise<boolean> {
  if (!isTauriEnv()) return false;
  try {
    const existing = await WebviewWindow.getByLabel(`note-window-${noteId}`);
    if (existing) {
      await existing.show();
      await existing.unminimize();
      await existing.setFocus();
      return true;
    }
  } catch {
    // Ignore
  }
  return false;
}

export async function closeStandaloneNoteWindow(noteId: string): Promise<boolean> {
  if (!isTauriEnv()) return false;
  try {
    const existing = await WebviewWindow.getByLabel(`note-window-${noteId}`);
    if (existing) {
      await existing.close();
      return true;
    }
  } catch {
    // Ignore
  }
  return false;
}

export async function openStandaloneNoteWindow(noteId: string, title?: string): Promise<void> {
  const windowLabel = `note-window-${noteId}`;
  const url = `note-window.html?noteId=${encodeURIComponent(noteId)}`;

  if (isTauriEnv()) {
    try {
      const existing = await WebviewWindow.getByLabel(windowLabel);
      if (existing) {
        await existing.show();
        await existing.unminimize();
        await existing.setFocus();
        void emit("knowledge:note-window-state", { id: noteId, isOpen: true });
        return;
      }

      const webview = new WebviewWindow(windowLabel, {
        url,
        title: title ? `WorkBuddy - ${title}` : "WorkBuddy 笔记",
        width: 960,
        height: 720,
        minWidth: 480,
        minHeight: 360,
        decorations: false,
        transparent: false,
        center: true,
        focus: true,
      });

      webview.once("tauri://error", (err) => {
        console.error("Failed to create note window:", err);
      });

      void emit("knowledge:note-window-state", { id: noteId, isOpen: true });
    } catch (err) {
      console.error("Failed to open standalone note window in Tauri:", err);
      // Fallback
      window.open(url, "_blank", "width=960,height=720");
    }
  } else {
    window.open(url, "_blank", "width=960,height=720");
  }
}
