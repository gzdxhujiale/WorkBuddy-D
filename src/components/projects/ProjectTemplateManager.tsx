import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/ConfirmDeleteDialog";
import { useProjectActions, useProjectsData } from "@/hooks/useProjects";
import type { ProjectTemplate } from "@/types/projects";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { TemplateEditorModal } from "./TemplateEditorModal";
import { PixelScroll, PixelSword } from "@/components/pixel/PixelIcons";
import { cn } from "@/lib/utils";

export function ProjectTemplateManager() {
  const { isPixelTheme } = useAppThemeStyle();
  const { data, isPending, error } = useProjectsData();
  const { saveTemplate, deleteTemplate } = useProjectActions();
  const { confirm, dialogElement } = useConfirmDialog();
  const [editing, setEditing] = useState<ProjectTemplate | null | undefined>();

  const remove = async (template: ProjectTemplate) => {
    if (
      await confirm({
        title: isPixelTheme ? `解除战术蓝图“${template.name}”？` : `删除项目模板“${template.name}”？`,
        description: "模板将被移入已删除状态，不能再用于创建项目。",
        confirmText: "删除",
      })
    ) {
      await deleteTemplate(template.id);
    }
  };

  if (isPending) return <div className="text-sm text-muted-foreground font-mono">加载项目模板…</div>;
  if (error) return <p role="alert" className="text-sm text-destructive font-mono">加载项目模板失败：{error.message}</p>;

  return (
    <div className={cn("space-y-4", isPixelTheme && "font-mono")}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5">
            {isPixelTheme && <PixelSword size={16} />}
            <h3 className="font-semibold text-foreground">
              {isPixelTheme ? "⚔️ 冒险公会战术蓝图 (项目模板)" : "项目模板"}
            </h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {isPixelTheme
              ? "在这里结构化维护创建项目时可复用的冒险流程与委托任务。"
              : "在这里维护创建项目时可复用的流程和任务结构。"}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setEditing(null)}
          className={cn(
            isPixelTheme
              ? "rounded-xs border-2 border-amber-900 bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
              : ""
          )}
        >
          <Plus className="mr-1.5 size-4" />
          {isPixelTheme ? "新增战术蓝图" : "新增模板"}
        </Button>
      </div>

      <div
        className={cn(
          "overflow-hidden bg-card transition-all",
          isPixelTheme
            ? "rounded-xs border-2 border-border/90 shadow-[3px_3px_0px_rgba(0,0,0,0.08)] font-mono"
            : "rounded-xl border border-border shadow-2xs"
        )}
      >
        {(data?.templates ?? []).map((template) => (
          <div
            key={template.id}
            className={cn(
              "flex items-center gap-3 px-4 py-3 border-b transition-colors",
              isPixelTheme
                ? "border-border/80 hover:bg-amber-100/40 dark:hover:bg-amber-950/30 last:border-0"
                : "border-border hover:bg-muted/40 last:border-0"
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {isPixelTheme && <PixelScroll size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />}
                <p className="truncate text-sm font-bold text-foreground">{template.name}</p>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {template.description || `${template.definition.stages.length} 个阶段 · ${template.definition.tasks.length} 项预设任务`}
              </p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <Button
                size="icon"
                variant="ghost"
                className={cn(isPixelTheme ? "rounded-xs hover:bg-amber-200/60 dark:hover:bg-amber-950/60" : "")}
                onClick={() => setEditing(template)}
                aria-label={`编辑 ${template.name}`}
                title="编辑模板"
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className={cn(isPixelTheme ? "rounded-xs hover:bg-red-200/60 dark:hover:bg-red-950/60" : "")}
                onClick={() => void remove(template)}
                aria-label={`删除 ${template.name}`}
                title="删除模板"
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}

        {data?.templates.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground space-y-2">
            <p>还没有项目模板。</p>
            <p className="text-xs text-muted-foreground/80">点击右上角按钮即可新增可视化项目模板。</p>
          </div>
        )}
      </div>

      {editing !== undefined && (
        <TemplateEditorModal
          key={editing?.id ?? "new"}
          open={true}
          template={editing ?? undefined}
          onOpenChange={(open) => {
            if (!open) setEditing(undefined);
          }}
          onSave={saveTemplate}
        />
      )}

      {dialogElement}
    </div>
  );
}
