import React from "react";
import ReactDOM from "react-dom/client";
import { FocusAssistantWindow } from "@/app/windows/FocusAssistantWindow";
import { applyAppThemeStyle } from "@/lib/preferences";
import "./index.css";

document.documentElement.classList.add("focus-assistant-window");
applyAppThemeStyle();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <FocusAssistantWindow />
  </React.StrictMode>
);
