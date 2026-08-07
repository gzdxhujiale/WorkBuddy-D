import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useEffect, useState } from "react";
import { TaskQuickEditWindow } from "@/components/time-management/TaskQuickEdit";
import { StandaloneNoteWindow } from "@/components/lists/StandaloneNoteWindow";
import { prewarmQuickEditWindow } from "@/services/quickEditWindow";
import { supabase } from "@/lib/supabase";
import App from "./App";
import "./index.css";

const isQuickEditWindow =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("window") === "task-quick-edit";

const isNoteWindow =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("window") === "note";

if (isQuickEditWindow) {
  document.documentElement.classList.add("tqe-window");
} else if (!isNoteWindow) {
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(() => {
      prewarmQuickEditWindow();
    });
  }
}

/** Wraps StandaloneNoteWindow with Supabase session initialization */
function AuthStandaloneNoteWindow() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex items-center gap-3 text-muted-foreground text-sm">
          <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span>正在连接...</span>
        </div>
      </div>
    );
  }

  return <StandaloneNoteWindow />;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      {isQuickEditWindow ? <TaskQuickEditWindow /> : isNoteWindow ? <AuthStandaloneNoteWindow /> : <App />}
    </QueryClientProvider>
  </React.StrictMode>
);
