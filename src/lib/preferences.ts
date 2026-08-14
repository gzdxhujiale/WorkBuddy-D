const OPEN_FOCUS_ASSISTANT_ON_START_KEY = "workbuddy.openFocusAssistantOnStart";
const LEGACY_OPEN_FOCUS_ASSISTANT_ON_START_KEY = "fishbuddy.openFocusAssistantOnStart";

export function shouldOpenFocusAssistantOnStart(): boolean {
  return (localStorage.getItem(OPEN_FOCUS_ASSISTANT_ON_START_KEY) ?? localStorage.getItem(LEGACY_OPEN_FOCUS_ASSISTANT_ON_START_KEY)) === "true";
}

export function setOpenFocusAssistantOnStart(enabled: boolean): void {
  localStorage.setItem(OPEN_FOCUS_ASSISTANT_ON_START_KEY, String(enabled));
}
