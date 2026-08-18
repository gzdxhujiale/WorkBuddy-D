import { useMemo, useState } from "react";
import {
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Flag,
  FolderKanban,
  Plus,
  Tag,
  Trash2,
  Users,
} from "lucide-react";
import { ProjectStageBoard } from "@/components/projects/ProjectStageBoard";
import { useConfirmDialog } from "@/components/ui/ConfirmDeleteDialog";
import { useProjectActions, useProjectsData } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
  type Priority,
  type Project,
  type ProjectStatus,
  type ProjectTemplate,
  type ProjectTemplateDefinition,
} from "@/types/projects";
import { QUADRANT_DB_MAP } from "@/types/timeManagement";
import { createProjectId, createProjectStageId, createProjectTemplateId } from "@/lib/entityIds";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { PixelSparkle } from "@/components/pixel/PixelIcons";

const priorityClasses: Record<Priority, string> = {
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
  medium: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 border-sky-200 dark:border-sky-800",
  high: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  urgent: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800",
};

function makeProject(values: Partial<Project> & Pick<Project, "name">): Project {
  const now = Date.now();
  return {
    id: createProjectId(),
    name: values.name,
    description: values.description,
    status: values.status ?? "not_started",
    startDate: values.startDate,
    endDate: values.endDate,
    priority: values.priority ?? "medium",
    tags: values.tags ?? [],
    ownerName: values.ownerName,
    createdAt: now,
    updatedAt: values.updatedAt ?? 0,
  };
}

function ProgressRing({ completed, total }: { completed: number; total: number }) {
  const percent = total ? Math.round((completed / total) * 100) : 0;
  return (
    <div
      className="relative grid size-11 place-items-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200 shrink-0"
      title={`任务完成率 ${percent}%`}
    >
      <span className="absolute inset-1 rounded-full bg-card" />
      <span className="relative">{percent}%</span>
    </div>
  );
}

function CreateProjectDialog({
  open,
  templates,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  templates: ProjectTemplate[];
  onOpenChange: (open: boolean) => void;
  onCreate: (project: Project, templateId?: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [tags, setTags] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!name.trim()) return setError("请填写项目名称");
    if (startDate && endDate && endDate < startDate) return setError("结束日期不能早于开始日期");
    setSaving(true);
    setError("");
    try {
      await onCreate(
        makeProject({
          name: name.trim(),
          description: description.trim() || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          ownerName: ownerName.trim() || undefined,
          priority,
          tags: tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        }),
        templateId || undefined
      );
      setName("");
      setDescription("");
      setStartDate("");
      setEndDate("");
      setOwnerName("");
      setTags("");
      setTemplateId("");
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "创建项目失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>新建项目</DialogTitle>
          <DialogDescription>项目从未开始启动；选用模板会生成阶段和同一批任务中心任务。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
            名称
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
            说明
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-16 rounded-lg border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <div className="grid gap-1.5 text-sm font-medium sm:col-span-2">
            <span>项目周期</span>
            <DateRangePicker
              value={startDate || endDate ? [startDate, endDate] : undefined}
              placeholder={["开始日期", "结束日期"]}
              onChange={(dateStrings) => {
                const [start, end] = dateStrings;
                setStartDate(start || "");
                setEndDate(end || "");
              }}
            />
          </div>
          <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
            负责人
            <input
              value={ownerName}
              onChange={(event) => setOwnerName(event.target.value)}
              placeholder="例如：李明"
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            优先级
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as Priority)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none"
            >
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            标签
            <input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="多个标签用逗号分隔"
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
            套用模板
            <select
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none"
            >
              <option value="">从空白项目开始</option>
              {templates.map((template) => (
                <option value={template.id} key={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button disabled={saving} onClick={() => void submit()}>
            {saving ? "创建中…" : "创建项目"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateTemplateDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (template: ProjectTemplate) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [stages, setStages] = useState("需求评审:产品,开发:开发,测试:测试,上线:产品");
  const [tasks, setTasks] = useState(
    "需求评审 | 评审需求 | 产品 | high\n开发 | 完成开发 | 开发 | high\n测试 | 测试验收 | 测试 | medium\n上线 | 发布上线 | 产品 | high"
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) return setError("请填写模板名称");
    const stageItems = stages
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [stageName, assignee] = part.split(":").map((item) => item.trim());
        return { key: stageName, name: stageName, defaultAssigneeName: assignee || undefined };
      });
    if (stageItems.some((stage) => !stage.name)) return setError("阶段格式为：阶段名称:默认负责人");
    const definition: ProjectTemplateDefinition = {
      stages: stageItems,
      tasks: tasks
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [stageKey, title, assigneeName, rawPriority, descriptionText] = line.split("|").map((item) => item.trim());
          return {
            stageKey,
            title,
            assigneeName: assigneeName || undefined,
            priority: (["low", "medium", "high", "urgent"].includes(rawPriority) ? rawPriority : "medium") as Priority,
            description: descriptionText || undefined,
            quadrant: QUADRANT_DB_MAP.Q2,
          };
        }),
    };
    if (definition.tasks.some((task) => !task.title)) return setError("每条任务至少需要阶段和标题");
    setSaving(true);
    setError("");
    try {
      await onCreate({
        id: createProjectTemplateId(),
        name: name.trim(),
        description: description.trim() || undefined,
        definition,
        updatedAt: 0,
      });
      setName("");
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存模板失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>配置项目模板</DialogTitle>
          <DialogDescription>阶段可配置默认负责人；创建项目时任务会以未完成状态生成，不复制具体日期。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <label className="grid gap-1.5 text-sm font-medium">
            模板名称
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            说明
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            阶段（逗号分隔，格式：阶段:默认负责人）
            <input
              value={stages}
              onChange={(event) => setStages(event.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            待生成任务（每行：阶段 | 标题 | 负责人 | 优先级 | 说明）
            <textarea
              value={tasks}
              onChange={(event) => setTasks(event.target.value)}
              className="min-h-32 rounded-lg border border-border bg-background p-3 font-mono text-xs outline-none"
            />
          </label>
        </div>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button disabled={saving} onClick={() => void submit()}>
            {saving ? "保存中…" : "保存模板"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectsPage() {
  const { isPixelTheme } = useAppThemeStyle();
  const { data, isPending, error } = useProjectsData();
  const { saveProject, saveStage, saveTask, saveTemplate, createFromTemplate, deleteProject, deleteStage, deleteTask } = useProjectActions();
  const { confirm, dialogElement } = useConfirmDialog();
  const [selectedId, setSelectedId] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const projects = data?.projects ?? [];
  const selected = projects.find((project) => project.id === selectedId) ?? projects[0];
  const selectedStages = useMemo(
    () => (data?.stages ?? []).filter((stage) => stage.projectId === selected?.id).sort((a, b) => a.sortOrder - b.sortOrder),
    [data?.stages, selected?.id]
  );
  const selectedTasks = useMemo(
    () => (data?.tasks ?? []).filter((task) => task.projectId === selected?.id),
    [data?.tasks, selected?.id]
  );
  const completedCount = selectedTasks.filter((task) => task.completed).length;

  const createProject = async (project: Project, templateId?: string) => {
    if (templateId) await createFromTemplate(project, templateId);
    else await saveProject(project);
    setSelectedId(project.id);
  };

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setActionError("");
    try {
      await work();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "操作失败");
    } finally {
      setBusy(false);
    }
  };

  if (isPending) return <div className="grid h-full place-items-center text-sm text-muted-foreground">加载项目中心…</div>;
  if (error) return <div className="p-8 text-sm text-destructive">加载项目中心失败：{error.message}</div>;

  return (
    <div className="flex flex-row h-full w-full min-h-0 overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside className={`flex flex-col h-full w-[300px] shrink-0 border-r ${isPixelTheme ? "border-2 border-border/80 bg-muted/40 font-mono" : "border-border bg-muted/20"} overflow-hidden`}>
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4 select-none">
          <div className="flex items-center gap-2">
            {isPixelTheme && <PixelSparkle size={15} />}
            <h3 className="text-base font-bold text-foreground">{isPixelTheme ? "冒险项目公会" : "项目中心"}</h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className={isPixelTheme ? "size-8 rounded-xs border border-border bg-muted hover:bg-card text-foreground shadow-[1px_1px_0px_#000] cursor-pointer" : "size-8 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"}
            onClick={() => setCreating(true)}
            aria-label="新建项目"
            title="新建项目"
          >
            <Plus className="size-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
          {projects.map((project) => {
            const taskSet = (data?.tasks ?? []).filter((task) => task.projectId === project.id);
            const done = taskSet.filter((task) => task.completed).length;
            const isCurrent = selected?.id === project.id;
            return (
              <button
                key={project.id}
                type="button"
                onClick={() => setSelectedId(project.id)}
                className={`w-full ${isPixelTheme ? "rounded-lg font-mono" : "rounded-xl"} border p-3 text-left transition-all cursor-pointer ${isCurrent
                    ? isPixelTheme
                      ? "border-2 border-amber-800 dark:border-amber-600 bg-amber-100 dark:bg-amber-950/80 shadow-[2px_2px_0px_#000]"
                      : "border-sky-300 bg-sky-50/80 shadow-sm dark:border-sky-800 dark:bg-sky-950/40"
                    : "border-transparent hover:bg-accent/60"
                  }`}
              >
                <div className="flex items-start gap-3">
                  <ProgressRing completed={done} total={taskSet.length} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">{project.name}</span>
                      <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="shrink-0">{PROJECT_STATUS_LABELS[project.status]}</span>
                      {(project.startDate || project.endDate) && (
                        <span className="truncate">
                          · {project.startDate ?? "未设"} 至 {project.endDate ?? "未设"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
          {projects.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              <FolderKanban className="mx-auto mb-3 size-8 opacity-45" />
              还没有项目。创建一个项目，或从模板开始。
            </div>
          )}
        </div>
      </aside>

      {/* Main Details Panel */}
      {selected ? (
        <section className="flex-1 h-full min-w-0 overflow-y-auto">
          <div className="mx-auto max-w-5xl p-6 lg:p-8">
            {/* Header: Title & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
              <div className="min-w-0 flex-1">
                <input
                  key={`name-${selected.id}`}
                  defaultValue={selected.name}
                  onBlur={(event) => {
                    const val = event.target.value.trim();
                    if (val && val !== selected.name) {
                      void run(() => saveProject({ ...selected, name: val }));
                    }
                  }}
                  className="w-full rounded-lg bg-transparent px-1 py-0.5 text-base font-bold text-foreground outline-none transition-colors hover:bg-muted/40 focus:bg-background focus:ring-2 focus:ring-ring"
                  aria-label="项目名称"
                  placeholder="项目名称"
                />
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={selected.status}
                  disabled={busy}
                  onChange={(event) => void run(() => saveProject({ ...selected, status: event.target.value as ProjectStatus }))}
                  className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-medium outline-none shadow-sm"
                >
                  {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value} disabled={value === "completed" && completedCount !== selectedTasks.length}>
                      {label}
                    </option>
                  ))}
                </select>
                <Button
                  variant={selected.status === "completed" ? "secondary" : "default"}
                  size="sm"
                  disabled={busy || selected.status === "completed" || (selectedTasks.length > 0 && completedCount !== selectedTasks.length)}
                  onClick={() => void run(() => saveProject({ ...selected, status: "completed" }))}
                  className="h-9 gap-1.5"
                >
                  <Check className="size-4" />
                  {selected.status === "completed" ? "已完成" : "完成项目"}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={busy}
                  aria-label={`删除项目 ${selected.name}`}
                  title="删除项目"
                  onClick={() =>
                    void confirm({
                      title: "删除项目？",
                      description: "项目、所有阶段及其任务都会移入已删除状态。",
                      confirmText: "删除项目",
                    }).then((confirmed) => {
                      if (!confirmed) return;
                      void run(async () => {
                        await deleteProject(selected.id);
                        setSelectedId(undefined);
                      });
                    })
                  }
                  className="size-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>

            {/* Description */}
            <div className="mt-3">
              <textarea
                key={`desc-${selected.id}`}
                defaultValue={selected.description}
                onBlur={(event) => {
                  const val = event.target.value;
                  if (val !== (selected.description ?? "")) {
                    void run(() => saveProject({ ...selected, description: val || undefined }));
                  }
                }}
                placeholder="添加项目说明或目标描述…"
                rows={2}
                className="w-full resize-y rounded-lg border border-transparent bg-transparent p-2 text-sm leading-relaxed text-muted-foreground outline-none transition-colors hover:border-border/60 focus:border-border focus:bg-background focus:text-foreground focus:ring-1 focus:ring-ring"
              />
            </div>

            {/* Properties Bar */}
            <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-border/80 bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Priority */}
              <div className="flex items-center gap-2.5">
                <Flag className="size-4 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground shrink-0">优先级</span>
                <select
                  value={selected.priority}
                  disabled={busy}
                  onChange={(e) => void run(() => saveProject({ ...selected, priority: e.target.value as Priority }))}
                  className={`h-7 rounded-md border px-2 text-xs font-medium outline-none bg-background ${priorityClasses[selected.priority]}`}
                >
                  {Object.entries(PRIORITY_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}优先级
                    </option>
                  ))}
                </select>
              </div>

              {/* Owner */}
              <div className="flex items-center gap-2.5">
                <Users className="size-4 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground shrink-0">负责人</span>
                <input
                  key={`owner-${selected.id}`}
                  defaultValue={selected.ownerName ?? ""}
                  placeholder="未指定"
                  disabled={busy}
                  onBlur={(event) => {
                    const val = event.target.value.trim();
                    if (val !== (selected.ownerName ?? "")) {
                      void run(() => saveProject({ ...selected, ownerName: val || undefined }));
                    }
                  }}
                  className="h-7 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 text-xs text-foreground outline-none hover:border-border focus:border-border focus:bg-background"
                />
              </div>

              {/* Timeline */}
              <div className="flex items-center gap-2.5">
                <Calendar className="size-4 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground shrink-0">周期</span>
                <DateRangePicker
                  size="small"
                  disabled={busy}
                  value={
                    selected.startDate || selected.endDate
                      ? [selected.startDate ?? "", selected.endDate ?? ""]
                      : undefined
                  }
                  placeholder={["开始日期", "结束日期"]}
                  onChange={(dateStrings) => {
                    const [start, end] = dateStrings;
                    void run(() =>
                      saveProject({
                        ...selected,
                        startDate: start || undefined,
                        endDate: end || undefined,
                      })
                    );
                  }}
                  className="h-7 text-xs flex-1 max-w-[240px]"
                />
              </div>

              {/* Tags */}
              <div className="flex items-center gap-2.5 sm:col-span-2">
                <Tag className="size-4 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground shrink-0">标签</span>
                <div className="flex flex-1 flex-wrap items-center gap-1.5">
                  {selected.tags.map((tag, idx) => (
                    <span
                      key={`${tag}-${idx}`}
                      className="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                  <input
                    key={`tags-${selected.id}`}
                    defaultValue={selected.tags.join(", ")}
                    placeholder={selected.tags.length === 0 ? "添加标签 (逗号分隔)" : "编辑..."}
                    disabled={busy}
                    onBlur={(event) => {
                      const nextTags = event.target.value.split(",").map((t) => t.trim()).filter(Boolean);
                      if (nextTags.join(",") !== selected.tags.join(",")) {
                        void run(() => saveProject({ ...selected, tags: nextTags }));
                      }
                    }}
                    className="h-6 min-w-[80px] flex-1 rounded bg-transparent px-1.5 text-xs text-muted-foreground outline-none hover:bg-background/80 focus:bg-background focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>

              {/* Progress */}
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="size-4 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground shrink-0">进度</span>
                <div className="flex flex-1 items-center gap-2">
                  <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${selectedTasks.length ? Math.round((completedCount / selectedTasks.length) * 100) : 0}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground font-medium shrink-0">
                    {completedCount}/{selectedTasks.length} ({selectedTasks.length ? Math.round((completedCount / selectedTasks.length) * 100) : 0}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Stages & Tasks */}
            <ProjectStageBoard
              stages={selectedStages}
              tasks={selectedTasks}
              disabled={busy}
              onCreateStage={(name) => run(() => saveStage({ id: createProjectStageId(), projectId: selected.id, name, sortOrder: 0 }))}
              onSaveStage={(stage) => run(() => saveStage(stage))}
              onDeleteStage={(stage) =>
                confirm({
                  title: `删除阶段“${stage.name}”？`,
                  description: "该阶段中的任务也会移入已删除状态。",
                  confirmText: "删除阶段",
                }).then((confirmed) => {
                  if (confirmed) void run(() => deleteStage(stage.id));
                })
              }
              onSaveTask={(task) => run(() => saveTask(task))}
              onDeleteTask={(taskId) => run(() => deleteTask(taskId))}
            />

            {actionError && (
              <p className="mt-4 text-sm text-destructive" role="alert">
                {actionError}
              </p>
            )}
          </div>
        </section>
      ) : (
        <section className="grid flex-1 place-items-center text-center text-muted-foreground">
          <div>
            <FolderKanban className="mx-auto mb-4 size-10 opacity-45" />
            <p className="font-medium">创建项目，开始管理完整事项</p>
          </div>
        </section>
      )}

      <CreateProjectDialog open={creating} templates={data?.templates ?? []} onOpenChange={setCreating} onCreate={createProject} />
      <CreateTemplateDialog open={creatingTemplate} onOpenChange={setCreatingTemplate} onCreate={saveTemplate} />
      {dialogElement}
    </div>
  );
}
