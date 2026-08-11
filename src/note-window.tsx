import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { StandaloneNoteWindow } from "@/components/lists/StandaloneNoteWindow";
import { WindowSessionGate } from "./windowSessionGate";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode><QueryClientProvider client={queryClient}><WindowSessionGate><StandaloneNoteWindow /></WindowSessionGate></QueryClientProvider></React.StrictMode>
);
