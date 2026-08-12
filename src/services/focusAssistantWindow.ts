import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { isTauriEnv } from "@/services/quickEditWindow";

const LABEL = "focus-assistant";

export async function showFocusAssistant(): Promise<void> {
  if (!isTauriEnv()) return;
  const existing = await WebviewWindow.getByLabel(LABEL).catch(() => null);
  if (existing) {
    await existing.show();
    await existing.setFocus();
    return;
  }
  new WebviewWindow(LABEL, {
    url: `${window.location.origin}/focus-assistant.html`, title: "专注助手", width: 340, height: 400,
    resizable: false, decorations: false, transparent: true, shadow: true, alwaysOnTop: true,
    skipTaskbar: true, visible: true,
  });
}

export async function toggleFocusAssistant(): Promise<void> {
  if (!isTauriEnv()) return;
  const existing = await WebviewWindow.getByLabel(LABEL).catch(() => null);
  if (!existing || !(await existing.isVisible())) return showFocusAssistant();
  await existing.hide();
}
