import React, { useState, useEffect, useRef } from "react";
import { MoreHorizontal, LayoutGrid, Filter } from "lucide-react";
import { useTimeManagementData, useTaskActions } from "@/hooks/useTimeManagement";
import { Task, QuadrantType } from "@/types/timeManagement";
import { DailyQuadrants } from "./DailyQuadrants";
import {
  openQuickEditWindow,
  prewarmQuickEditWindow,
} from "@/services/quickEditWindow";
import { startTaskReminderScheduler } from "@/services/taskReminderScheduler";

export const TimeManagementPanel: React.FC = () => {
  const [hideCompleted, setHideCompleted] = useState<boolean>(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("ALL");
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  const { data: tmData } = useTimeManagementData();
  const roles = tmData?.roles ?? [];
  const tasks = tmData?.tasks ?? [];

  const { addTask, updateTask, deleteTask } = useTaskActions();

  const tasksRef = useRef(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // Prewarm Tauri sub-window pool and start task reminder scheduler on mount
  useEffect(() => {
    prewarmQuickEditWindow();
    const cleanup = startTaskReminderScheduler(() => tasksRef.current);
    return cleanup;
  }, []);

  const handleOpenTaskEditor = (
    task?: Task,
    quadrant: QuadrantType = "Q2",
    anchorEl?: HTMLElement
  ) => {
    const targetEl = anchorEl || document.body;
    void openQuickEditWindow({
      task,
      quadrant,
      anchorEl: targetEl,
      onSave: (taskId, updates) => {
        updateTask(taskId, updates);
      },
      onCreate: (targetQ, draft) => {
        const newTask = addTask(draft.title, targetQ, draft.scheduledDate, draft.roleId);
        if (draft.description || draft.deadline || draft.reminder) {
          updateTask(newTask.id, {
            description: draft.description,
            deadline: draft.deadline,
            reminder: draft.reminder,
          });
        }
      },
      onClosed: () => {},
    });
  };

  const handleToggleComplete = (taskId: string) => {
    const t = tasks.find((item) => item.id === taskId);
    if (!t) return;
    const nextCompleted = !t.completed;
    updateTask(taskId, {
      completed: nextCompleted,
      completedAt: nextCompleted ? Date.now() : undefined,
    });
  };

  const filteredTasks = tasks.filter((t) => {
    if (selectedRoleId !== "ALL" && t.roleId !== selectedRoleId) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full w-full bg-slate-50/70 dark:bg-slate-950/80 overflow-hidden backdrop-blur-xs select-none">
      {/* Panel Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <LayoutGrid className="text-blue-600 dark:text-blue-400" size={20} />
            四象限工作台
          </h1>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-3">
          {/* Role Filter Selector */}
          {roles.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <Filter size={14} />
              <select
                value={selectedRoleId}
                onChange={(e) => setSelectedRoleId(e.target.value)}
                className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 focus:outline-none cursor-pointer"
              >
                <option value="ALL">全部使命角色</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* More Options Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
            >
              <MoreHorizontal size={18} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-2 z-50 animate-in fade-in duration-100">
                <label className="flex items-center gap-2 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hideCompleted}
                    onChange={(e) => setHideCompleted(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>隐藏已完成任务</span>
                </label>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content View */}
      <main className="flex-1 p-4 overflow-hidden flex flex-col">
        <DailyQuadrants
          tasks={filteredTasks}
          roles={roles}
          onToggleComplete={handleToggleComplete}
          onCreateTask={(quadrant, anchorEl) =>
            handleOpenTaskEditor(undefined, quadrant, anchorEl)
          }
          hideCompleted={hideCompleted}
          onDeleteTask={deleteTask}
          onEditTask={(task, anchorEl) =>
            handleOpenTaskEditor(task, task.quadrant, anchorEl)
          }
          onUpdateTask={updateTask}
        />
      </main>
    </div>
  );
};
