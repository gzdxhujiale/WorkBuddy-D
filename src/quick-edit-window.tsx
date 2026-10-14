import React from "react";
import ReactDOM from "react-dom/client";
import { QuickEditWindow } from "@/app/windows/QuickEditWindow";
import { applyAppThemeStyle } from "@/lib/preferences";
import "./index.css";

document.documentElement.classList.add("tqe-window");
applyAppThemeStyle();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QuickEditWindow />
  </React.StrictMode>
);
