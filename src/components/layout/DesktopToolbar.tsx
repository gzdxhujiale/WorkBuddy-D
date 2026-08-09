import React from "react";
import { Link } from "@tanstack/react-router";
import {
  CalendarCheck,
  LayoutGrid,
  Sparkles,
  BookCheck,
  Library,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavigationTool {
  id: string;
  name: string;
  to: string;
  icon: LucideIcon;
}

export const NAV_TOOLS: NavigationTool[] = [
  { id: "today", name: "当日待办", to: "/today", icon: CalendarCheck },
  { id: "four-quadrants", name: "四象限工作台", to: "/four-quadrants", icon: LayoutGrid },
  { id: "habit", name: "习惯追踪", to: "/habit", icon: Sparkles },
  { id: "lists", name: "知识库", to: "/lists", icon: Library },
  { id: "daily-review", name: "每日复盘", to: "/daily-review", icon: BookCheck },
];

export interface DesktopToolbarProps {
  onSettingsClick?: () => void;
}

export const DesktopToolbar: React.FC<DesktopToolbarProps> = ({ onSettingsClick }) => {
  return (
    <aside className="w-[58px] h-full bg-[#f5f5f5] dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col items-center py-3 px-1 flex-shrink-0 select-none">
      <nav className="flex flex-col gap-1.5 w-full items-center" aria-label="Main Navigation">
        {NAV_TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.id}
              to={tool.to}
              title={tool.name}
              aria-label={tool.name}
              className="relative group flex items-center justify-center w-10 h-[38px] rounded-lg transition-all duration-150 text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/70"
              activeProps={{
                className:
                  "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/80 dark:border-slate-700 font-semibold hover:bg-white dark:hover:bg-slate-800",
              }}
            >
              <Icon size={19} strokeWidth={1.9} />

              {/* Hover Tooltip */}
              <span className="pointer-events-none absolute left-14 z-50 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1 text-xs text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100 dark:bg-slate-100 dark:text-slate-900">
                {tool.name}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-2 w-full flex justify-center">
        <button
          type="button"
          onClick={onSettingsClick}
          className="relative group flex items-center justify-center w-10 h-[38px] rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/70 transition-all duration-150 cursor-pointer"
          title="设置"
          aria-label="设置"
        >
          <Settings size={18} strokeWidth={1.9} />
          <span className="pointer-events-none absolute left-14 z-50 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1 text-xs text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100 dark:bg-slate-100 dark:text-slate-900">
            设置
          </span>
        </button>
      </div>
    </aside>
  );
};
