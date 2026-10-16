import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { WindowSessionGate } from "@/app/windows/WindowSessionGate";
import { NoteStandaloneEditor } from "@/features/knowledge/components/NoteStandaloneEditor";
import { applyAppThemeStyle } from "@/lib/preferences";
import "./index.css";

document.documentElement.classList.add("note-standalone-window");
applyAppThemeStyle();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <WindowSessionGate>
        <NoteStandaloneEditor />
      </WindowSessionGate>
    </QueryClientProvider>
  </React.StrictMode>
);
