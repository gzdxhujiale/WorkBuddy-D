import { useMemo, useState, useEffect } from "react";
import {
  Calendar,
  ChevronRight,
  Flag,
  FolderKanban,
  Plus,
  Tag,
  Trash2,
  Users,
  Search,
  Kanban,
  Table as TableIcon,
  Activity,
  Archive,
  ArchiveRestore,
  MoreHorizontal,
  ChevronDown,
  Check,
} from "lucide-react";
import { ProjectStageBoard } from "@/components/projects/ProjectStageBoard";
import { ProjectGanttView } from "@/components/projects/ProjectGanttView";
import { ProjectTableView } from "@/components/projects/ProjectTableView";
import { TemplateEditorModal } from "@/components/projects/TemplateEditorModal";
import { useConfirmDialog } from "@/components/ui/ConfirmDeleteDialog";
import { useProjectActions, useProjectsData } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { DateRangePicker } from "@/components/ui/date-picker";
import { InputTag } from "@/components/ui/input-tag";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  PRIORITY_LABELS,
  getProjectComputedStatus,
  type Priority,
  type Project,
  type ProjectStatus,
  type ProjectTemplate,
} from "@/types/projects";
import { createProjectId, createProjectStageId } from "@/lib/entityIds";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { PixelShield, PixelScroll } from "@/components/pixel/PixelIcons";
import { useUiStore } from "@/stores/uiStore";
import { formatDateYMD, todayYMD } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";

const priorityClasses: Record<Priority, string> = {
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
  medium: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 border-sky-200 dark:border-sky-800",
  high: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  urgent: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800",
};

const PRIORITY_ORDER: Record<Priority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
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

function ProgressRing({ completed, total, isPixelTheme }: { completed: number; total: number; isPixelTheme?: boolean }) {
  const percent = total ? Math.round((completed / total) * 100) : 0;
  if (isPixelTheme) {
    return (
      <div
        className="relative size-10 rounded-xs border-2 border-amber-900/60 dark:border-amber-600 bg-amber-100/90 dark:bg-amber-950/80 shadow-[1px_1px_0px_#000] text-[10px] font-mono font-black text-amber-950 dark:text-amber-100 flex flex-col items-center justify-center shrink-0 select-none"
        title={`任务完成率 ${percent}% (${completed}/${total})`}
      >
        <span>{percent}%</span>
      </div>
    );
  }
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
  const { isPixelTheme } = useAppThemeStyle();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [tagsList, setTagsList] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
      setStartDate("");
      setEndDate("");
      setOwnerName("");
      setPriority("medium");
      setTagsList([]);
      setTemplateId("");
      setError("");
    }
  }, [open]);

  const submit = async () => {
    if (!name.trim()) {
      setError(isPixelTheme ? "请填写冒险项目代号/名称" : "请填写项目名称");
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      setError(isPixelTheme ? "凯旋之日不能早于启程之日" : "结束日期不能早于开始日期");
      return;
    }
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
          tags: tagsList.map((tag) => tag.trim()).filter(Boolean),
        }),
        templateId || undefined
      );
      setName("");
      setDescription("");
      setStartDate("");
      setEndDate("");
      setOwnerName("");
      setTagsList([]);
      setTemplateId("");
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (isPixelTheme ? "发起冒险项目失败" : "创建项目失败"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={
        <div className="flex items-center gap-2">
          {isPixelTheme ? (
            <PixelShield size={18} className="text-amber-500 shrink-0" />
          ) : (
            <FolderKanban size={18} className="text-primary shrink-0" />
          )}
          <span className={isPixelTheme ? "font-mono font-bold text-amber-950 dark:text-amber-100" : ""}>
            {isPixelTheme ? "⚔️ 发起冒险项目" : "新建项目"}
          </span>
        </div>
      }
      onCancel={() => onOpenChange(false)}
      onOk={() => void submit()}
      okText={isPixelTheme ? (saving ? "刻印中…" : "⚔️ 发起冒险") : (saving ? "创建中…" : "创建项目")}
      cancelText={isPixelTheme ? "放弃" : "取消"}
      okDisabled={saving}
      width={560}
    >
      <div className={cn("flex flex-col gap-3.5 py-1 text-foreground", isPixelTheme && "font-mono")}>
        <p className="text-xs text-muted-foreground -mt-1 mb-1">
          {isPixelTheme
            ? "📜 项目从未启动状态出发；选用公会模板将自动生成阶段与相关委托任务。"
            : "项目从未开始启动；选用模板会生成阶段和同一批任务中心任务。"}
        </p>

        {/* Project Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
            <span>{isPixelTheme ? "冒险项目代号 / 名称" : "项目名称"}</span>
            <span className="text-destructive">*</span>
          </label>
          <Input
            autoFocus
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError("");
            }}
            placeholder={isPixelTheme ? "例如：巨龙遗迹远征计划" : "输入项目名称"}
            className={cn("h-9.5", error && !name.trim() && "border-destructive bg-destructive/10")}
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">
            {isPixelTheme ? "冒险委托简述" : "项目说明"}
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={isPixelTheme ? "描述本次冒险项目的背景、目标与通关要求..." : "输入项目描述或背景说明..."}
            className={cn(
              "w-full px-3 py-2 text-sm outline-none transition-colors resize-none",
              isPixelTheme
                ? "rounded-xs border-2 border-border bg-muted/60 hover:bg-muted focus:border-amber-600 focus:bg-background font-mono shadow-[1px_1px_0px_#000]"
                : "rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary"
            )}
          />
        </div>

        {/* Date Range */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">
            {isPixelTheme ? "冒险历程周期" : "项目周期"}
          </label>
          <DateRangePicker
            value={startDate || endDate ? [startDate, endDate] : undefined}
            placeholder={isPixelTheme ? ["启程之日", "凯旋之日"] : ["开始日期", "结束日期"]}
            onChange={(dateStrings) => {
              const [start, end] = dateStrings;
              setStartDate(start || "");
              setEndDate(end || "");
            }}
            className="w-full"
          />
        </div>

        {/* Owner & Priority (2 columns) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              {isPixelTheme ? "冒险队长 / 领队" : "负责人"}
            </label>
            <Input
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder={isPixelTheme ? "例如：勇者艾伦" : "例如：李明"}
              className="h-9.5"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              {isPixelTheme ? "危险等级" : "优先级"}
            </label>
            <Select
              value={priority}
              onChange={(val) => setPriority(val as Priority)}
              className="w-full"
            >
              <Select.Option value="urgent">{isPixelTheme ? "🔥 史诗 (紧急)" : "紧急优先级"}</Select.Option>
              <Select.Option value="high">{isPixelTheme ? "🔴 困难 (高)" : "高优先级"}</Select.Option>
              <Select.Option value="medium">{isPixelTheme ? "🟡 普通 (中)" : "中优先级"}</Select.Option>
              <Select.Option value="low">{isPixelTheme ? "🟢 简易 (低)" : "低优先级"}</Select.Option>
            </Select>
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">
            {isPixelTheme ? "契约标签" : "项目标签"}
          </label>
          <InputTag
            value={tagsList}
            onChange={(val) => setTagsList(val as string[])}
            placeholder={isPixelTheme ? "输入标签后按回车添加..." : "输入标签后按回车添加..."}
            className="w-full min-h-9"
          />
        </div>

        {/* Template */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">
            {isPixelTheme ? "套用公会战术蓝图" : "套用模板"}
          </label>
          <Select
            value={templateId}
            onChange={(val) => setTemplateId(String(val || ""))}
            className="w-full"
            placeholder={isPixelTheme ? "📜 从空白冒险开始" : "从空白项目开始"}
          >
            <Select.Option value="">{isPixelTheme ? "📜 从空白冒险开始" : "从空白项目开始"}</Select.Option>
            {templates.map((template) => (
              <Select.Option value={template.id} key={template.id}>
                {template.name}
              </Select.Option>
            ))}
          </Select>
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs text-destructive mt-1 font-mono" role="alert">
            ⚠️ {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

export type ProjectViewMode = "kanban" | "gantt" | "table";
export type SidebarStatusFilter = "all" | "in_progress" | "completed" | "archived";

export function ProjectsPage() {
  const { isPixelTheme } = useAppThemeStyle();
  const { data, isPending, error } = useProjectsData();
  const { saveProject, saveStage, reorderStages, saveTask, saveTemplate, createFromTemplate, deleteProject, deleteStage, deleteTask } = useProjectActions();
  const { confirm, dialogElement } = useConfirmDialog();
  const activeProjectId = useUiStore((s) => s.activeProjectId);
  const setActiveProjectId = useUiStore((s) => s.setActiveProjectId);
  const [selectedId, setSelectedId] = useState<string | undefined>(activeProjectId ?? undefined);
  const [creating, setCreating] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  // New View Mode State
  const [viewMode, setViewMode] = useState<ProjectViewMode>("kanban");

  // New Sidebar Status Filter & Search State (default to "in_progress")
  const [statusFilter, setStatusFilter] = useState<SidebarStatusFilter>("in_progress");
  const [searchQuery, setSearchQuery] = useState("");

  const todayStr = useMemo(() => todayYMD(), []);

  const projects = data?.projects ?? [];
  const allStages = data?.stages ?? [];
  const allTasks = data?.tasks ?? [];

  // Dynamically compute project status map based on task completion and archival state
  const statusMap = useMemo(() => {
    const map = new Map<string, ProjectStatus>();
    for (const p of projects) {
      const pTasks = allTasks.filter((t) => t.projectId === p.id);
      map.set(p.id, getProjectComputedStatus(p, pTasks));
    }
    return map;
  }, [projects, allTasks]);

  // Smart dynamic status derivation with risk awareness and clear contrast badges
  const getProjectSmartStatus = (proj: Project) => {
    const computedStatus = statusMap.get(proj.id) || "in_progress";
    if (computedStatus === "archived") {
      return {
        key: "archived" as const,
        label: "已归档",
        sidebarLabel: "已归档",
        badgeClasses: isPixelTheme
          ? "rounded-xs bg-muted text-muted-foreground border border-border shadow-[1px_1px_0px_#000] font-mono"
          : "rounded-lg bg-muted/70 text-muted-foreground border border-border/70",
        sidebarBadgeClasses: isPixelTheme
          ? "rounded-xs bg-muted text-muted-foreground border border-border/80 font-mono"
          : "rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700",
      };
    }

    if (computedStatus === "completed") {
      return {
        key: "completed" as const,
        label: "已完成",
        sidebarLabel: "已完成",
        badgeClasses: isPixelTheme
          ? "rounded-xs bg-emerald-500 text-emerald-950 border border-emerald-800 shadow-[1px_1px_0px_#064e3b] font-mono"
          : "rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300/70",
        sidebarBadgeClasses: isPixelTheme
          ? "rounded-xs bg-emerald-200 text-emerald-950 border border-emerald-800 shadow-[1px_1px_0px_#064e3b] font-mono"
          : "rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60",
      };
    }

    // For in_progress project, check risk & deadlines
    const projTasks = allTasks.filter((t) => t.projectId === proj.id);
    const overdueTasks = projTasks.filter((t) => {
      if (t.completed) return false;
      const tTime = t.scheduledEndAt || t.scheduledStartAt;
      return Boolean(tTime && formatDateYMD(new Date(tTime)) < todayStr);
    });

    const isProjectOverdue = Boolean(
      proj.endDate &&
      proj.endDate < todayStr
    );

    const approachingTasks = projTasks.filter((t) => {
      if (t.completed) return false;
      const tTime = t.scheduledEndAt || t.scheduledStartAt;
      if (!tTime) return false;
      const dStr = formatDateYMD(new Date(tTime));
      return dStr >= todayStr && (new Date(dStr).getTime() - new Date(todayStr).getTime()) / (24 * 3600 * 1000) <= 3;
    });

    const isProjectApproaching = Boolean(
      !isProjectOverdue &&
      proj.endDate &&
      (new Date(proj.endDate).getTime() - new Date(todayStr).getTime()) / (24 * 3600 * 1000) <= 3
    );

    if (overdueTasks.length > 0 || isProjectOverdue) {
      const count = overdueTasks.length > 0 ? overdueTasks.length : 1;
      return {
        key: "overdue" as const,
        label: `进行中 · 逾期（${count}）`,
        sidebarLabel: `逾期 ${count}`,
        badgeClasses: isPixelTheme
          ? "rounded-xs bg-red-200 text-red-950 border border-red-800 shadow-[1px_1px_0px_#7f1d1d] font-mono"
          : "rounded-lg bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-300 border border-red-300/70",
        sidebarBadgeClasses: isPixelTheme
          ? "rounded-xs bg-red-200 text-red-950 border border-red-800 shadow-[1px_1px_0px_#7f1d1d] font-mono animate-pulse"
          : "rounded bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60",
      };
    }

    if (approachingTasks.length > 0 || isProjectApproaching) {
      const count = approachingTasks.length > 0 ? approachingTasks.length : 1;
      return {
        key: "approaching" as const,
        label: `进行中 · 临近预期（${count}）`,
        sidebarLabel: `临近 ${count}`,
        badgeClasses: isPixelTheme
          ? "rounded-xs bg-amber-200 text-amber-950 border border-amber-800 shadow-[1px_1px_0px_#000] font-mono"
          : "rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300/70",
        sidebarBadgeClasses: isPixelTheme
          ? "rounded-xs bg-amber-200 text-amber-950 border border-amber-800 shadow-[1px_1px_0px_#000] font-mono"
          : "rounded bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60",
      };
    }

    return {
      key: "healthy" as const,
      label: "进行中 · 正常推进",
      sidebarLabel: "进行中",
      badgeClasses: isPixelTheme
        ? "rounded-xs bg-amber-400 text-amber-950 border border-amber-800 shadow-[1px_1px_0px_#000] font-mono"
        : "rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border border-amber-200/90 dark:border-amber-800/70",
      sidebarBadgeClasses: isPixelTheme
        ? "rounded-xs bg-sky-200 text-sky-950 border border-sky-800 shadow-[1px_1px_0px_#000] font-mono"
        : "rounded bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60",
    };
  };

  // Status Filter counts (dynamically computed from each project's tasks)
  const inProgressCount = useMemo(
    () =>
      projects.filter((p) => {
        const st = statusMap.get(p.id);
        return st === "in_progress" || !st;
      }).length,
    [projects, statusMap]
  );
  const completedProjectsCount = useMemo(
    () => projects.filter((p) => statusMap.get(p.id) === "completed").length,
    [projects, statusMap]
  );
  const archivedCount = useMemo(
    () => projects.filter((p) => statusMap.get(p.id) === "archived").length,
    [projects, statusMap]
  );

  // Filtered projects sorted by priority first, then by time (deadlines/creation)
  const filteredProjects = useMemo(() => {
    return projects
      .filter((project) => {
        const st = statusMap.get(project.id) || "in_progress";
        if (statusFilter === "in_progress") return st === "in_progress";
        if (statusFilter === "completed") return st === "completed";
        if (statusFilter === "archived") return st === "archived";
        return true;
      })
      .filter((project) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          project.name.toLowerCase().includes(q) ||
          (project.description?.toLowerCase().includes(q) ?? false) ||
          project.tags.some((tag) => tag.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        // 1. First priority: urgent > high > medium > low
        const pDiff = (PRIORITY_ORDER[b.priority] ?? 0) - (PRIORITY_ORDER[a.priority] ?? 0);
        if (pDiff !== 0) return pDiff;

        // 2. Secondary: Time sorting (closer deadline first; if no deadline, newer created first)
        if (a.endDate && b.endDate) {
          const dateDiff = a.endDate.localeCompare(b.endDate);
          if (dateDiff !== 0) return dateDiff;
        } else if (a.endDate && !b.endDate) {
          return -1;
        } else if (!a.endDate && b.endDate) {
          return 1;
        }

        const timeA = a.createdAt || a.updatedAt || 0;
        const timeB = b.createdAt || b.updatedAt || 0;
        return timeB - timeA;
      });
  }, [projects, statusFilter, searchQuery, statusMap]);

  useEffect(() => {
    if (activeProjectId && activeProjectId !== selectedId) {
      setSelectedId(activeProjectId);
    }
  }, [activeProjectId, selectedId]);

  useEffect(() => {
    if (!selectedId && filteredProjects.length > 0) {
      setSelectedId(filteredProjects[0].id);
    }
  }, [filteredProjects, selectedId]);

  const selected = useMemo(() => projects.find((item) => item.id === selectedId), [projects, selectedId]);
  const selectedStages = useMemo(
    () =>
      allStages
        .filter((stage) => stage.projectId === selected?.id)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [allStages, selected?.id]
  );
  const selectedTasks = useMemo(() => allTasks.filter((task) => task.projectId === selected?.id), [allTasks, selected?.id]);

  const run = async <T,>(action: () => Promise<T> | T): Promise<T | undefined> => {
    setBusy(true);
    setActionError("");
    try {
      return await action();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "操作失败");
      return undefined;
    } finally {
      setBusy(false);
    }
  };

  const createProject = async (project: Project, templateId?: string) => {
    if (templateId) {
      await run(() => createFromTemplate(project, templateId));
    } else {
      await run(() => saveProject(project));
    }
    setSelectedId(project.id);
    setActiveProjectId(project.id);
  };

  if (isPending) return <div className="p-8 text-sm text-muted-foreground font-mono">加载项目中心…</div>;
  if (error) return <div className="p-8 text-sm text-destructive font-mono">加载项目中心失败：{error.message}</div>;

  return (
    <div className="flex flex-row h-full w-full min-h-0 overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col h-full w-[310px] shrink-0 border-r overflow-hidden",
          isPixelTheme ? "border-r-2 border-border/90 bg-muted/40 font-mono" : "border-border bg-muted/20"
        )}
      >
        {/* Sidebar Header */}
        <div
          className={cn(
            "flex h-12 shrink-0 items-center justify-between border-b px-3.5 select-none",
            isPixelTheme ? "border-b-2 border-border/90" : "border-border"
          )}
        >
          <div className="flex items-center gap-2">
            {isPixelTheme && <PixelShield size={18} className="shrink-0" />}
            <h3 className="text-sm font-bold text-foreground">{isPixelTheme ? "⚔️ 冒险项目公会" : "项目中心"}</h3>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "size-7.5 cursor-pointer",
                isPixelTheme
                  ? "rounded-xs border-2 border-border bg-muted hover:bg-card text-foreground shadow-[1px_1px_0px_#000]"
                  : "rounded-md text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setCreatingTemplate(true)}
              aria-label="管理模板"
              title="配置项目模板"
            >
              <PixelScroll size={14} className="opacity-80" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "size-7.5 cursor-pointer",
                isPixelTheme
                  ? "rounded-xs border-2 border-amber-900 bg-amber-500 hover:bg-amber-600 text-amber-950 shadow-[1px_1px_0px_#000]"
                  : "rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
              )}
              onClick={() => setCreating(true)}
              aria-label="新建项目"
              title="新建项目"
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>

        {/* Status Filter Pills */}
        <div
          className={cn(
            "p-2.5 border-b flex flex-col gap-2 shrink-0 select-none",
            isPixelTheme ? "border-b-2 border-border/80 bg-amber-50/20 dark:bg-amber-950/20" : "border-border/60"
          )}
        >
          {/* Filter Pills Grid */}
          <div className="grid grid-cols-4 gap-1 p-0.5 rounded-lg bg-muted/40 border border-border/50">
            {[
              { key: "in_progress", label: "进行中", count: inProgressCount },
              { key: "all", label: "全部", count: projects.length },
              { key: "completed", label: "已完成", count: completedProjectsCount },
              { key: "archived", label: "已归档", count: archivedCount },
            ].map((tab) => {
              const isActive = statusFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key as SidebarStatusFilter)}
                  className={cn(
                    "py-1 px-1 text-[11px] font-medium text-center transition-all cursor-pointer flex items-center justify-center gap-1 min-w-0 select-none",
                    isActive
                      ? isPixelTheme
                        ? "rounded-xs bg-amber-500 text-amber-950 border border-amber-900 shadow-[1px_1px_0px_#000] font-black active:translate-x-[1px] active:translate-y-[1px]"
                        : "rounded-md bg-card text-foreground shadow-2xs font-bold border border-border/80"
                      : isPixelTheme
                      ? "rounded-xs text-muted-foreground hover:text-foreground hover:bg-amber-100/30 active:translate-x-[1px] active:translate-y-[1px]"
                      : "rounded-md text-muted-foreground hover:text-foreground hover:bg-card/40"
                  )}
                  title={`${tab.label} (${tab.count})`}
                >
                  <span className="truncate">{tab.label}</span>
                  <span
                    className={cn(
                      "text-[9px] px-1 py-0.2 rounded-full tabular-nums shrink-0 leading-none",
                      isActive
                        ? isPixelTheme
                          ? "bg-amber-950 text-amber-200 font-bold"
                          : "bg-primary/10 text-primary font-bold"
                        : "bg-muted/80 text-muted-foreground"
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div
            className={cn(
              "flex items-center gap-1.5 h-7.5 px-2 bg-background border",
              isPixelTheme ? "rounded-xs border-2 border-border/80 shadow-[1px_1px_0px_#000]" : "rounded-lg border-border/80"
            )}
          >
            <Search size={13} className="text-muted-foreground shrink-0" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索项目名称、标签..."
              className="w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/60"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Project List */}
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5">
          {filteredProjects.map((project) => {
            const taskSet = allTasks.filter((task) => task.projectId === project.id);
            const done = taskSet.filter((task) => task.completed).length;
            const isCurrent = selected?.id === project.id;
            const smart = getProjectSmartStatus(project);

            return (
              <button
                key={project.id}
                type="button"
                onClick={() => {
                  setSelectedId(project.id);
                  setActiveProjectId(project.id);
                }}
                className={cn(
                  "w-full border p-2.5 text-left transition-all cursor-pointer select-none relative",
                  isPixelTheme ? "rounded-xs font-mono" : "rounded-xl",
                  isCurrent
                    ? isPixelTheme
                      ? "border-2 border-amber-800 dark:border-amber-500 bg-amber-200/95 dark:bg-amber-950/80 shadow-[3px_3px_0px_#000] pl-5"
                      : "border-sky-300 bg-sky-50/80 shadow-sm dark:border-sky-800 dark:bg-sky-950/40"
                    : isPixelTheme
                    ? "border-2 border-border/80 bg-card hover:bg-amber-100/60 dark:hover:bg-amber-950/40 shadow-[2px_2px_0px_rgba(0,0,0,0.06)] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                    : "border-border/60 hover:bg-accent/60"
                )}
              >
                {/* Retro Pixel Active Indicator Arrow */}
                {isPixelTheme && isCurrent && (
                  <span
                    className="absolute left-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center select-none pointer-events-none"
                    aria-hidden="true"
                  >
                    <span className="text-amber-800 dark:text-amber-400 text-[8px] leading-none font-mono font-black animate-pixel-hop block">
                      ▶
                    </span>
                  </span>
                )}
                <div className="flex items-start gap-2.5">
                  <ProgressRing completed={done} total={taskSet.length} isPixelTheme={isPixelTheme} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className={cn("truncate text-xs font-bold text-foreground", isPixelTheme && "font-mono")}>
                        {project.name}
                      </span>
                      <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span
                        className={cn(
                          "inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold border",
                          isPixelTheme ? "rounded-xs font-mono border-black/40 shadow-[1px_1px_0px_#000]" : "rounded-md",
                          priorityClasses[project.priority]
                        )}
                      >
                        {PRIORITY_LABELS[project.priority]}
                      </span>

                      {/* Smart Status in sidebar */}
                      <span
                        className={cn(
                          "inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold shrink-0 border",
                          smart.sidebarBadgeClasses
                        )}
                      >
                        <span>{smart.sidebarLabel}</span>
                      </span>

                      {project.endDate && (
                        <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">
                          {project.endDate.slice(5)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}

          {filteredProjects.length === 0 && (
            <div className="px-3 py-12 text-center text-xs text-muted-foreground space-y-1">
              <FolderKanban className="mx-auto mb-2 size-7 opacity-40" />
              <p>{searchQuery || statusFilter !== "all" ? "未找到符合条件的项目" : "还没有项目"}</p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Details Panel */}
      {selected ? (
        <section className="flex-1 h-full min-w-0 overflow-y-auto">
          <div className="mx-auto max-w-5xl p-4 lg:p-5 space-y-3">
            {/* Header: Title & Status & Actions */}
            <div
              className={cn(
                "flex items-center justify-between gap-3 border-b pb-2.5",
                isPixelTheme ? "border-b-2 border-border/80 font-mono" : "border-border"
              )}
            >
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
                  className={cn(
                    "w-full bg-transparent px-1.5 py-0.5 text-base sm:text-lg font-bold text-foreground outline-none transition-colors",
                    isPixelTheme
                      ? "rounded-xs border-2 border-transparent hover:border-border/60 focus:border-amber-600 focus:bg-background font-mono"
                      : "rounded-lg hover:bg-muted/40 focus:bg-background focus:ring-2 focus:ring-ring"
                  )}
                  aria-label="项目名称"
                  placeholder="项目名称"
                />
              </div>

              {/* Status Badge & 3-Dots Dropdown Menu */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Dynamic Smart Computed Status Badge */}
                {(() => {
                  const smart = getProjectSmartStatus(selected);
                  return (
                    <div
                      className={cn(
                        "inline-flex h-8 items-center justify-center px-3 text-xs font-semibold select-none shadow-2xs",
                        smart.badgeClasses
                      )}
                      title={`项目状态：${smart.label}`}
                    >
                      <span>{smart.label}</span>
                    </div>
                  );
                })()}

                {/* 3-dots Dropdown Menu (Archive & Delete) */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={busy}
                      className={cn(
                        "size-8 text-muted-foreground hover:text-foreground cursor-pointer shrink-0",
                        isPixelTheme && "rounded-xs border border-border bg-muted shadow-[1px_1px_0px_#000]"
                      )}
                      title="更多项目操作"
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className={cn("min-w-28", isPixelTheme && "font-mono border-2")}>
                    <DropdownMenuItem
                      onClick={() =>
                        void run(() =>
                          saveProject({
                            ...selected,
                            status: selected.status === "archived" ? "not_started" : "archived",
                          })
                        )
                      }
                      className="gap-1.5 cursor-pointer"
                    >
                      {selected.status === "archived" ? (
                        <>
                          <ArchiveRestore className="size-3.5 text-amber-600 shrink-0" />
                          <span>移出归档</span>
                        </>
                      ) : (
                        <>
                          <Archive className="size-3.5 shrink-0" />
                          <span>归档项目</span>
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      destructive
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
                      className="gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="size-3.5 shrink-0" />
                      <span>删除项目</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Description */}
            <div>
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
                className={cn(
                  "w-full resize-y bg-transparent p-2 text-xs leading-relaxed text-muted-foreground outline-none transition-colors",
                  isPixelTheme
                    ? "rounded-xs border-2 border-transparent hover:border-border/60 focus:border-amber-600 focus:bg-background focus:text-foreground font-mono"
                    : "rounded-lg border border-transparent hover:border-border/60 focus:border-border focus:bg-background focus:text-foreground"
                )}
              />
            </div>

            {/* Properties Bar: 2-Column Grid (Row 1: Priority & Owner; Row 2: Timeline & Tags) */}
            <div
              className={cn(
                "grid grid-cols-1 gap-2.5 p-3 sm:grid-cols-2",
                isPixelTheme
                  ? "rounded-xs border-2 border-border/90 bg-amber-50/40 dark:bg-amber-950/20 shadow-[2px_2px_0px_rgba(0,0,0,0.06)] font-mono"
                  : "rounded-xl border border-border/80 bg-muted/20"
              )}
            >
              {/* Priority */}
              <div className="flex items-center gap-2">
                <Flag className="size-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground shrink-0">优先级</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      disabled={busy}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer select-none",
                        isPixelTheme
                          ? "rounded-xs border-2 border-border bg-muted/60 hover:bg-muted font-mono shadow-[1px_1px_0px_#000]"
                          : "rounded-lg border border-border/80 bg-background hover:bg-accent shadow-2xs text-foreground"
                      )}
                    >
                      <span
                        className={cn(
                          "size-2 rounded-full shrink-0",
                          selected.priority === "urgent"
                            ? "bg-rose-500"
                            : selected.priority === "high"
                            ? "bg-amber-500"
                            : selected.priority === "medium"
                            ? "bg-sky-500"
                            : "bg-slate-400"
                        )}
                      />
                      <span>{PRIORITY_LABELS[selected.priority]}优先级</span>
                      <ChevronDown className="size-3 opacity-60 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-36">
                    {(Object.entries(PRIORITY_LABELS) as [Priority, string][]).map(([val, label]) => {
                      const isSelected = selected.priority === val;
                      return (
                        <DropdownMenuItem
                          key={val}
                          onClick={() => void run(() => saveProject({ ...selected, priority: val }))}
                          className={cn(
                            "justify-between cursor-pointer",
                            isSelected && (isPixelTheme ? "bg-accent font-bold" : "bg-accent font-semibold")
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "size-2 rounded-full shrink-0",
                                val === "urgent"
                                  ? "bg-rose-500"
                                  : val === "high"
                                  ? "bg-amber-500"
                                  : val === "medium"
                                  ? "bg-sky-500"
                                  : "bg-slate-400"
                              )}
                            />
                            <span>{label}优先级</span>
                          </div>
                          {isSelected && <Check size={12} className="text-foreground shrink-0 ml-1" />}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Owner */}
              <div className="flex items-center gap-2">
                <Users className="size-3.5 text-muted-foreground shrink-0" />
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
                  className={cn(
                    "h-6.5 min-w-0 flex-1 bg-transparent px-1.5 text-xs text-foreground outline-none",
                    isPixelTheme
                      ? "rounded-xs border border-transparent hover:border-border focus:border-amber-600 focus:bg-background font-mono"
                      : "rounded-md border border-transparent hover:border-border focus:border-border focus:bg-background"
                  )}
                />
              </div>

              {/* Timeline (Row 2 Col 1) */}
              <div className="flex items-center gap-2">
                <Calendar className="size-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground shrink-0">周期</span>
                <DateRangePicker
                  size="mini"
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
                  className="h-6.5 text-xs flex-1 max-w-[220px]"
                />
              </div>

              {/* Tags (Row 2 Col 2 - Arco InputTag on same horizontal row) */}
              <div className="flex items-center gap-2 min-w-0">
                <Tag className="size-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground shrink-0">标签</span>
                <div className="flex-1 min-w-0">
                  <InputTag
                    size="mini"
                    allowClear
                    saveOnBlur
                    disabled={busy}
                    value={selected.tags}
                    placeholder={selected.tags.length === 0 ? "输入标签后按回车..." : ""}
                    onChange={(nextTags) => {
                      void run(() => saveProject({ ...selected, tags: nextTags }));
                    }}
                    className={cn(
                      "w-full text-xs min-h-[26px]",
                      isPixelTheme && "font-mono rounded-xs border-2 border-border"
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Unified View Control Bar (Option 1) */}
            <div
              className={cn(
                "flex items-center justify-between gap-3 border-b pb-2 pt-1 select-none",
                isPixelTheme ? "border-b-2 border-border/80 font-mono" : "border-border/70"
              )}
            >
              {/* Left: View Tabs */}
              <div
                className={cn(
                  "inline-flex items-center gap-1 p-0.5 rounded-lg border",
                  isPixelTheme
                    ? "rounded-xs border border-border bg-muted/60 font-mono shadow-[1px_1px_0px_#000]"
                    : "border-border/60 bg-muted/40"
                )}
              >
                {[
                  { mode: "kanban" as ProjectViewMode, label: "阶段看板", icon: Kanban },
                  { mode: "gantt" as ProjectViewMode, label: "单体甘特", icon: Activity },
                  { mode: "table" as ProjectViewMode, label: "紧凑表格", icon: TableIcon },
                ].map((v) => {
                  const Icon = v.icon;
                  const isActive = viewMode === v.mode;
                  return (
                    <button
                      key={v.mode}
                      type="button"
                      onClick={() => setViewMode(v.mode)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer",
                        isActive
                          ? isPixelTheme
                            ? "rounded-xs bg-amber-500 text-amber-950 font-bold border border-amber-900 shadow-[1px_1px_0px_#000]"
                            : "rounded-md bg-background text-foreground shadow-2xs font-bold"
                          : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                      )}
                    >
                      <Icon size={13} />
                      <span>{v.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Right: Summary + View Context Action (Add Stage) */}
              <div className="flex items-center gap-3">
                <div className="text-xs text-muted-foreground font-medium hidden sm:flex items-center gap-1.5 select-none">
                  <span>{selectedStages.length} 个阶段</span>
                  <span>•</span>
                  <span>{selectedTasks.length} 项任务</span>
                </div>

                {viewMode === "kanban" && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        saveStage({
                          id: createProjectStageId(),
                          projectId: selected.id,
                          name: `阶段 ${selectedStages.length + 1}`,
                          sortOrder: 0,
                        })
                      )
                    }
                    className={cn(
                      "h-7 px-2.5 text-xs gap-1 cursor-pointer shrink-0",
                      isPixelTheme
                        ? "rounded-xs border border-border bg-amber-400 text-amber-950 shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] font-mono font-bold"
                        : "rounded-lg hover:bg-accent border border-border/80"
                    )}
                    variant="outline"
                  >
                    <Plus className="size-3.5" />
                    <span>添加阶段</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Views Distribution */}
            {viewMode === "kanban" && (
              <ProjectStageBoard
                stages={selectedStages}
                tasks={selectedTasks}
                disabled={busy}
                onCreateStage={(name) => run(() => saveStage({ id: createProjectStageId(), projectId: selected.id, name, sortOrder: 0 }))}
                onSaveStage={(stage) => run(() => saveStage(stage))}
                onReorderStages={(stageIds) => reorderStages(selected.id, stageIds)}
                onDeleteStage={(stage) =>
                  confirm({
                    title: `删除阶段“${stage.name}”？`,
                    description: "该阶段中的任务也会移入已删除状态。",
                    confirmText: "删除阶段",
                  }).then((confirmed) => {
                    if (confirmed) void run(() => deleteStage(stage.id));
                  })
                }
                onSaveTask={(task) => saveTask(task)}
                onDeleteTask={(taskId) => deleteTask(taskId)}
              />
            )}

            {viewMode === "gantt" && (
              <ProjectGanttView
                project={selected}
                stages={selectedStages}
                tasks={selectedTasks}
                disabled={busy}
                onSaveStage={(stage) => run(() => saveStage(stage))}
                onSaveTask={(task) => saveTask(task)}
                onDeleteTask={(taskId) => deleteTask(taskId)}
              />
            )}

            {viewMode === "table" && (
              <ProjectTableView
                project={selected}
                stages={selectedStages}
                tasks={selectedTasks}
                disabled={busy}
                onSaveTask={(task) => saveTask(task)}
                onDeleteTask={(taskId) => deleteTask(taskId)}
              />
            )}

            {actionError && (
              <p className="mt-4 text-sm text-destructive font-mono" role="alert">
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
      <TemplateEditorModal open={creatingTemplate} onOpenChange={setCreatingTemplate} onSave={saveTemplate} />
      {dialogElement}
    </div>
  );
}
