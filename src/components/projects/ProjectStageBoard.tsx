import { useState } from "react";
import dayjs from "dayjs";
import { Check, ChevronDown, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker, DateRangePicker } from "@/components/ui/date-picker";
import type { ProjectStage, ProjectTask } from "@/types/projects";
import type { Task } from "@/types/timeManagement";

interface Props {
  stages: ProjectStage[];
  tasks: ProjectTask[];
  disabled?: boolean;
  onCreateStage: (name: string) => Promise<void>;
  onSaveStage: (stage: ProjectStage) => Promise<void>;
  onDeleteStage: (stage: ProjectStage) => Promise<void>;
  onSaveTask: (task: Task) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
}

function StageCard({
  stage,
  tasks,
  disabled,
  onSaveStage,
  onDeleteStage,
  onSaveTask,
  onDeleteTask,
}: Omit<Props, "stages" | "onCreateStage"> & { stage: ProjectStage; tasks: ProjectTask[] }) {
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState(true);

  const addTask = async () => {
    if (!draft.trim()) return;
    await onSaveTask({
      id: crypto.randomUUID(),
      title: draft.trim(),
      quadrant: "Q2",
      completed: false,
      projectId: stage.projectId,
      projectStageId: stage.id,
      priority: "medium",
      assigneeName: stage.defaultAssigneeName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setDraft("");
  };

  return (
    <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm transition-shadow hover:shadow">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-2.5">
        <button
          type="button"
          className="flex min-w-0 items-center gap-2 text-left"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          <span className="size-2 rounded-full bg-emerald-500" />
          <span className="truncate text-sm font-semibold text-foreground">{stage.name}</span>
          <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            {tasks.length}
          </span>
          {stage.defaultAssigneeName && (
            <span className="hidden text-xs text-muted-foreground sm:inline">
              负责人：{stage.defaultAssigneeName}
            </span>
          )}
        </button>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-44 sm:w-48">
            <DateRangePicker
              size="mini"
              value={[stage.startDate ?? null, stage.endDate ?? null]}
              disabled={disabled}
              placeholder={["阶段开始", "阶段结束"]}
              onChange={(dates) => {
                void onSaveStage({
                  ...stage,
                  startDate: dates[0] || undefined,
                  endDate: dates[1] || undefined,
                });
              }}
            />
          </div>
          <button
            type="button"
            aria-label={expanded ? "收起阶段" : "展开阶段"}
            onClick={() => setExpanded((value) => !value)}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent"
          >
            <ChevronDown className={`size-4 transition-transform duration-200 ${expanded ? "" : "-rotate-90"}`} />
          </button>
          <button
            type="button"
            disabled={disabled}
            aria-label={`删除阶段 ${stage.name}`}
            title="删除阶段"
            onClick={() => void onDeleteStage(stage)}
            className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </header>
      {expanded && (
        <div>
          {tasks.map((task) => (
            <div
              key={task.id}
              className="group flex min-w-0 items-center gap-3 border-b border-border/60 px-4 py-2.5 last:border-0 hover:bg-muted/20"
            >
              <button
                type="button"
                disabled={disabled}
                onClick={() => void onSaveTask({ ...task, completed: !task.completed })}
                aria-label={task.completed ? "标记未完成" : "标记完成"}
                className={`grid size-5 shrink-0 place-items-center rounded-full border transition-colors ${task.completed
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-muted-foreground/50 hover:border-emerald-600"
                  }`}
              >
                {task.completed && <Check className="size-3" />}
              </button>
              <input
                defaultValue={task.title}
                onBlur={(event) => {
                  const title = event.target.value.trim();
                  if (title && title !== task.title) void onSaveTask({ ...task, title });
                }}
                className={`min-w-0 flex-1 bg-transparent text-sm outline-none ${task.completed ? "text-muted-foreground line-through" : "font-medium text-foreground"
                  }`}
              />
              <select
                value={task.priority}
                disabled={disabled}
                onChange={(event) => void onSaveTask({ ...task, priority: event.target.value as ProjectTask["priority"] })}
                className="h-7 shrink-0 rounded border border-border bg-background px-1.5 text-xs outline-none"
              >
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
                <option value="urgent">紧急</option>
              </select>
              <div className="w-28 sm:w-36 shrink-0">
                <DatePicker
                  size="mini"
                  placeholder="截止日期"
                  disabled={disabled}
                  value={task.scheduledEndAt ?? null}
                  onChange={(dateStr) => {
                    const parsed = dateStr ? dayjs(dateStr) : null;
                    void onSaveTask({
                      ...task,
                      scheduleMode: dateStr ? "point" : undefined,
                      scheduledStartAt: undefined,
                      scheduledEndAt: parsed && parsed.isValid() ? parsed.valueOf() : undefined,
                    });
                  }}
                />
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={() => void onDeleteTask(task.id)}
                aria-label={`删除 ${task.title}`}
                className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus:opacity-100"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <form className="flex items-center gap-2 px-4 py-2.5 border-t border-border/40" onSubmit={(event) => { event.preventDefault(); void addTask(); }}>
            <Plus className="size-4 text-muted-foreground shrink-0" />
            <input
              value={draft}
              disabled={disabled}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={`在“${stage.name}”新增任务`}
              className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
            <Button type="submit" size="sm" variant="ghost" className="h-7 text-xs" disabled={disabled || !draft.trim()}>
              添加
            </Button>
          </form>
        </div>
      )}
    </section>
  );
}

export function ProjectStageBoard({
  stages,
  tasks,
  disabled,
  onCreateStage,
  onSaveStage,
  onDeleteStage,
  onSaveTask,
  onDeleteTask,
}: Props) {
  const [stageName, setStageName] = useState("");

  return (
    <section className="mt-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-foreground">流程阶段与任务</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">每个阶段可包含多个任务；任务同时显示在任务中心。</p>
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!stageName.trim()) return;
            void onCreateStage(stageName.trim()).then(() => setStageName(""));
          }}
        >
          <input
            value={stageName}
            disabled={disabled}
            onChange={(event) => setStageName(event.target.value)}
            placeholder="新增阶段名称"
            className="h-8 w-32 rounded-lg border border-border bg-background px-2.5 text-xs outline-none focus:ring-1 focus:ring-ring"
          />
          <Button type="submit" size="sm" variant="outline" className="h-8 text-xs gap-1" disabled={disabled || !stageName.trim()}>
            <Plus className="size-3.5" />
            添加阶段
          </Button>
        </form>
      </div>
      <div className="space-y-3">
        {stages.map((stage) => (
          <StageCard
            key={stage.id}
            stage={stage}
            tasks={tasks.filter((task) => task.projectStageId === stage.id)}
            disabled={disabled}
            onSaveStage={onSaveStage}
            onDeleteStage={onDeleteStage}
            onSaveTask={onSaveTask}
            onDeleteTask={onDeleteTask}
          />
        ))}
        {stages.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            请先新增一个流程阶段，再在其中添加任务。
          </div>
        )}
      </div>
    </section>
  );
}

