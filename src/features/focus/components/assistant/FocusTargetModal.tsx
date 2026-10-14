import React, { useState, useMemo } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  RotateCw,
  X,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project, ProjectStage, ProjectTask } from "@/types/project";
import type { SelectedTarget, StyleTheme } from "./types";

export interface FocusTargetModalProps {
  theme: StyleTheme;
  selectedTarget: SelectedTarget;
  projects: Project[];
  stages: ProjectStage[];
  projectTasks: ProjectTask[];
  tasks: Array<{ id: string; title: string; projectId?: string }>;
  habits: Array<{ id: string; name: string }>;
  isDataRefreshing: boolean;
  getThemeClasses: () => string;
  onRefreshData?: (e: React.MouseEvent) => void;
  onSelectTarget: (target: SelectedTarget) => void;
  onClose: () => void;
}

export const FocusTargetModal: React.FC<FocusTargetModalProps> = ({
  theme,
  selectedTarget,
  projects,
  stages,
  projectTasks,
  tasks,
  habits,
  isDataRefreshing,
  getThemeClasses,
  onRefreshData,
  onSelectTarget,
  onClose,
}) => {
  const [selectorTab, setSelectorTab] = useState<"project" | "task" | "habit">("project");
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({});

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => !t.projectId);
  }, [tasks]);

  const projectsTree = useMemo(() => {
    return projects.map((p) => {
      const pStages = stages
        .filter((s) => s.projectId === p.id)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const pTasks = projectTasks.filter((t) => t.projectId === p.id && !t.completed);
      return {
        project: p,
        stages: pStages,
        tasks: pTasks,
      };
    });
  }, [projects, stages, projectTasks]);

  const toggleProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedProjects((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleStage = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedStages((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSelect = (target: SelectedTarget) => {
    onSelectTarget(target);
    onClose();
  };

  return (
    <div
      className={cn(
        "w-[210px] h-[260px] p-2 flex flex-col rounded-2xl select-none overflow-hidden text-xs border-0 outline-none",
        getThemeClasses()
      )}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) void getCurrentWindow().startDragging();
      }}
    >
      {/* Header Segmented Pill Tabs */}
      <div className="flex items-center justify-between pb-1.5 shrink-0">
        <div
          className={cn(
            "flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-full mx-auto text-[11px]",
            theme.startsWith("pixel") && "bg-amber-100/90 border border-amber-900/40 rounded-xs font-mono"
          )}
        >
          <button
            onClick={() => setSelectorTab("project")}
            className={cn(
              "px-2.5 py-0.5 rounded-full transition-colors font-medium cursor-pointer",
              selectorTab === "project"
                ? theme.startsWith("pixel")
                  ? "bg-amber-900 text-amber-50 font-bold rounded-xs shadow-xs"
                  : "bg-blue-50 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400 font-semibold shadow-xs"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
            )}
          >
            项目
          </button>
          <button
            onClick={() => setSelectorTab("task")}
            className={cn(
              "px-2.5 py-0.5 rounded-full transition-colors font-medium cursor-pointer",
              selectorTab === "task"
                ? theme.startsWith("pixel")
                  ? "bg-amber-900 text-amber-50 font-bold rounded-xs shadow-xs"
                  : "bg-blue-50 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400 font-semibold shadow-xs"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
            )}
          >
            任务
          </button>
          <button
            onClick={() => setSelectorTab("habit")}
            className={cn(
              "px-2.5 py-0.5 rounded-full transition-colors font-medium cursor-pointer",
              selectorTab === "habit"
                ? theme.startsWith("pixel")
                  ? "bg-amber-900 text-amber-50 font-bold rounded-xs shadow-xs"
                  : "bg-blue-50 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400 font-semibold shadow-xs"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
            )}
          >
            习惯
          </button>
        </div>
        <div className="flex items-center gap-0.5 ml-1">
          <button
            onClick={onRefreshData}
            disabled={isDataRefreshing}
            className={cn(
              "text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 p-0.5 rounded cursor-pointer transition-colors",
              theme.startsWith("pixel") && "hover:text-amber-900",
              isDataRefreshing && "opacity-70 cursor-not-allowed"
            )}
            title="刷新同步项目任务与习惯"
          >
            <RotateCw
              size={12}
              className={cn(
                "transition-transform",
                isDataRefreshing && "animate-spin text-blue-500"
              )}
            />
          </button>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
            title="关闭"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto no-scrollbar space-y-0.5 pr-0.5 pt-0.5">
        {/* Universal Option: No association (pure focus) */}
        <div
          onClick={() => handleSelect({ type: "none", id: "", name: "专注" })}
          className={cn(
            "flex items-center gap-2 px-1.5 py-1.5 rounded-md cursor-pointer transition-colors text-xs hover:bg-slate-100 dark:hover:bg-slate-800",
            theme.startsWith("pixel") && "hover:bg-amber-100/80 rounded-xs",
            selectedTarget.type === "none" &&
              (theme.startsWith("pixel")
                ? "bg-amber-200/80 text-amber-950 font-bold"
                : "bg-blue-50/60 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-medium")
          )}
        >
          <div
            className={cn(
              "size-3 rounded-full border flex items-center justify-center shrink-0",
              selectedTarget.type === "none"
                ? theme.startsWith("pixel")
                  ? "border-amber-900 bg-amber-900 text-white"
                  : "border-blue-500 bg-blue-500 text-white"
                : "border-slate-300 dark:border-slate-600"
            )}
          >
            {selectedTarget.type === "none" && <div className="size-1 bg-white rounded-full" />}
          </div>
          <span className="truncate">纯专注 (无关联)</span>
        </div>

        {/* ======================================================== */}
        {/* Tab 1: Project Tree (Projects -> Stages -> Tasks)         */}
        {/* ======================================================== */}
        {selectorTab === "project" && (
          <>
            {projectsTree.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-[11px]">暂无项目</div>
            ) : (
              projectsTree.map(({ project: p, stages: pStages, tasks: pTasks }) => {
                const isProjectExpanded = Boolean(expandedProjects[p.id]);
                const isProjectSelected =
                  selectedTarget.type === "project" && selectedTarget.id === p.id;
                const unassignedTasks = pTasks.filter((t) => !t.projectStageId);
                const hasChildren = pStages.length > 0 || unassignedTasks.length > 0;

                return (
                  <div key={p.id} className="space-y-0.5">
                    {/* Project Row */}
                    <div
                      className={cn(
                        "group flex items-center justify-between px-1.5 py-1 rounded-md cursor-pointer transition-colors text-xs hover:bg-slate-100 dark:hover:bg-slate-800",
                        theme.startsWith("pixel") && "hover:bg-amber-100/80 rounded-xs",
                        isProjectSelected &&
                          (theme.startsWith("pixel")
                            ? "bg-amber-200/90 text-amber-950 font-bold"
                            : "bg-blue-50/70 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-medium")
                      )}
                    >
                      <div
                        className="flex items-center gap-1 min-w-0 flex-1"
                        onClick={() =>
                          handleSelect({
                            type: "project",
                            id: p.id,
                            name: p.name,
                            projectId: p.id,
                            projectName: p.name,
                          })
                        }
                      >
                        {hasChildren ? (
                          <button
                            type="button"
                            onClick={(e) => toggleProject(p.id, e)}
                            className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors shrink-0"
                          >
                            {isProjectExpanded ? (
                              <ChevronDown size={11} />
                            ) : (
                              <ChevronRight size={11} />
                            )}
                          </button>
                        ) : (
                          <span className="w-3 shrink-0" />
                        )}
                        <FolderKanban
                          size={12}
                          className={cn(
                            "shrink-0",
                            theme.startsWith("pixel") ? "text-amber-800" : "text-blue-500"
                          )}
                        />
                        <span className="truncate flex-1 font-medium text-[11px]">{p.name}</span>
                      </div>

                      {/* Project Select Radio */}
                      <div
                        onClick={() =>
                          handleSelect({
                            type: "project",
                            id: p.id,
                            name: p.name,
                            projectId: p.id,
                            projectName: p.name,
                          })
                        }
                        className={cn(
                          "size-3 rounded-full border flex items-center justify-center shrink-0 ml-1 cursor-pointer",
                          isProjectSelected
                            ? theme.startsWith("pixel")
                              ? "border-amber-900 bg-amber-900 text-white"
                              : "border-blue-500 bg-blue-500 text-white"
                            : "border-slate-300 dark:border-slate-600 hover:border-blue-400"
                        )}
                        title="关联整个项目"
                      >
                        {isProjectSelected && <div className="size-1 bg-white rounded-full" />}
                      </div>
                    </div>

                    {/* Expanded Stages & Tasks */}
                    {isProjectExpanded && (
                      <div className="pl-3.5 space-y-0.5 border-l border-slate-200/60 dark:border-slate-700/60 ml-2">
                        {/* Stages */}
                        {pStages.map((s) => {
                          const sTasks = pTasks.filter((t) => t.projectStageId === s.id);
                          const isStageExpanded = Boolean(expandedStages[s.id]);
                          const isStageSelected =
                            selectedTarget.type === "project-stage" && selectedTarget.id === s.id;

                          return (
                            <div key={s.id} className="space-y-0.5">
                              {/* Stage Row */}
                              <div
                                className={cn(
                                  "group flex items-center justify-between px-1.5 py-0.5 rounded-md cursor-pointer transition-colors text-xs hover:bg-slate-100 dark:hover:bg-slate-800",
                                  theme.startsWith("pixel") && "hover:bg-amber-100/80 rounded-xs",
                                  isStageSelected &&
                                    (theme.startsWith("pixel")
                                      ? "bg-amber-200/90 text-amber-950 font-bold"
                                      : "bg-blue-50/70 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-medium")
                                )}
                              >
                                <div
                                  className="flex items-center gap-1 min-w-0 flex-1"
                                  onClick={() =>
                                    handleSelect({
                                      type: "project-stage",
                                      id: s.id,
                                      name: s.name,
                                      projectId: p.id,
                                      projectName: p.name,
                                      stageId: s.id,
                                      stageName: s.name,
                                    })
                                  }
                                >
                                  {sTasks.length > 0 ? (
                                    <button
                                      type="button"
                                      onClick={(e) => toggleStage(s.id, e)}
                                      className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors shrink-0"
                                    >
                                      {isStageExpanded ? (
                                        <ChevronDown size={10} />
                                      ) : (
                                        <ChevronRight size={10} />
                                      )}
                                    </button>
                                  ) : (
                                    <span className="w-2.5 shrink-0" />
                                  )}
                                  <Layers
                                    size={11}
                                    className={cn(
                                      "shrink-0",
                                      theme.startsWith("pixel") ? "text-amber-700" : "text-purple-500"
                                    )}
                                  />
                                  <span className="truncate flex-1 text-[11px]">{s.name}</span>
                                </div>

                                <div
                                  onClick={() =>
                                    handleSelect({
                                      type: "project-stage",
                                      id: s.id,
                                      name: s.name,
                                      projectId: p.id,
                                      projectName: p.name,
                                      stageId: s.id,
                                      stageName: s.name,
                                    })
                                  }
                                  className={cn(
                                    "size-2.5 rounded-full border flex items-center justify-center shrink-0 ml-1 cursor-pointer",
                                    isStageSelected
                                      ? theme.startsWith("pixel")
                                        ? "border-amber-900 bg-amber-900 text-white"
                                        : "border-purple-500 bg-purple-500 text-white"
                                      : "border-slate-300 dark:border-slate-600 hover:border-purple-400"
                                  )}
                                  title="关联此阶段"
                                >
                                  {isStageSelected && (
                                    <div className="size-0.5 bg-white rounded-full" />
                                  )}
                                </div>
                              </div>

                              {/* Stage Tasks */}
                              {isStageExpanded && sTasks.length > 0 && (
                                <div className="pl-3 space-y-0.5 border-l border-slate-200/50 dark:border-slate-700/50 ml-1.5">
                                  {sTasks.map((t) => {
                                    const isTaskSelected =
                                      selectedTarget.type === "project-task" &&
                                      selectedTarget.id === t.id;
                                    return (
                                      <div
                                        key={t.id}
                                        onClick={() =>
                                          handleSelect({
                                            type: "project-task",
                                            id: t.id,
                                            name: t.title,
                                            projectId: p.id,
                                            projectName: p.name,
                                            stageId: s.id,
                                            stageName: s.name,
                                          })
                                        }
                                        className={cn(
                                          "flex items-center gap-1.5 px-1 py-0.5 rounded-md cursor-pointer transition-colors text-xs hover:bg-slate-100 dark:hover:bg-slate-800",
                                          theme.startsWith("pixel") && "hover:bg-amber-100/80 rounded-xs",
                                          isTaskSelected &&
                                            (theme.startsWith("pixel")
                                              ? "bg-amber-200/90 text-amber-950 font-bold"
                                              : "bg-emerald-50/70 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 font-medium")
                                        )}
                                      >
                                        <div
                                          className={cn(
                                            "size-2 rounded-full border flex items-center justify-center shrink-0",
                                            isTaskSelected
                                              ? theme.startsWith("pixel")
                                                ? "border-amber-900 bg-amber-900 text-white"
                                                : "border-emerald-500 bg-emerald-500 text-white"
                                              : "border-slate-300 dark:border-slate-600"
                                          )}
                                        >
                                          {isTaskSelected && (
                                            <div className="size-0.5 bg-white rounded-full" />
                                          )}
                                        </div>
                                        <span className="truncate flex-1 text-[10px]">
                                          {t.title}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Unassigned Tasks in Project */}
                        {unassignedTasks.length > 0 && (
                          <div className="pl-1 space-y-0.5">
                            {unassignedTasks.map((t) => {
                              const isTaskSelected =
                                selectedTarget.type === "project-task" &&
                                selectedTarget.id === t.id;
                              return (
                                <div
                                  key={t.id}
                                  onClick={() =>
                                    handleSelect({
                                      type: "project-task",
                                      id: t.id,
                                      name: t.title,
                                      projectId: p.id,
                                      projectName: p.name,
                                    })
                                  }
                                  className={cn(
                                    "flex items-center gap-1.5 px-1 py-0.5 rounded-md cursor-pointer transition-colors text-xs hover:bg-slate-100 dark:hover:bg-slate-800",
                                    theme.startsWith("pixel") && "hover:bg-amber-100/80 rounded-xs",
                                    isTaskSelected &&
                                      (theme.startsWith("pixel")
                                        ? "bg-amber-200/90 text-amber-950 font-bold"
                                        : "bg-emerald-50/70 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 font-medium")
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "size-2 rounded-full border flex items-center justify-center shrink-0",
                                      isTaskSelected
                                        ? theme.startsWith("pixel")
                                          ? "border-amber-900 bg-amber-900 text-white"
                                          : "border-emerald-500 bg-emerald-500 text-white"
                                        : "border-slate-300 dark:border-slate-600"
                                    )}
                                  >
                                    {isTaskSelected && (
                                      <div className="size-0.5 bg-white rounded-full" />
                                    )}
                                  </div>
                                  <span className="truncate flex-1 text-[10px]">{t.title}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </>
        )}

        {/* ======================================================== */}
        {/* Tab 2: Standalone Tasks                                  */}
        {/* ======================================================== */}
        {selectorTab === "task" && (
          <>
            {filteredTasks.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-[11px]">暂无独立待办任务</div>
            ) : (
              filteredTasks.map((t) => {
                const isSelected = selectedTarget.type === "task" && selectedTarget.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => handleSelect({ type: "task", id: t.id, name: t.title })}
                    className={cn(
                      "flex items-center gap-2 px-1.5 py-1.5 rounded-md cursor-pointer transition-colors text-xs hover:bg-slate-100 dark:hover:bg-slate-800",
                      theme.startsWith("pixel") && "hover:bg-amber-100/80 rounded-xs",
                      isSelected &&
                        (theme.startsWith("pixel")
                          ? "bg-amber-200/90 text-amber-950 font-bold"
                          : "bg-blue-50/60 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-medium")
                    )}
                  >
                    <div
                      className={cn(
                        "size-3 rounded-full border flex items-center justify-center shrink-0",
                        isSelected
                          ? theme.startsWith("pixel")
                            ? "border-amber-900 bg-amber-900 text-white"
                            : "border-blue-500 bg-blue-500 text-white"
                          : "border-slate-300 dark:border-slate-600"
                      )}
                    >
                      {isSelected && <div className="size-1 bg-white rounded-full" />}
                    </div>
                    <span className="truncate flex-1 text-[11px]">{t.title}</span>
                  </div>
                );
              })
            )}
          </>
        )}

        {/* ======================================================== */}
        {/* Tab 3: Habits                                            */}
        {/* ======================================================== */}
        {selectorTab === "habit" && (
          <>
            {habits.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-[11px]">暂无习惯</div>
            ) : (
              habits.map((h) => {
                const isSelected = selectedTarget.type === "habit" && selectedTarget.id === h.id;
                return (
                  <div
                    key={h.id}
                    onClick={() => handleSelect({ type: "habit", id: h.id, name: h.name })}
                    className={cn(
                      "flex items-center gap-2 px-1.5 py-1.5 rounded-md cursor-pointer transition-colors text-xs hover:bg-slate-100 dark:hover:bg-slate-800",
                      theme.startsWith("pixel") && "hover:bg-amber-100/80 rounded-xs",
                      isSelected &&
                        (theme.startsWith("pixel")
                          ? "bg-amber-200/90 text-amber-950 font-bold"
                          : "bg-blue-50/60 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-medium")
                    )}
                  >
                    <div
                      className={cn(
                        "size-3 rounded-full border flex items-center justify-center shrink-0",
                        isSelected
                          ? theme.startsWith("pixel")
                            ? "border-amber-900 bg-amber-900 text-white"
                            : "border-blue-500 bg-blue-500 text-white"
                          : "border-slate-300 dark:border-slate-600"
                      )}
                    >
                      {isSelected && <div className="size-1 bg-white rounded-full" />}
                    </div>
                    <span className="truncate flex-1 text-[11px]">{h.name}</span>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>
    </div>
  );
};
