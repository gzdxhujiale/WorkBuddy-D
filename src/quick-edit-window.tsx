import React from "react";
import ReactDOM from "react-dom/client";
import { TaskQuickEditWindow } from "@/components/time-management/TaskQuickEdit";
import { applyAppThemeStyle } from "@/lib/preferences";
import "./index.css";

document.documentElement.classList.add("tqe-window");
applyAppThemeStyle();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode><TaskQuickEditWindow /></React.StrictMode>
);

