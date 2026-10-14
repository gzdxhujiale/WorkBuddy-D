import React from "react";
import ReactDOM from "react-dom/client";
import { NotificationToastWindow } from "@/app/windows/NotificationToastWindow";
import { applyAppThemeStyle } from "@/lib/preferences";
import "./index.css";

applyAppThemeStyle();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <NotificationToastWindow />
  </React.StrictMode>
);
