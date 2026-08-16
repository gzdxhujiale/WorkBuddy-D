import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/ConfirmDeleteDialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useProjectActions, useProjectsData } from "@/hooks/useProjects";
import { QUADRANT_DB_MAP } from "@/types/timeManagement";
import type { Priority, ProjectTemplate, ProjectTemplateDefinition } from "@/types/projects";

function stageText(template?: ProjectTemplate): string {
  return template?.definition.stages.map((stage) => `${stage.name}:${stage.defaultAssigneeName ?? ""}`).join(",") ?? "需求评审:产品,开发:开发,测试:测试,上线:产品";
}

function taskText(template?: ProjectTemplate): string {
  return template?.definition.tasks.map((task) => `${task.stageKey ?? ""} | ${task.title} | ${task.assigneeName ?? ""} | ${task.priority ?? "medium"} | ${task.description ?? ""}`).join("\n") ?? "需求评审 | 评审需求 | 产品 | high\n开发 | 完成开发 | 开发 | high\n测试 | 测试验收 | 测试 | medium\n上线 | 发布上线 | 产品 | high";
}

function TemplateEditor({ template, onClose }: { template?: ProjectTemplate; onClose: () => void }) {
  const { saveTemplate } = useProjectActions();
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [stages, setStages] = useState(() => stageText(template));
  const [tasks, setTasks] = useState(() => taskText(template));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!name.trim()) return setError("请填写模板名称");
    const stageItems = stages.split(",").map((item) => item.trim()).filter(Boolean).map((item) => {
      const [stageName, assignee] = item.split(":").map((part) => part.trim());
      return { key: stageName, name: stageName, defaultAssigneeName: assignee || undefined };
    });
    const definition: ProjectTemplateDefinition = {
      stages: stageItems,
      tasks: tasks.split("\n").map((item) => item.trim()).filter(Boolean).map((item) => {
        const [stageKey, title, assigneeName, rawPriority, taskDescription] = item.split("|").map((part) => part.trim());
        return { stageKey, title, assigneeName: assigneeName || undefined, priority: (["low", "medium", "high", "urgent"].includes(rawPriority) ? rawPriority : "medium") as Priority, description: taskDescription || undefined, quadrant: QUADRANT_DB_MAP.Q2 };
      }),
    };
    if (stageItems.some((stage) => !stage.name) || definition.tasks.some((task) => !task.title)) return setError("请检查阶段和任务格式");
    setSaving(true); setError("");
    try { await saveTemplate({ id: template?.id ?? crypto.randomUUID(), name: name.trim(), description: description.trim() || undefined, definition, updatedAt: template?.updatedAt ?? 0 }); onClose(); } catch (cause) { setError(cause instanceof Error ? cause.message : "保存模板失败"); } finally { setSaving(false); }
  };
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="max-w-2xl" onClose={onClose}><DialogHeader><DialogTitle>{template ? "编辑项目模板" : "新增项目模板"}</DialogTitle><DialogDescription>阶段格式：阶段:默认负责人；任务格式：阶段 | 标题 | 负责人 | 优先级 | 说明。</DialogDescription></DialogHeader><div className="grid gap-3"><label className="grid gap-1.5 text-sm font-medium">模板名称<input autoFocus value={name} onChange={(event) => setName(event.target.value)} className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none" /></label><label className="grid gap-1.5 text-sm font-medium">说明<input value={description} onChange={(event) => setDescription(event.target.value)} className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none" /></label><label className="grid gap-1.5 text-sm font-medium">阶段<input value={stages} onChange={(event) => setStages(event.target.value)} className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none" /></label><label className="grid gap-1.5 text-sm font-medium">待生成任务<textarea value={tasks} onChange={(event) => setTasks(event.target.value)} className="min-h-32 rounded-lg border border-border bg-background p-3 font-mono text-xs outline-none" /></label></div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<DialogFooter><Button variant="outline" onClick={onClose}>取消</Button><Button disabled={saving} onClick={() => void submit()}>{saving ? "保存中…" : "保存模板"}</Button></DialogFooter></DialogContent></Dialog>;
}

export function ProjectTemplateManager() {
  const { data, isPending, error } = useProjectsData();
  const { deleteTemplate } = useProjectActions();
  const { confirm, dialogElement } = useConfirmDialog();
  const [editing, setEditing] = useState<ProjectTemplate | null | undefined>();
  const remove = async (template: ProjectTemplate) => {
    if (await confirm({ title: "删除项目模板？", description: "模板将被移入已删除状态，不能再用于创建项目。", confirmText: "删除" })) await deleteTemplate(template.id);
  };
  if (isPending) return <div className="text-sm text-muted-foreground">加载项目模板…</div>;
  if (error) return <p role="alert" className="text-sm text-destructive">加载项目模板失败：{error.message}</p>;
  return <div className="space-y-4"><div className="flex items-start justify-between gap-4"><div><h3 className="font-medium text-foreground">项目模板</h3><p className="mt-1 text-sm text-muted-foreground">在这里维护创建项目时可复用的流程和任务。</p></div><Button size="sm" onClick={() => setEditing(null)}><Plus className="mr-1.5 size-4" />新增模板</Button></div><div className="overflow-hidden rounded-xl border border-border">{(data?.templates ?? []).map((template) => <div key={template.id} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{template.name}</p><p className="mt-1 truncate text-xs text-muted-foreground">{template.description || `${template.definition.stages.length} 个阶段 · ${template.definition.tasks.length} 个任务`}</p></div><Button size="icon" variant="ghost" onClick={() => setEditing(template)} aria-label={`编辑 ${template.name}`}><Pencil className="size-4" /></Button><Button size="icon" variant="ghost" onClick={() => void remove(template)} aria-label={`删除 ${template.name}`}><Trash2 className="size-4 text-destructive" /></Button></div>)}{data?.templates.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted-foreground">还没有项目模板。</p>}</div>{editing !== undefined && <TemplateEditor key={editing?.id ?? "new"} template={editing ?? undefined} onClose={() => setEditing(undefined)} />}{dialogElement}</div>;
}
