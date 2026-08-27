# Design: 今日工作台智能逾期任务收敛与就地极速规划

## Context

详见 `proposal.md`。当前 `src/lib/taskSchedule.ts` 中的 `taskIntersectsDay` 函数仅按日期区间判定任务是否存在交集，导致历史未完成任务被静默过滤；同时 `TodayPanel.tsx` 缺少就地录入组件。

## Goals / Non-Goals

**Goals:**
- 将历史逾期未完成任务自动聚合进今日工作台，并在列表和四象限中清晰呈现逾期状态（如 `已逾期 2d`）；
- 在任务项上提供直接的「顺延至今日」快捷按钮，触发 `updateTask` 将 `scheduledEndAt` 更新至今日 23:59；
- 在 `TodayPanel` 顶部集成内联极速录入栏（Inline Quick Add），支持标题输入、回车提交、四象限快捷胶囊点选与所属项目关联；
- 保持与现有 `useTimeManagementData`、`useProjectsData` 及 TanStack Query 缓存逻辑 100% 兼容。

**Non-Goals:**
- 不修改底层数据库表结构或 RPC 签名（复用现有的 `time_management_tasks` 与 `save_time_management_task_v2`）；
- 不在此变更中重构全局独立的浮动窗口 `TaskQuickEdit`（该部分留给后续 Step 3 全局统一入口）；
- 不自动静默修改用户逾期任务的截止时间，必须由用户主动点击「顺延」或修改。

## Decisions

### 1. 任务过滤逻辑重构 (`taskSchedule.ts` & `TodayPanel.tsx`)
- **判定规则**：
  ```typescript
  export function isTaskOverdue(task: Task, now: number): boolean {
    if (task.completed || !task.scheduledEndAt) return false;
    return task.scheduledEndAt < now;
  }

  export function taskBelongsToToday(task: Task, todayDate: Date, now: number): boolean {
    // 1. 如果是今日排期任务
    if (taskIntersectsDay(task, todayDate)) return true;
    // 2. 如果是历史逾期且未完成的任务
    const dayStart = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate()).getTime();
    if (!task.completed && task.scheduledEndAt && task.scheduledEndAt < dayStart) {
      return true;
    }
    return false;
  }
  ```
- **排序规则**：逾期未完成任务在时间流模式中排在最前列（按照逾期时间升序排列），在四象限模式中归入各自对应象限并在象限内置顶高亮。

### 2. 今日极速录入组件设计 (`TodayQuickAdd.tsx` / `TodayPanel.tsx`)
- **交互设计**：
  - 位于今日任务列表的上方；
  - 提供输入框（Placeholder：`⚡ 快速记录今日待办，按 Enter 提交...`）；
  - 左侧/右侧内嵌四象限快捷切换胶囊（默认继承上次选择或默认为 `Q2` 核心修炼）；
  - 右侧提供轻量级项目选择下拉（可选关联已有的未归档项目）；
  - 按 `Enter` 触发 `addTask(title, quadrant, { scheduledEndAt: todayEndTimestamp, projectId })`；
  - 提交后输入框自动清空并保持聚焦，方便连续录入。

### 3. 一键顺延至今日交互
- 当任务为历史逾期未完成任务时，在任务卡片或时间标签旁展示橙/红色的 `已逾期 X 天` 标签，并显示小日历图标按钮 `📅 顺延至今日`；
- 点击后调用 `updateTask(task.id, { scheduledEndAt: todayEndTimestamp })`，乐观更新后自动转化为今日普通待办。

## Risks / Trade-offs

- **[大量历史积压任务导致今日列表过长]** → 在今日工作台顶部展示「⚠️ 逾期未结 (N)」可折叠收起栏，当逾期任务超过 5 条时默认支持折叠/展开，避免撑爆视觉画布。
- **[时区与日期边界计算偏差]** → 统一使用 `dateUtils.ts` 中的 `todayYMD()` 与本地时钟转换，确保跨午夜时计算一致。
