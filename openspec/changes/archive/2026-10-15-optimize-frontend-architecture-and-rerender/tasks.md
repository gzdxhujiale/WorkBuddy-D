# Tasks

## 1. 模块导出治理与 Tree-shaking 强化

- [x] 1.1 移除 `src/features/projects/index.ts` 中的 `export *` 全量重导出，将 `src/pages/ProjectsPage.tsx` 及其他调用方的引用改造为单文件精确导入。运行 `pnpm lint:boundaries` 与 `pnpm build` 验证依赖边界无违规且类型检查通过。

## 2. ProjectSidebar 计算优化与搜索状态下沉

- [x] 2.1 将 `searchQuery` 状态从 `ProjectsPage.tsx` 下沉收敛至 `ProjectSidebar.tsx` 内部，并使用 React 19 `useDeferredValue` 调度过滤计算。验证输入过滤时仅侧边栏局部响应，中央工作区保持静默。
- [x] 2.2 在 `ProjectSidebar.tsx` 中使用 `useMemo` 构建单次遍历的 `Map<string, ProjectTaskMetrics>` 任务指标哈希表，消除渲染循环体内的重复 `allTasks.filter` 数组创建与高频 Date 计算。验证各项目进度环与状态徽章计算准确。

## 3. TodayPage 悬停交互与今日待办渲染优化

- [x] 3.1 解耦 `TodayPage.tsx` 顶层的 `hoveredTaskId` 与 `hoveredStageId` 状态提升，建立轻量局部订阅机制连接任务与甘特图时间轴联动高亮。验证鼠标悬停任务时不触发 `TodayQuickAdd`、`TodayHabitsSection`、`TodayReviewSection` 的级联重绘。
- [x] 3.2 将 `TodayTasksSection.tsx` 内部的 `renderTaskItem` 抽离为独立的单文件记忆化组件 `TodayTaskItem.tsx`（包裹 `React.memo`），并将空数组默认引用提升至模块常量。验证 60 秒定时器更新时，未发生变化的任务项跳过重新渲染。

## 4. 专注伴侣统计状态收敛至 TanStack Query

- [x] 4.1 在 `src/features/focus/api/focusQueries.ts` 中声明 `focusQueries.stats(userId)` 查询选项工厂与 queryKeys 关联。
- [x] 4.2 重构 `src/features/focus/hooks/useFocusTimer.ts`，移除手动的 `useState` 与 `refreshStats`，接入 `useQuery(focusQueries.stats(userId))` 统一查询生命周期，并在专注完成、休息完成与跳过休息时调用 `queryClient.invalidateQueries` 触发失效。验证统计时长即时且准确同步。

## 5. 全量准出与架构边界验证

- [x] 5.1 执行 `pnpm build` 确保生产环境打包与 TypeScript 检查 0 错误。
- [x] 5.2 执行 `pnpm lint:boundaries` 确保全部特性模块严格满足 Bulletproof React 单向依赖门禁。
