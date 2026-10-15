# Design

## Context

在 WorkBuddy-D 的架构设计中，各特性模块按 `bulletproof-react-architecture` 划分，TanStack Query 统一管理远端服务端状态，Zustand 管理轻量客户端会话状态。本设计在**不变更产品需求契约**与**不引入首屏路由懒加载白屏**的前提下，聚焦于解决高频交互路径上的重渲染级联、模块导出污染、未索引热路径循环与服务端状态管理反模式。

## Goals / Non-Goals

**Goals:**
- **消除全量桶导出**: 移除 `src/features/projects/index.ts`，确保所有组件使用精准单文件导入，使 Vite 构建树摇（Tree-shaking）有效生效。
- **阻断 TodayPage 悬停重渲染级联**: 将任务与时间轴联动高亮与 `TodayPage` 顶层渲染完全解耦，鼠标滑过任务或阶段时不触发无关 Section 的重渲染。
- **降阶项目侧边栏计算复杂度**: 将 `ProjectSidebar` 中的多次嵌套数组扫描从 $O(Projects \times Tasks)$ 优化为 $O(Tasks)$ 的 Map 哈希表单次索引构建。
- **搜索输入流畅度保障**: 将 `searchQuery` 状态下沉至 `ProjectSidebar`，利用 React 19 `useDeferredValue` 实现输入响应与列表过滤的并发调度。
- **消除今日待办内联渲染函数**: 将 `TodayTasksSection` 内部的 `renderTaskItem` 提取为具名独立 `React.memo` 组件，规范默认 Prop 引用。
- **统一专注统计至 TanStack Query**: 废除 `useFocusTimer` 内部的独立 `useState` 数据副本，收敛至 `queryKeys.focusStats` 统一缓存与失效机制。
- **确立上帝组件解耦蓝图**: 为超过 1000 行的 `KnowledgePanel`、`TodayProjectTimeline` 和 `HabitPanel` 建立清晰的子组件拆解结构。

**Non-Goals:**
- 不修改页面路由导入策略（保持 `src/app/routes/router.tsx` 中各页面的同步静态载入，确保桌面端切换零闪烁）。
- 不对模态框弹窗执行动态分包，维持现有交互。
- 不修改任何后端 API 与数据库字段。

## Decisions

### 1. 消除 Barrel Files 转向单文件精确导入 (Bulletproof Gotcha #5 & Vercel `bundle-barrel-imports`)
- **方案**:
  - 删除 `src/features/projects/index.ts` 中针对所有内部组件的 `export *`。
  - 将 `src/pages/ProjectsPage.tsx` 中的引用调整为按需精确路径导入：
    - `import { ProjectSidebar } from "@/features/projects/components/ProjectSidebar";`
    - `import { ProjectHeaderToolbar } from "@/features/projects/components/ProjectHeaderToolbar";`
    - `import { useProjectsData, useProjectActions } from "@/features/projects/hooks/useProjects";`
- **替代方案**:
  - *方案 B (保留 index.ts 并在 package.json 中标记 sideEffects)*: 仍然容易被打包工具误将同一 feature 内的多视图组件全部打入主 chunk，不如物理直引彻底。

### 2. TodayPage 高频悬停状态解耦 (Vercel `rerender-defer-reads` & `rerender-use-ref-transient-values`)
- **方案**:
  - 创建局部轻量交互 Store 或自定义事件驱动的悬停订阅机制（`useTodayHoverStore` 或 Context 选择器）。
  - `TodayPage` 本身不再持有 `hoveredTaskId` / `hoveredStageId` 的 `useState`。
  - 仅有需要高亮表现的子项（具体任务行 `TodayTaskItem` 与具体甘特图行 `TimelineTaskRow`）通过选择器订阅对应的布尔状态 `isHovered = useTodayHoverStore(s => s.hoveredTaskId === task.id)`。
- **收益**:
  - 鼠标移动滑动时，`TodayPage` 重渲染次数由**每秒数十次降至 0 次**；`TodayQuickAdd`、`TodayHabitsSection`、`TodayReviewSection` 完全保持静默。

### 3. ProjectSidebar 哈希索引与单次遍历聚合 (Vercel `js-index-maps` & `js-combine-iterations`)
- **方案**:
  在 `ProjectSidebar` 顶层通过 `useMemo` 针对 `allTasks` 构建一次性聚合 Map：
  ```ts
  interface ProjectTaskMetrics {
    total: number;
    done: number;
    overdueTasks: ProjectTask[];
    approachingTasks: ProjectTask[];
  }
  const taskMetricsByProjectId = useMemo(() => {
    const map = new Map<string, ProjectTaskMetrics>();
    for (const task of allTasks) {
      if (!task.projectId) continue;
      let entry = map.get(task.projectId);
      if (!entry) {
        entry = { total: 0, done: 0, overdueTasks: [], approachingTasks: [] };
        map.set(task.projectId, entry);
      }
      entry.total++;
      if (task.completed) {
        entry.done++;
      } else {
        // 单次分配时间比对
        if (isTaskOverdue(task, todayStr)) entry.overdueTasks.push(task);
        else if (isTaskApproaching(task, todayStr)) entry.approachingTasks.push(task);
      }
    }
    return map;
  }, [allTasks, todayStr]);
  ```
- **收益**:
  - 消除每次列表渲染中数十次重复的 `allTasks.filter` 数组创建与垃圾回收，大幅降低侧边栏滚动时的 GC 压力。

### 4. 搜索框状态收敛至组件内部并引入 useDeferredValue (Vercel `rerender-use-deferred-value`)
- **方案**:
  - 从 `ProjectsPage` 移除 `searchQuery` 及其更新函数的声明与传递。
  - 将 `searchQuery` 收归 `ProjectSidebar` 内部独立持有：
    ```ts
    const [searchQuery, setSearchQuery] = useState("");
    const deferredSearchQuery = useDeferredValue(searchQuery);
    ```
  - 过滤逻辑基于 `deferredSearchQuery` 触发。
- **收益**:
  - 用户输入文本时，输入框本身保持最高优先级零延迟响应，过滤大量项目列表的计算让渡给空闲微任务并发执行，中央画布完全不受搜索输入影响。

### 5. 今日任务列表项抽离与属性稳定化 (Vercel `rerender-no-inline-components` & `rerender-memo`)
- **方案**:
  - 在 `src/features/time-management/components/` 提取 `TodayTaskItem.tsx`。
  - 使用 `React.memo` 包装 `TodayTaskItem`，接收稳定的 `onToggle`、`onReschedule`、`onQuickEdit` 回调。
  - 将 `TodayTasksSection` 中的默认空数组提升为模块顶层常量 `const EMPTY_PROJECTS: Project[] = [];`，避免非原语默认值在每次父级渲染时生成新对象引用打破记忆化。

### 6. 专注伴侣统计状态纳入 TanStack Query (Bulletproof Rule 4 & Vercel `client-swr-dedup`)
- **方案**:
  - 在 `src/features/focus/api/focusQueries.ts` 中声明 `focusQueries.stats(userId)`。
  - 在 `useFocusTimer` 中使用 `useQuery(focusQueries.stats(userId))` 读取统计数据。
  - 当专注结束、休息结束或跳过休息时，调用 `queryClient.invalidateQueries({ queryKey: queryKeys.focusStats(userId) })`。
- **收益**:
  - 多窗口、多组件之间共享同一套专注时长统计，避免旧状态脏读，消除了手动 `refreshStats` 的维护负担。

### 7. 上帝组件拆解蓝图规划 (Bulletproof Feature Structure)
- **方案**:
  - 为 `KnowledgePanel` (2080行) 建立子组件目录：
    - `components/sidebar/KnowledgeListsSidebar.tsx`（知识库目录树与拖拽）
    - `components/notes/KnowledgeNoteGroupView.tsx`（笔记分组看板）
    - `components/drawer/KnowledgeNoteDrawer.tsx`（笔记详情与自动保存控制）
  - 为 `TodayProjectTimeline` (1376行) 拆离坐标换算纯函数至 `utils/timelineCoordinates.ts`，渲染部分分离为 `TimelineHeader.tsx` 与 `TimelineGanttGrid.tsx`。

## Risks / Trade-offs

- **[Risk: 悬停解耦引入的状态同步复杂度]**
  - *Mitigation*: 采用极简的专用观察者模式或局部轻量 Zustand slice，仅发布与订阅 `hoveredTaskId`，不引入多余中间层。
- **[Risk: 精确导入路径变更可能引发的构建报错]**
  - *Mitigation*: 移除 barrel 文件后，运行 `pnpm build` 和 `pnpm lint:boundaries` 确认所有引用路径对齐。
