import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { TaskQuickEditWindow } from "@/components/time-management/TaskQuickEdit";
import { prewarmQuickEditWindow } from "@/services/quickEditWindow";
import App from "./App";
import "./index.css";

const isQuickEditWindow =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("window") === "task-quick-edit";

if (isQuickEditWindow) {
  document.documentElement.classList.add("tqe-window");
} else {
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(() => {
      prewarmQuickEditWindow();
    });
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      {isQuickEditWindow ? <TaskQuickEditWindow /> : <App />}
    </QueryClientProvider>
  </React.StrictMode>
);
