import { useState, useMemo } from "react";
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  ExternalLink,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  UserRound,
  Calendar,
  Layers,
  Flag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProjectsData } from "@/hooks/useProjects";
import { openQuickEditWindow } from "@/services/quickEditWindow";
import { createTaskId } from "@/lib/entityIds";
import { formatDateYMD } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { PixelScroll } from "@/components/pixel/PixelIcons";
import type { Project, ProjectStage, ProjectTask, Priority } from "@/types/projects";

interface ProjectTableViewProps {
  project: Project;
  stages: ProjectStage[];
  tasks: ProjectTask[];
  disabled?: boolean;
  onSaveTask: (task: ProjectTask) => void;
  onDeleteTask: (taskId: string) => void;
}

type SortField = "title" | "stage" | "priority" | "dueDate" | "completed";
type SortDirection = "asc" | "desc";

const PRIORITY_WEIGHTS: Record<Priority, number> = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4,
};

const PRIORITY_CONFIG: Record<Priority, { label: string; pixelLabel: string; modernClass: string; pixelClass: string }> = {
  low: {
    label: "低",
    pixelLabel: "🟢 简易",
    modernClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300/40",
    pixelClass: "rounded-xs bg-emerald-200 text-emerald-950 border border-emerald-700 shadow-[1px_1px_0px_#000]",
  },
  medium: {
    label: "中",
    pixelLabel: "🟡 普通",
    modernClass: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300/40",
    pixelClass: "rounded-xs bg-blue-200 text-blue-950 border border-blue-700 shadow-[1px_1px_0px_#000]",
  },
  high: {
    label: "高",
    pixelLabel: "🔴 困难",
    modernClass: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300/40",
    pixelClass: "rounded-xs bg-amber-200 text-amber-950 border border-amber-700 shadow-[1px_1px_0px_#000]",
  },
  urgent: {
    label: "紧急",
    pixelLabel: "🔥 史诗",
    modernClass: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-300/40",
    pixelClass: "rounded-xs bg-red-200 text-red-950 border border-red-700 shadow-[1px_1px_0px_#000]",
  },
};

export function ProjectTableView({
  project,
  stages,
  tasks,
  disabled,
  onSaveTask,
  onDeleteTask,
}: ProjectTableViewProps) {
  const { isPixelTheme } = useAppThemeStyle();
  const { data: pData } = useProjectsData();
  const allProjects = pData?.projects ?? [];
  const allStages = pData?.stages ?? [];

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "completed">("all");

  // Sort State
  const [sortField, setSortField] = useState<SortField>("dueDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Quick Add State
  const [quickTitle, setQuickTitle] = useState("");
  const [quickStageId, setQuickStageId] = useState<string>(() => stages[0]?.id ?? "");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const stageMap = useMemo(() => {
    const map = new Map<string, ProjectStage>();
    stages.forEach((s) => map.set(s.id, s));
    return map;
  }, [stages]);

  // Filtered & Sorted Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (stageFilter !== "all" && t.projectStageId !== stageFilter) return false;
      if (statusFilter === "pending" && t.completed) return false;
      if (statusFilter === "completed" && !t.completed) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchAssignee = t.assigneeName?.toLowerCase().includes(q);
        const stageName = (t.projectStageId ? stageMap.get(t.projectStageId)?.name : "") || "";
        const matchStage = stageName.toLowerCase().includes(q);
        return matchTitle || matchAssignee || matchStage;
      }
      return true;
    });
  }, [tasks, stageFilter, statusFilter, searchQuery, stageMap]);

  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      let cmp = 0;
      if (sortField === "title") {
        cmp = a.title.localeCompare(b.title, "zh-CN");
      } else if (sortField === "stage") {
        const stageA = (a.projectStageId ? stageMap.get(a.projectStageId)?.sortOrder : 999) ?? 999;
        const stageB = (b.projectStageId ? stageMap.get(b.projectStageId)?.sortOrder : 999) ?? 999;
        cmp = stageA - stageB;
      } else if (sortField === "priority") {
        const pA = a.priority || "medium";
        const pB = b.priority || "medium";
        cmp = PRIORITY_WEIGHTS[pB] - PRIORITY_WEIGHTS[pA];
      } else if (sortField === "dueDate") {
        const timeA = a.scheduledEndAt || a.scheduledStartAt || 9999999999999;
        const timeB = b.scheduledEndAt || b.scheduledStartAt || 9999999999999;
        cmp = timeA - timeB;
      } else if (sortField === "completed") {
        cmp = Number(a.completed) - Number(b.completed);
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [filteredTasks, sortField, sortDirection, stageMap]);

  // Quick Add submit
  const handleQuickAdd = () => {
    if (!quickTitle.trim() || disabled) return;
    const targetStageId = quickStageId || stages[0]?.id;
    const stage = targetStageId ? stageMap.get(targetStageId) : undefined;

    const newTask: ProjectTask = {
      id: createTaskId(),
      projectId: project.id,
      projectStageId: targetStageId || undefined,
      title: quickTitle.trim(),
      assigneeName: stage?.defaultAssigneeName,
      priority: "medium",
      completed: false,
      quadrant: "Q2",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    onSaveTask(newTask);
    setQuickTitle("");
  };

  const handleCyclePriority = (task: ProjectTask) => {
    const current = task.priority || "medium";
    const order: Priority[] = ["low", "medium", "high", "urgent"];
    const nextIdx = (order.indexOf(current) + 1) % order.length;
    onSaveTask({ ...task, priority: order[nextIdx] });
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={12} className="opacity-40" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp size={12} className="text-primary" />
    ) : (
      <ArrowDown size={12} className="text-primary" />
    );
  };

  return (
    <div
      className={cn(
        "flex flex-col bg-card overflow-hidden transition-all",
        isPixelTheme
          ? "rounded-xs border-2 border-border/90 shadow-[3px_3px_0px_rgba(0,0,0,0.08)] font-mono"
          : "rounded-xl border border-border shadow-2xs"
      )}
    >
      {/* Top Filter Toolbar */}
      <header
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 p-3.5 border-b select-none",
          isPixelTheme ? "border-b-2 border-border/90 bg-amber-50/30 dark:bg-amber-950/30 font-mono" : "border-border bg-muted/20"
        )}
      >
        {/* Search */}
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
          <div
            className={cn(
              "flex items-center gap-2 h-8 px-2.5 bg-background border flex-1",
              isPixelTheme ? "rounded-xs border-2 border-border font-mono shadow-[1px_1px_0px_#000]" : "rounded-lg border-border"
            )}
          >
            <Search size={14} className="text-muted-foreground shrink-0" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索任务名称、负责人..."
              className="bg-transparent text-xs text-foreground outline-none w-full"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Stage Filter */}
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className={cn(
              "h-8 px-2.5 text-xs outline-none transition-colors cursor-pointer text-foreground",
              isPixelTheme
                ? "rounded-xs border-2 border-border bg-muted/60 hover:bg-muted focus:border-amber-600 focus:bg-background font-mono shadow-[1px_1px_0px_#000]"
                : "rounded-lg border border-border/80 bg-background hover:bg-accent"
            )}
          >
            <option value="all">全部阶段 ({tasks.length})</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({tasks.filter((t) => t.projectStageId === s.id).length})
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | "pending" | "completed")}
            className={cn(
              "h-8 px-2.5 text-xs outline-none transition-colors cursor-pointer text-foreground",
              isPixelTheme
                ? "rounded-xs border-2 border-border bg-muted/60 hover:bg-muted focus:border-amber-600 focus:bg-background font-mono shadow-[1px_1px_0px_#000]"
                : "rounded-lg border border-border/80 bg-background hover:bg-accent"
            )}
          >
            <option value="all">全部状态</option>
            <option value="pending">仅未完成</option>
            <option value="completed">仅已完成</option>
          </select>
        </div>
      </header>

      {/* Main Table */}
      <div className="overflow-x-auto min-h-[320px] max-h-[560px]">
        <table className="w-full text-left text-xs border-collapse">
          {/* Table Header */}
          <thead
            className={cn(
              "sticky top-0 z-10 border-b select-none",
              isPixelTheme ? "border-b-2 border-border/90 bg-amber-100/60 dark:bg-amber-950/60 font-mono" : "border-border bg-muted/60"
            )}
          >
            <tr>
              {/* Checkbox */}
              <th
                onClick={() => handleSort("completed")}
                className="w-10 px-3 py-2.5 text-center cursor-pointer hover:bg-accent/40"
              >
                <div className="flex items-center justify-center gap-1">
                  <CheckCircle2 size={13} className="opacity-70" />
                </div>
              </th>

              {/* Title */}
              <th
                onClick={() => handleSort("title")}
                className="px-3 py-2.5 cursor-pointer hover:bg-accent/40 font-bold text-foreground"
              >
                <div className="flex items-center gap-1.5">
                  <span>任务名称</span>
                  {renderSortIcon("title")}
                </div>
              </th>

              {/* Stage */}
              <th
                onClick={() => handleSort("stage")}
                className="w-36 px-3 py-2.5 cursor-pointer hover:bg-accent/40 font-bold text-foreground"
              >
                <div className="flex items-center gap-1.5">
                  <Layers size={13} className="opacity-70" />
                  <span>所属阶段</span>
                  {renderSortIcon("stage")}
                </div>
              </th>

              {/* Priority */}
              <th
                onClick={() => handleSort("priority")}
                className="w-24 px-3 py-2.5 cursor-pointer hover:bg-accent/40 font-bold text-foreground"
              >
                <div className="flex items-center gap-1.5">
                  <Flag size={13} className="opacity-70" />
                  <span>优先级</span>
                  {renderSortIcon("priority")}
                </div>
              </th>

              {/* Assignee */}
              <th className="w-28 px-3 py-2.5 font-bold text-foreground">
                <div className="flex items-center gap-1.5">
                  <UserRound size={13} className="opacity-70" />
                  <span>负责人</span>
                </div>
              </th>

              {/* Due Date */}
              <th
                onClick={() => handleSort("dueDate")}
                className="w-36 px-3 py-2.5 cursor-pointer hover:bg-accent/40 font-bold text-foreground"
              >
                <div className="flex items-center gap-1.5">
                  <Calendar size={13} className="opacity-70" />
                  <span>截止日期</span>
                  {renderSortIcon("dueDate")}
                </div>
              </th>

              {/* Actions */}
              <th className="w-16 px-3 py-2.5 text-right font-bold text-muted-foreground">操作</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-border/50">
            {sortedTasks.map((task) => {
              const stage = task.projectStageId ? stageMap.get(task.projectStageId) : undefined;
              const pConfig = PRIORITY_CONFIG[task.priority || "medium"] || PRIORITY_CONFIG.medium;
              const dateDisplay = task.scheduledEndAt
                ? formatDateYMD(new Date(task.scheduledEndAt))
                : task.scheduledStartAt
                ? formatDateYMD(new Date(task.scheduledStartAt))
                : "未设截止日";

              return (
                <tr
                  key={task.id}
                  className={cn(
                    "group transition-colors",
                    task.completed
                      ? "opacity-60 bg-muted/10 hover:opacity-100 hover:bg-muted/30"
                      : "hover:bg-accent/40"
                  )}
                >
                  {/* Status Checkbox */}
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        onSaveTask({
                          ...task,
                          completed: !task.completed,
                          completedAt: !task.completed ? Date.now() : undefined,
                        })
                      }
                      className="cursor-pointer text-muted-foreground hover:text-foreground inline-flex items-center justify-center"
                    >
                      {task.completed ? (
                        <CheckCircle2 size={16} className="text-emerald-600 fill-emerald-600/20" />
                      ) : (
                        <Circle size={16} />
                      )}
                    </button>
                  </td>

                  {/* Task Title */}
                  <td className="px-3 py-2">
                    <input
                      key={`title-${task.id}`}
                      defaultValue={task.title}
                      onBlur={(e) => {
                        const val = e.target.value.trim();
                        if (val && val !== task.title) {
                          onSaveTask({ ...task, title: val });
                        }
                      }}
                      className={cn(
                        "w-full bg-transparent text-xs font-medium outline-none transition-colors",
                        task.completed && "line-through text-muted-foreground",
                        isPixelTheme && "font-mono"
                      )}
                    />
                  </td>

                  {/* Stage Dropdown */}
                  <td className="px-3 py-2">
                    <select
                      value={task.projectStageId ?? ""}
                      disabled={disabled}
                      onChange={(e) => onSaveTask({ ...task, projectStageId: e.target.value || undefined })}
                      className={cn(
                        "h-6.5 px-2 text-[11px] outline-none transition-colors cursor-pointer w-full max-w-[130px] text-foreground",
                        isPixelTheme
                          ? "rounded-xs border-2 border-border bg-muted/60 hover:bg-muted focus:border-amber-600 focus:bg-background font-mono shadow-[1px_1px_0px_#000]"
                          : "rounded-md border border-border/80 bg-background hover:bg-accent"
                      )}
                    >
                      <option value="">未分类阶段</option>
                      {stages.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Priority Button */}
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => handleCyclePriority(task)}
                      className={cn(
                        "px-2 py-0.5 text-[11px] font-bold cursor-pointer transition-all shrink-0 select-none",
                        isPixelTheme ? pConfig.pixelClass : cn("rounded-md border", pConfig.modernClass)
                      )}
                      title="点击切换优先级"
                    >
                      {isPixelTheme ? pConfig.pixelLabel : pConfig.label}
                    </button>
                  </td>

                  {/* Assignee Input */}
                  <td className="px-3 py-2">
                    <input
                      key={`assignee-${task.id}`}
                      defaultValue={task.assigneeName ?? ""}
                      placeholder={stage?.defaultAssigneeName || "未指定"}
                      onBlur={(e) => {
                        const val = e.target.value.trim();
                        if (val !== (task.assigneeName ?? "")) {
                          onSaveTask({ ...task, assigneeName: val || undefined });
                        }
                      }}
                      className="w-full bg-transparent text-[11px] outline-none text-foreground placeholder:text-muted-foreground/40"
                    />
                  </td>

                  {/* Due Date */}
                  <td className="px-3 py-2 text-muted-foreground text-[11px]">
                    <div className="flex items-center gap-1">
                      <span>{dateDisplay}</span>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => {
                          void openQuickEditWindow({
                            task,
                            projects: allProjects,
                            stages: allStages,
                            anchorEl: e.currentTarget,
                            onCommit: (taskId, updates) => {
                              void onSaveTask({ ...task, ...updates, id: taskId });
                            },
                            onClosed: () => {},
                          });
                        }}
                        className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                        title="打开详情浮窗"
                      >
                        <ExternalLink size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteTask(task.id)}
                        className="p-1 text-muted-foreground hover:text-destructive cursor-pointer"
                        title="删除任务"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {/* Empty State */}
            {sortedTasks.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  <div className="flex flex-col items-center gap-1.5">
                    {isPixelTheme ? <PixelScroll size={22} className="opacity-60" /> : <Layers size={22} className="opacity-40" />}
                    <p className={isPixelTheme ? "font-mono font-bold" : ""}>
                      {searchQuery || stageFilter !== "all" || statusFilter !== "all"
                        ? "没有找到符合条件的任务"
                        : "暂无任务，可在下方快速添加"}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom Quick Add Row */}
      <footer
        className={cn(
          "p-2.5 px-3.5 border-t flex flex-wrap items-center gap-2 bg-muted/20 select-none",
          isPixelTheme ? "border-t-2 border-border/90 bg-amber-50/40 dark:bg-amber-950/30 font-mono" : "border-border"
        )}
      >
        <Plus size={15} className="text-muted-foreground shrink-0" />
        <input
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleQuickAdd()}
          placeholder="+ 单行回车极速添加任务到项目..."
          className="flex-1 bg-transparent text-xs text-foreground outline-none min-w-[200px]"
        />

        {stages.length > 0 && (
          <select
            value={quickStageId}
            onChange={(e) => setQuickStageId(e.target.value)}
            className={cn(
              "h-7 px-2 text-[11px] outline-none transition-colors cursor-pointer text-foreground",
              isPixelTheme
                ? "rounded-xs border-2 border-border bg-muted/60 hover:bg-muted focus:border-amber-600 focus:bg-background font-mono shadow-[1px_1px_0px_#000]"
                : "rounded-md border border-border/80 bg-background hover:bg-accent"
            )}
          >
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                归属：{s.name}
              </option>
            ))}
          </select>
        )}

        <Button
          size="sm"
          disabled={!quickTitle.trim()}
          onClick={handleQuickAdd}
          className={cn(
            "h-7 text-xs px-2.5",
            isPixelTheme && "rounded-xs border-2 border-amber-900 bg-amber-500 text-amber-950 font-bold shadow-[1px_1px_0px_#000]"
          )}
        >
          添加
        </Button>
      </footer>
    </div>
  );
}
