import React, { useState } from "react";
import {
  X,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  UserRound,
  Layers,
  ListTodo,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QUADRANT_DB_MAP } from "@/types/timeManagement";
import type { Priority, ProjectTemplate, ProjectTemplateDefinition, ProjectTemplateStage, ProjectTemplateTask } from "@/types/projects";
import { createProjectTemplateId } from "@/lib/entityIds";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { PixelSword, PixelShield, PixelScroll } from "@/components/pixel/PixelIcons";
import { cn } from "@/lib/utils";

export interface TemplateEditorModalProps {
  open: boolean;
  template?: ProjectTemplate;
  onOpenChange: (open: boolean) => void;
  onSave: (template: ProjectTemplate) => Promise<void>;
}

const PRIORITIES: Array<{ key: Priority; label: string; pixelLabel: string }> = [
  { key: "low", label: "低", pixelLabel: "🟢 简易" },
  { key: "medium", label: "中", pixelLabel: "🟡 普通" },
  { key: "high", label: "高", pixelLabel: "🔴 困难" },
  { key: "urgent", label: "紧急", pixelLabel: "🔥 史诗" },
];

const DEFAULT_STAGES: ProjectTemplateStage[] = [
  { key: "stage_review", name: "需求评审", defaultAssigneeName: "产品" },
  { key: "stage_dev", name: "核心研发", defaultAssigneeName: "开发" },
  { key: "stage_test", name: "测试验收", defaultAssigneeName: "测试" },
  { key: "stage_release", name: "发布上线", defaultAssigneeName: "产品" },
];

const DEFAULT_TASKS: ProjectTemplateTask[] = [
  { stageKey: "stage_review", title: "需求 PRD 评审与定稿", assigneeName: "产品", priority: "high", quadrant: QUADRANT_DB_MAP.Q2 },
  { stageKey: "stage_dev", title: "数据库设计与核心接口实现", assigneeName: "开发", priority: "high", quadrant: QUADRANT_DB_MAP.Q2 },
  { stageKey: "stage_test", title: "集成测试与边界用例验收", assigneeName: "测试", priority: "medium", quadrant: QUADRANT_DB_MAP.Q2 },
  { stageKey: "stage_release", title: "生产环境部署与监控验证", assigneeName: "产品", priority: "high", quadrant: QUADRANT_DB_MAP.Q2 },
];

export function TemplateEditorModal({
  open,
  template,
  onOpenChange,
  onSave,
}: TemplateEditorModalProps) {
  const { isPixelTheme } = useAppThemeStyle();
  const [name, setName] = useState(() => template?.name ?? "");
  const [description, setDescription] = useState(() => template?.description ?? "");

  // Stages & Tasks State
  const [stages, setStages] = useState<ProjectTemplateStage[]>(() => {
    if (template?.definition.stages && template.definition.stages.length > 0) {
      return template.definition.stages.map((s, idx) => ({
        key: s.key || `stage_${idx}_${Date.now()}`,
        name: s.name,
        defaultAssigneeName: s.defaultAssigneeName,
      }));
    }
    return DEFAULT_STAGES;
  });

  const [tasks, setTasks] = useState<ProjectTemplateTask[]>(() => {
    if (template?.definition.tasks && template.definition.tasks.length > 0) {
      return template.definition.tasks.map((t) => ({
        stageKey: t.stageKey || (template.definition.stages[0]?.key ?? "stage_0"),
        title: t.title,
        assigneeName: t.assigneeName,
        priority: t.priority ?? "medium",
        description: t.description,
        quadrant: t.quadrant ?? QUADRANT_DB_MAP.Q2,
      }));
    }
    return DEFAULT_TASKS;
  });

  // Stage adding inputs
  const [newStageName, setNewStageName] = useState("");
  const [newStageAssignee, setNewStageAssignee] = useState("");
  const [isAddingStage, setIsAddingStage] = useState(false);

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Re-sync on template change
  React.useEffect(() => {
    if (open) {
      setName(template?.name ?? "");
      setDescription(template?.description ?? "");
      if (template?.definition.stages && template.definition.stages.length > 0) {
        setStages(template.definition.stages);
        setTasks(template.definition.tasks);
      } else if (!template) {
        setStages(DEFAULT_STAGES);
        setTasks(DEFAULT_TASKS);
      }
      setError("");
      setIsAddingStage(false);
    }
  }, [open, template]);

  // Stage Handlers
  const handleAddStage = () => {
    if (!newStageName.trim()) return;
    const stageKey = `stage_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newStage: ProjectTemplateStage = {
      key: stageKey,
      name: newStageName.trim(),
      defaultAssigneeName: newStageAssignee.trim() || undefined,
    };
    setStages((prev) => [...prev, newStage]);
    setNewStageName("");
    setNewStageAssignee("");
    setIsAddingStage(false);
  };

  const handleUpdateStage = (key: string, updates: Partial<ProjectTemplateStage>) => {
    setStages((prev) =>
      prev.map((s) => (s.key === key ? { ...s, ...updates } : s))
    );
  };

  const handleMoveStage = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= stages.length) return;
    setStages((prev) => {
      const clone = [...prev];
      const [item] = clone.splice(index, 1);
      clone.splice(targetIdx, 0, item);
      return clone;
    });
  };

  const handleDeleteStage = (key: string) => {
    if (stages.length <= 1) {
      setError("模板必须保留至少一个阶段");
      return;
    }
    const remainingStages = stages.filter((s) => s.key !== key);
    const fallbackStageKey = remainingStages[0]?.key;
    setStages(remainingStages);
    // Re-assign orphaned tasks to fallback stage
    setTasks((prev) =>
      prev.map((t) => (t.stageKey === key ? { ...t, stageKey: fallbackStageKey } : t))
    );
  };

  // Task Handlers
  const handleAddTask = (stageKey: string) => {
    const stage = stages.find((s) => s.key === stageKey);
    const newTask: ProjectTemplateTask = {
      stageKey,
      title: "",
      assigneeName: stage?.defaultAssigneeName,
      priority: "medium",
      quadrant: QUADRANT_DB_MAP.Q2,
    };
    setTasks((prev) => [...prev, newTask]);
  };

  const handleUpdateTask = (index: number, updates: Partial<ProjectTemplateTask>) => {
    setTasks((prev) =>
      prev.map((t, idx) => (idx === index ? { ...t, ...updates } : t))
    );
  };

  const handleDeleteTask = (index: number) => {
    setTasks((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleCyclePriority = (taskIndex: number) => {
    const current = tasks[taskIndex]?.priority ?? "medium";
    const order: Priority[] = ["low", "medium", "high", "urgent"];
    const nextIdx = (order.indexOf(current) + 1) % order.length;
    handleUpdateTask(taskIndex, { priority: order[nextIdx] });
  };

  // Submit
  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("请填写模板名称");
      return;
    }
    if (stages.length === 0) {
      setError("请至少添加一个阶段");
      return;
    }
    if (stages.some((s) => !s.name.trim())) {
      setError("阶段名称不能为空");
      return;
    }
    // Filter out completely blank task rows
    const validTasks = tasks.filter((t) => t.title.trim().length > 0);

    const definition: ProjectTemplateDefinition = {
      stages: stages.map((s) => ({
        key: s.key,
        name: s.name.trim(),
        defaultAssigneeName: s.defaultAssigneeName?.trim() || undefined,
      })),
      tasks: validTasks.map((t) => ({
        stageKey: t.stageKey,
        title: t.title.trim(),
        assigneeName: t.assigneeName?.trim() || undefined,
        priority: t.priority ?? "medium",
        description: t.description?.trim() || undefined,
        quadrant: t.quadrant ?? QUADRANT_DB_MAP.Q2,
      })),
    };

    setSaving(true);
    setError("");
    try {
      await onSave({
        id: template?.id ?? createProjectTemplateId(),
        name: name.trim(),
        description: description.trim() || undefined,
        definition,
        updatedAt: template?.updatedAt ?? 0,
      });
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存模板失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden",
          isPixelTheme ? "font-mono border-2 border-border/90 rounded-xs shadow-[6px_6px_0px_rgba(0,0,0,0.3)]" : "rounded-xl"
        )}
        onClose={() => onOpenChange(false)}
      >
        {/* Header */}
        <DialogHeader
          className={cn(
            "p-6 pb-4 shrink-0 border-b select-none",
            isPixelTheme ? "border-b-2 border-border/90 bg-amber-50/40 dark:bg-amber-950/30 font-mono" : "border-border"
          )}
        >
          <DialogTitle className={cn("flex items-center gap-2", isPixelTheme ? "font-mono font-bold text-base" : "")}>
            {isPixelTheme ? <PixelSword size={18} /> : <Layers size={18} className="text-primary" />}
            <span>
              {template
                ? isPixelTheme
                  ? "📜 编辑公会战术蓝图 (项目模板)"
                  : "编辑项目模板"
                : isPixelTheme
                ? "✨ 新建公会战术蓝图 (项目模板)"
                : "新建项目模板"}
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            {isPixelTheme
              ? "编排冒险阶段与预设委托任务，创建项目时将一键生成全套进度看板。"
              : "结构化配置阶段流程与预设任务，创建项目时将按此模版一键初始化看板。"}
          </DialogDescription>
        </DialogHeader>

        {/* Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Info */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={cn("text-xs font-semibold text-foreground flex items-center gap-1", isPixelTheme && "font-mono")}>
                <span>模板名称</span>
                <span className="text-destructive">*</span>
              </label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isPixelTheme ? "例如：🚀 敏捷软件开发流程" : "例如：敏捷软件开发流程"}
                className={cn(
                  "h-9 w-full bg-background px-3 text-sm outline-none transition-colors",
                  isPixelTheme
                    ? "rounded-xs border-2 border-border/90 focus:border-amber-600 font-mono shadow-[1px_1px_0px_#000]"
                    : "rounded-lg border border-border focus:ring-1 focus:ring-ring"
                )}
              />
            </div>

            <div className="space-y-1.5">
              <label className={cn("text-xs font-semibold text-foreground", isPixelTheme && "font-mono")}>
                模板说明 (可选)
              </label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={isPixelTheme ? "例如：包含需求、研发、测试与上线全流程" : "简要说明该模板适用场景..."}
                className={cn(
                  "h-9 w-full bg-background px-3 text-sm outline-none transition-colors",
                  isPixelTheme
                    ? "rounded-xs border-2 border-border/90 focus:border-amber-600 font-mono shadow-[1px_1px_0px_#000]"
                    : "rounded-lg border border-border focus:ring-1 focus:ring-ring"
                )}
              />
            </div>
          </section>

          {/* Section 1: Stage Pipeline Management */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={cn("text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5", isPixelTheme && "font-mono")}>
                  {isPixelTheme ? <PixelShield size={14} /> : <Layers size={14} className="text-primary" />}
                  <span>阶段流程编排</span>
                </span>
                <span className={cn(
                  "text-[11px] px-1.5 py-0.2 rounded-full",
                  isPixelTheme ? "rounded-xs font-mono bg-amber-200 text-amber-950 border border-amber-900/40" : "bg-muted text-muted-foreground"
                )}>
                  {stages.length} 个阶段
                </span>
              </div>

              {!isAddingStage && (
                <button
                  type="button"
                  onClick={() => setIsAddingStage(true)}
                  className={cn(
                    "inline-flex items-center gap-1 text-xs font-medium cursor-pointer transition-all",
                    isPixelTheme
                      ? "px-2 py-1 rounded-xs bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold border-2 border-amber-900 shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                      : "text-primary hover:underline"
                  )}
                >
                  <Plus size={14} />
                  <span>新增阶段</span>
                </button>
              )}
            </div>

            {/* Stages Pipeline List */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {stages.map((stage, idx) => (
                <div
                  key={stage.key}
                  className={cn(
                    "flex items-center gap-1.5 p-1.5 pl-2.5 transition-all",
                    isPixelTheme
                      ? "rounded-xs border-2 border-border/90 bg-card shadow-[2px_2px_0px_#000] font-mono"
                      : "rounded-lg border border-border bg-card shadow-2xs"
                  )}
                >
                  {/* Stage Index Badge */}
                  <span
                    className={cn(
                      "flex items-center justify-center size-5 text-[11px] font-bold select-none",
                      isPixelTheme
                        ? "rounded-xs bg-amber-500 text-amber-950 border border-amber-900"
                        : "rounded-full bg-primary/10 text-primary"
                    )}
                  >
                    {idx + 1}
                  </span>

                  {/* Stage Name Input */}
                  <input
                    value={stage.name}
                    onChange={(e) => handleUpdateStage(stage.key, { name: e.target.value })}
                    placeholder="阶段名称"
                    className={cn(
                      "h-6 w-24 bg-transparent text-xs font-bold text-foreground outline-none",
                      isPixelTheme && "font-mono"
                    )}
                  />

                  {/* Default Assignee Pill */}
                  <div className="flex items-center gap-1 bg-muted/60 px-1.5 py-0.5 rounded text-[11px] text-muted-foreground">
                    <UserRound size={11} className="shrink-0" />
                    <input
                      value={stage.defaultAssigneeName ?? ""}
                      onChange={(e) => handleUpdateStage(stage.key, { defaultAssigneeName: e.target.value })}
                      placeholder="负责人"
                      className="w-14 bg-transparent text-[11px] outline-none text-foreground"
                    />
                  </div>

                  {/* Reorder Buttons */}
                  <div className="flex items-center">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveStage(idx, -1)}
                      className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 cursor-pointer"
                      title="前移阶段"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={idx === stages.length - 1}
                      onClick={() => handleMoveStage(idx, 1)}
                      className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 cursor-pointer"
                      title="后移阶段"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>

                  {/* Delete Stage */}
                  <button
                    type="button"
                    onClick={() => handleDeleteStage(stage.key)}
                    className="p-0.5 text-muted-foreground hover:text-destructive cursor-pointer ml-0.5"
                    title="删除阶段"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Inline Add Stage Bar */}
            {isAddingStage && (
              <div
                className={cn(
                  "flex flex-wrap items-center gap-2 p-2.5 bg-muted/30 border border-dashed border-border rounded-lg",
                  isPixelTheme && "rounded-xs border-2 font-mono bg-amber-50/30 dark:bg-amber-950/20"
                )}
              >
                <input
                  autoFocus
                  value={newStageName}
                  onChange={(e) => setNewStageName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddStage()}
                  placeholder="新阶段名称 (例如：上线发布)"
                  className={cn(
                    "h-8 px-2.5 bg-background text-xs rounded border border-border outline-none flex-1 min-w-[160px]",
                    isPixelTheme && "rounded-xs border-2"
                  )}
                />
                <input
                  value={newStageAssignee}
                  onChange={(e) => setNewStageAssignee(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddStage()}
                  placeholder="默认负责人 (例如：运维)"
                  className={cn(
                    "h-8 px-2.5 bg-background text-xs rounded border border-border outline-none w-32",
                    isPixelTheme && "rounded-xs border-2"
                  )}
                />
                <Button
                  size="sm"
                  onClick={handleAddStage}
                  className={cn(
                    "h-8 text-xs",
                    isPixelTheme && "rounded-xs border-2 shadow-[1px_1px_0px_#000]"
                  )}
                >
                  确认添加
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsAddingStage(false);
                    setNewStageName("");
                    setNewStageAssignee("");
                  }}
                  className={cn("h-8 text-xs", isPixelTheme && "rounded-xs")}
                >
                  取消
                </Button>
              </div>
            )}
          </section>

          {/* Section 2: Stage-Grouped Tasks Planning */}
          <section className="space-y-4 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={cn("text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5", isPixelTheme && "font-mono")}>
                  {isPixelTheme ? <PixelScroll size={14} /> : <ListTodo size={14} className="text-primary" />}
                  <span>阶段预设委托任务规划</span>
                </span>
                <span className={cn(
                  "text-[11px] px-1.5 py-0.2 rounded-full",
                  isPixelTheme ? "rounded-xs font-mono bg-emerald-200 text-emerald-950 border border-emerald-900/40" : "bg-muted text-muted-foreground"
                )}>
                  共 {tasks.length} 项任务
                </span>
              </div>
            </div>

            {/* Stages Cards with Tasks */}
            <div className="space-y-3.5">
              {stages.map((stage, sIdx) => {
                const stageTasks = tasks
                  .map((task, originalIndex) => ({ task, originalIndex }))
                  .filter(({ task }) => task.stageKey === stage.key);

                return (
                  <div
                    key={stage.key}
                    className={cn(
                      "overflow-hidden transition-all",
                      isPixelTheme
                        ? "rounded-xs border-2 border-border/90 bg-card shadow-[2px_2px_0px_#000] font-mono"
                        : "rounded-xl border border-border bg-card/60 shadow-2xs"
                    )}
                  >
                    {/* Stage Card Header */}
                    <div
                      className={cn(
                        "flex items-center justify-between px-3.5 py-2 border-b select-none",
                        isPixelTheme
                          ? "border-b-2 border-border/90 bg-amber-100/50 dark:bg-amber-950/40 font-mono"
                          : "border-border bg-muted/40"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={cn(
                            "flex items-center justify-center size-5 text-[11px] font-black",
                            isPixelTheme
                              ? "rounded-xs bg-amber-500 text-amber-950 border border-amber-900"
                              : "rounded-full bg-primary text-primary-foreground"
                          )}
                        >
                          {sIdx + 1}
                        </span>
                        <span className={cn("text-xs font-bold text-foreground truncate", isPixelTheme && "font-mono")}>
                          {stage.name || "未命名阶段"}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          ({stageTasks.length} 项任务)
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddTask(stage.key)}
                        className={cn(
                          "inline-flex items-center gap-1 text-xs font-medium cursor-pointer transition-all",
                          isPixelTheme
                            ? "px-2 py-0.5 rounded-xs bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold border border-amber-900 shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                            : "text-primary hover:underline"
                        )}
                      >
                        <Plus size={13} />
                        <span>添加任务</span>
                      </button>
                    </div>

                    {/* Task List under Stage */}
                    <div className="p-2 space-y-1.5">
                      {stageTasks.length === 0 ? (
                        <div
                          onClick={() => handleAddTask(stage.key)}
                          className={cn(
                            "py-4 text-center text-xs text-muted-foreground/80 cursor-pointer border border-dashed rounded-lg transition-colors hover:border-primary/40 hover:text-primary",
                            isPixelTheme && "font-mono rounded-xs border-2 hover:border-amber-600"
                          )}
                        >
                          + 暂无预设任务，点击此处快速添加
                        </div>
                      ) : (
                        stageTasks.map(({ task, originalIndex }, tIdx) => {
                          const pMeta = PRIORITIES.find((p) => p.key === task.priority) || PRIORITIES[1];

                          return (
                            <div
                              key={`task-${originalIndex}`}
                              className={cn(
                                "flex items-center gap-2 p-1.5 px-2 bg-background transition-all group",
                                isPixelTheme
                                  ? "rounded-xs border border-border/80 hover:border-amber-700/60 font-mono"
                                  : "rounded-lg border border-border/70 hover:border-border"
                              )}
                            >
                              {/* Index Dot */}
                              <span className="text-[11px] text-muted-foreground/60 w-4 text-center font-mono">
                                {tIdx + 1}.
                              </span>

                              {/* Task Title Input */}
                              <input
                                value={task.title}
                                onChange={(e) => handleUpdateTask(originalIndex, { title: e.target.value })}
                                placeholder="输入预设任务名称..."
                                className={cn(
                                  "flex-1 bg-transparent text-xs text-foreground outline-none min-w-0 font-medium",
                                  isPixelTheme && "font-mono"
                                )}
                              />

                              {/* Assignee Input */}
                              <div className="flex items-center gap-1 bg-muted/40 px-1.5 py-0.5 rounded text-[11px] text-muted-foreground shrink-0">
                                <UserRound size={11} className="shrink-0 text-muted-foreground/70" />
                                <input
                                  value={task.assigneeName ?? ""}
                                  onChange={(e) => handleUpdateTask(originalIndex, { assigneeName: e.target.value })}
                                  placeholder={stage.defaultAssigneeName || "负责人"}
                                  className="w-14 bg-transparent text-[11px] outline-none text-foreground placeholder:text-muted-foreground/50"
                                />
                              </div>

                              {/* Priority Cycle Button */}
                              <button
                                type="button"
                                onClick={() => handleCyclePriority(originalIndex)}
                                title="点击切换优先级 (低 ➔ 中 ➔ 高 ➔ 紧急)"
                                className={cn(
                                  "text-[11px] px-2 py-0.5 font-bold cursor-pointer select-none transition-all shrink-0",
                                  isPixelTheme
                                    ? task.priority === "urgent"
                                      ? "rounded-xs bg-red-200 text-red-950 border border-red-700 shadow-[1px_1px_0px_#000]"
                                      : task.priority === "high"
                                      ? "rounded-xs bg-amber-200 text-amber-950 border border-amber-700 shadow-[1px_1px_0px_#000]"
                                      : task.priority === "low"
                                      ? "rounded-xs bg-emerald-200 text-emerald-950 border border-emerald-700 shadow-[1px_1px_0px_#000]"
                                      : "rounded-xs bg-blue-200 text-blue-950 border border-blue-700 shadow-[1px_1px_0px_#000]"
                                    : task.priority === "urgent"
                                    ? "rounded-md bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-300/40"
                                    : task.priority === "high"
                                    ? "rounded-md bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-300/40"
                                    : task.priority === "low"
                                    ? "rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/40"
                                    : "rounded-md bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300/40"
                                )}
                              >
                                {isPixelTheme ? pMeta.pixelLabel : pMeta.label}
                              </button>

                              {/* Delete Task Button */}
                              <button
                                type="button"
                                onClick={() => handleDeleteTask(originalIndex)}
                                className="p-1 text-muted-foreground hover:text-destructive cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
                                title="删除该任务"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="px-6 py-2 bg-destructive/10 border-t border-destructive/20 text-xs text-destructive font-mono" role="alert">
            ⚠️ {error}
          </div>
        )}

        {/* Footer */}
        <DialogFooter
          className={cn(
            "p-4 px-6 border-t select-none bg-card shrink-0 flex items-center justify-end gap-2",
            isPixelTheme ? "border-t-2 border-border/90 font-mono" : "border-border"
          )}
        >
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className={isPixelTheme ? "rounded-xs border-2 shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]" : ""}
          >
            取消
          </Button>
          <Button
            disabled={saving}
            onClick={() => void handleSubmit()}
            className={cn(
              isPixelTheme
                ? "rounded-xs border-2 border-amber-900 bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                : ""
            )}
          >
            {saving
              ? "保存中…"
              : isPixelTheme
              ? "✨ 封存公会战术蓝图"
              : "保存模板"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
