import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { TaskQuickEditWindow } from "@/components/time-management/TaskQuickEdit";
import { WindowSessionGate } from "./windowSessionGate";
import "./index.css";

document.documentElement.classList.add("tqe-window");
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode><QueryClientProvider client={queryClient}><WindowSessionGate><TaskQuickEditWindow /></WindowSessionGate></QueryClientProvider></React.StrictMode>
);
