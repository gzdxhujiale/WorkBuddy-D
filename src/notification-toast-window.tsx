import React from "react";
import ReactDOM from "react-dom/client";
import { NotificationToast } from "@/components/focus/NotificationToast";
import { applyAppThemeStyle } from "@/lib/preferences";
import "./index.css";

applyAppThemeStyle();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <NotificationToast />
  </React.StrictMode>
);
