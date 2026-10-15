# Proposal

## Why

WorkBuddy-D 前端经过业务特性的快速迭代，在部分核心高频交互路径上积累了重渲染雪崩、热路径重复扫描计算、状态类型边界模糊以及重型单体文件（1000+ 行组件）等架构债务。针对这些痛点，在保持桌面端冷启动即用与无闪烁导航体验的前提下，实施针对性的重渲染隔离、运行时计算优化、Barrel 文件消除、上帝组件拆解与服务端状态治理，能够大幅降低 CPU 负载并提升大规模数据下的界面流畅度。

## What Changes

- **消除 Barrel Files (`index.ts`)**: 移除 `src/features/projects/index.ts` 等直接使用 `export *` 造成的全量重导出桶文件，改为单文件精确导入，确保 Vite 构建时能够执行精准的死代码裁剪（Tree-shaking）。
- **TodayPage 悬停状态隔离与下沉**: 改造 `TodayPage` 中提升至顶层的 `hoveredTaskId` 和 `hoveredStageId` 瞬态交互状态，避免用户鼠标滑过任务列表或甘特图时间轴时引起整个页面（快速规划栏、习惯追踪栏、复盘栏等）的连带雪崩式重渲染。
- **项目侧边栏 O(N*M) 过滤治理与哈希索引**: 在 `ProjectSidebar` 中构建单次遍历的 `Map<string, ProjectTask[]>` 任务聚合哈希索引，消除在 `filteredProjects.map` 循环体内为每个项目重复执行 `allTasks.filter`、嵌套循环与高频 `new Date()` 分配。
- **搜索输入状态下沉与并发调度**: 将 `ProjectsPage` 顶层仅供侧边栏使用的 `searchQuery` 状态下沉收敛至 `ProjectSidebar` 内部，并使用 React 19 `useDeferredValue` 调度过滤计算，保障输入框按键 120fps 流畅响应且不阻塞整个页面看板。
- **今日任务列表内联渲染函数抽离**: 将 `TodayTasksSection` 中的 `renderTaskItem` 与 `renderQuadrantSection` 抽离为独立的单文件记忆化子组件（`React.memo`），规范默认属性引用与稳定回调，阻断定时器 Tick 引起的子组件全量无谓重绘。
- **单体上帝组件模块化拆解规范**: 将 `KnowledgePanel` (2080 行)、`TodayProjectTimeline` (1376 行) 和 `HabitPanel` (1432 行) 等单体文件逐步按单一职责拆解为内聚的目录微组件结构，优化模块图与 HMR 编译粒度。
- **专注伴侣统计状态纳入 TanStack Query 统一缓存**: 将 `useFocusTimer` 中手动用 `useState + useEffect` 轮询与拉取的 `focusStats` 服务端数据迁移至 TanStack Query，实现请求自动去重、跨窗口同步与写后精确失效。

## Non-goals

- **保持桌面端整包即时就绪体验**: 不实施路由层面的动态代码懒加载（`React.lazy`），维持核心页面在本地桌面环境下的零白屏、无加载菊花闪烁的直切体验。
- **保持弹窗模态框既有生命周期**: 不重构模态框组件的动态导入逻辑，保留各页面现有即时弹窗交互机制。

## Capabilities

### New Capabilities
None.

### Modified Capabilities
None.

## Impact

- **Affected Files**:
  - `src/pages/TodayPage.tsx` 与 `src/pages/ProjectsPage.tsx`
  - `src/features/time-management/components/TodayTasksSection.tsx`
  - `src/features/projects/index.ts` 及引用它的相关页面
  - `src/features/projects/components/ProjectSidebar.tsx`
  - `src/features/focus/hooks/useFocusTimer.ts` 与专注查询键定义
  - `src/features/knowledge/components/KnowledgePanel.tsx`、`TodayProjectTimeline.tsx` 与 `HabitPanel.tsx` 结构规划
- **State & Data**: 服务端统计状态迁移至 TanStack Query；UI 瞬态交互收敛下沉。
- **APIs & Schema**: 后端接口与数据契约完全保持不变。
