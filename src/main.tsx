import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { prewarmQuickEditWindow } from "@/services/quickEditWindow";
import App from "./App";
import "./index.css";

if (typeof requestIdleCallback !== "undefined") {
  requestIdleCallback(() => {
    prewarmQuickEditWindow();
  });
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
