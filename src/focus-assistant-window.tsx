import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { FocusAssistant } from "@/components/focus/FocusAssistant";
import { queryClient } from "@/lib/queryClient";
import { WindowSessionGate } from "@/windowSessionGate";
import { applyAppThemeStyle } from "@/lib/preferences";
import "./index.css";

document.documentElement.classList.add("tqe-window");
applyAppThemeStyle();
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<React.StrictMode><QueryClientProvider client={queryClient}><WindowSessionGate><FocusAssistant /></WindowSessionGate></QueryClientProvider></React.StrictMode>);
