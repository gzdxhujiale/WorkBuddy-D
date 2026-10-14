import { useMemo } from "react";
import { FolderKanban, Check } from "lucide-react";
import type { Project, ProjectStage } from "@/types/project";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { cn } from "@/lib/utils";

export interface TaskProjectPickerProps {
  projects: Project[];
  stages: ProjectStage[];
  selectedProjectId: string | null;
  selectedProjectStageId: string | null;
  onSelectProjectStage: (projectId: string | null, stageId: string | null) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean | ((prev: boolean) => boolean)) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  menuRef: React.RefObject<HTMLDivElement | null>;
}

export function TaskProjectPicker({
  projects,
  stages,
  selectedProjectId,
  selectedProjectStageId,
  onSelectProjectStage,
  isOpen,
  onOpenChange,
  triggerRef,
  menuRef,
}: TaskProjectPickerProps) {
  const { isPixelTheme } = useAppThemeStyle();

  const activeProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId),
    [projects, selectedProjectId]
  );
  const activeStage = useMemo(
    () => stages.find((s) => s.id === selectedProjectStageId),
    [stages, selectedProjectStageId]
  );

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => onOpenChange((v) => !v)}
        className={cn(
          "flex items-center gap-1 px-2 py-1 text-xs transition-colors cursor-pointer shrink-0 max-w-[130px] select-none",
          activeProject
            ? isPixelTheme
              ? "bg-sky-100/90 text-sky-900 border border-sky-800/60 font-bold dark:bg-sky-950/80 dark:text-sky-300 shadow-[1px_1px_0px_#000] rounded-xs"
              : "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800 rounded-lg font-medium"
            : isPixelTheme
            ? "text-muted-foreground hover:bg-muted border border-border/60 rounded-xs shadow-[1px_1px_0px_#000]"
            : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
        )}
        title={
          activeProject
            ? `所属项目：${activeProject.name}${activeStage ? ` · ${activeStage.name}` : ""}`
            : "关联项目/阶段"
        }
      >
        <FolderKanban
          size={15}
          className={activeProject ? "text-sky-500 shrink-0" : "text-muted-foreground shrink-0"}
        />
        <span className="truncate">
          {activeProject ? (
            <>
              {activeProject.name}
              {activeStage && (
                <span className="opacity-70 text-[10px]"> · {activeStage.name}</span>
              )}
            </>
          ) : (
            "项目"
          )}
        </span>
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className={cn(
            "absolute right-0 top-full mt-1.5 z-50 min-w-56 max-h-72 overflow-y-auto p-1.5 shadow-xl animate-in fade-in zoom-in-95",
            isPixelTheme
              ? "bg-card border-2 border-border rounded-xs shadow-[3px_3px_0px_#000] font-mono"
              : "bg-popover border border-border rounded-xl shadow-lg"
          )}
        >
          <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground select-none">
            所属项目 (可选)
          </div>

          {/* 不关联项目选项 */}
          <button
            type="button"
            onClick={() => {
              onSelectProjectStage(null, null);
              onOpenChange(false);
            }}
            className={cn(
              "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs text-left cursor-pointer transition-colors my-0.5",
              isPixelTheme ? "rounded-xs" : "rounded-lg",
              !selectedProjectId
                ? isPixelTheme
                  ? "bg-muted font-bold text-foreground border border-border/60"
                  : "bg-accent font-semibold text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <span className="truncate">不关联项目 (独立待办)</span>
            {!selectedProjectId && <Check size={12} className="text-primary shrink-0" />}
          </button>

          {projects.length > 0 && <div className="h-px bg-border my-1 -mx-1" />}

          {projects.map((p) => {
            const isCurrentProject = selectedProjectId === p.id;
            const pStages = stages.filter((s) => s.projectId === p.id);
            return (
              <div key={p.id} className="space-y-0.5 my-1">
                <div
                  className={cn(
                    "flex items-center justify-between gap-1.5 px-2 py-1 text-[11px] font-semibold select-none",
                    isCurrentProject ? "text-primary font-bold" : "text-muted-foreground"
                  )}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <FolderKanban size={13} className="text-sky-500 shrink-0" />
                    <span className="truncate">{p.name}</span>
                  </div>
                  {pStages.length === 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectProjectStage(p.id, null);
                        onOpenChange(false);
                      }}
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded cursor-pointer transition-colors",
                        isCurrentProject
                          ? "bg-primary/20 text-primary font-bold"
                          : "bg-muted hover:bg-accent text-muted-foreground hover:text-foreground"
                      )}
                    >
                      选择项目
                    </button>
                  )}
                </div>

                {pStages.length > 0 && (
                  <div className="pl-3.5 pr-1 space-y-0.5 border-l-2 border-border/60 ml-2.5 my-0.5">
                    {pStages.map((stg) => {
                      const isStageSelected =
                        isCurrentProject && selectedProjectStageId === stg.id;
                      return (
                        <button
                          key={stg.id}
                          type="button"
                          onClick={() => {
                            onSelectProjectStage(p.id, stg.id);
                            onOpenChange(false);
                          }}
                          className={cn(
                            "w-full flex items-center justify-between gap-1.5 px-2 py-1.5 text-xs text-left cursor-pointer transition-colors",
                            isPixelTheme ? "rounded-xs" : "rounded-md",
                            isStageSelected
                              ? isPixelTheme
                                ? "bg-muted font-bold text-foreground border border-border/80"
                                : "bg-accent font-semibold text-foreground"
                              : "text-foreground hover:bg-muted"
                          )}
                        >
                          <span className="truncate">{stg.name}</span>
                          {isStageSelected && (
                            <Check size={12} className="text-primary shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
