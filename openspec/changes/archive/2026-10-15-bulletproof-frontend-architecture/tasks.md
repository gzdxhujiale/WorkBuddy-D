# Tasks: Bulletproof React Architecture Refactor

## 1. Phase 1: 基础设施与配置层搭建

- [x] 1.1 创建 `src/config/env.ts` 与 `src/config/paths.ts`，集中声明环境变量校验与路由常量，验证 `pnpm build` 通过
- [x] 1.2 创建局部错误边界 `src/components/ui/SectionErrorBoundary.tsx`，支持局部崩溃隔离与友好重试，验证 `pnpm build` 通过
- [x] 1.3 建立 `features/` 通用 QueryOptions 模式基线，验证 `pnpm build` 通过

## 2. Phase 2: Knowledge 独立特性试点迁移 (Pilot Feature)

- [x] 2.1 创建 `src/features/knowledge/` 目录结构（`api/`, `components/`, `hooks/`, `types/`, `utils/`）
- [x] 2.2 迁移知识库类型、工具函数与服务至 `features/knowledge/`，并在 `api/` 暴露标准化 `queryOptions` 与 Mutation
- [x] 2.3 迁移知识库组件至 `features/knowledge/components/`，更新内部依赖
- [x] 2.4 更新 `KnowledgePage.tsx` 及外部引用，执行 `pnpm build` 验证编译与类型安全

## 3. Phase 3: 核心特性切分与 App 编排层解耦

- [x] 3.1 迁移 `habit` 领域至 `src/features/habit/` 并更新对应页面与引用，验证 `pnpm build` 通过
- [x] 3.2 迁移 `projects` 与 `daily-review` 领域至 `src/features/projects/` 与 `src/features/daily-review/`，验证 `pnpm build` 通过
- [x] 3.3 迁移 `time-management` 与 `focus` 领域至 `src/features/time-management/` 与 `src/features/focus/`，验证 `pnpm build` 通过
- [x] 3.4 迁移 `today` 领域至 `src/features/today/`，通过 App 组合层解耦跨 Feature 直接依赖，验证 `pnpm build` 通过
- [x] 3.5 建立 `src/app/` 结构（整理路由、Providers、桌面 Webview 入口适配），保证 Tauri 窗口通信正常
- [x] 3.6 执行全量构建 `pnpm build`，同步更新 `docs/FRONTEND.md` 与 `ARCHITECTURE.md`，并通过 `ai-harness validate` 检查

## 4. Phase 4: 剩余模块全量特性化与 App 组合层收拢

- [x] 4.1 建立 `src/features/auth/`，迁移登录视图与认证基础设施，并在外部提供平滑兼容
- [x] 4.2 建立 `src/features/settings/`，迁移 `SettingsDialog` 及偏好配置逻辑
- [x] 4.3 将 `Pomodoro` 收敛至 `features/focus`，将 `WeeklyPlanning` 与 `Mission` 收敛至 `features/time-management`，并在各页面应用 `SectionErrorBoundary`
- [x] 4.4 收拢桌面窗口入口与 `RealtimeProvider` 至 `src/app/windows/` 与 `src/app/providers/`
- [x] 4.5 将主 `App.tsx` 与路由配置收敛至 `src/app/`，完成全量 `pnpm build` 与 `ai-harness validate` 门禁验证

## 5. Phase 5: 全量过渡垫片清理与严格架构边界落地

- [x] 5.1 物理删除所有过渡导出垫片：清理 `src/components/` 8个领域目录及兼容组件、彻底移除 `src/services/`（10个服务文件全量归位）、清理 `src/hooks/` 与 `src/types/` 领域转发文件及 `src/utils/`
- [x] 5.2 权威收拢根级组件：将 Router 统一定义于 `src/app/routes/router.tsx`，`src/main.tsx` 直接挂载 `@/app/App`，移除根 `src/App.tsx`、`src/router.tsx` 与 `src/windowSessionGate.tsx`
- [x] 5.3 消除平台歧义与命名冲突：将 `src/app/windows/quickEditWindow.ts` 规范更名为 `quickEditWindowManager.ts`，杜绝 Windows NTFS 大小写不敏感碰撞，并更新所有引用
- [x] 5.4 页面全量加固与构建验证：在 `ProjectsPage` 统一补齐 `SectionErrorBoundary` 局部容错边界，执行 `pnpm build` 确认 4 个桌面窗口产物打包成功且类型检查 100% 通过

## 6. Phase 6: 核心领域模型提升与跨 Feature 依赖解耦 (方案 B 落地)

- [x] 6.1 提升共享实体：在 `src/types/` 建立全局共享的 `task.ts` 与 `project.ts` 契约，切断 `projects` 与 `time-management` 间数据层循环导入
- [x] 6.2 Today 看板解构：在 `features/time-management` 导出 `<TodayTasksSection />`、在 `features/habit` 导出 `<TodayHabitsSection />`、在 `features/daily-review` 导出 `<TodayReviewSection />`、在 `features/projects` 导出 `<TodayProjectTimeline />`
- [x] 6.3 看板组合化：将 `TodayPanel` 重构为 App 组合看板（位于 `src/pages/today/` 或 `TodayPage.tsx` 页面级），物理废除 `src/features/today/`，彻底清除跨 Feature 导入
- [x] 6.4 Focus 助手解耦：解耦 `FocusAssistant` 中直接导入的跨业务 Hook，改由 App 层或轻量选择器组合

## 7. Phase 7: API 层 queryOptions 消费闭环与模块化

- [x] 7.1 Hooks 闭环：重构 `useProjectsData`、`useHabitData`、`useDailyReviewData`、`useTimeManagementData`，强制消费 `*Queries.ts` 中定义的 `queryOptions`
- [x] 7.2 服务模块化：按资源拆分单体 Service（如 `knowledgeService.ts` 拆解为 `notes.ts`、`folders.ts`、`templates.ts`）

## 8. Phase 8: 状态分类治理与 uiStore 瘦身

- [x] 8.1 全局 store 净化：从 `uiStore.ts` 移除 `hoveredTaskId`、`hoveredStageId` 等纯组件瞬态状态，转为局部状态
- [x] 8.2 特性状态就近：将笔记与列表激活状态就近下沉至 `features/knowledge/` 内部
- [x] 8.3 URL 状态化：将 `ProjectsPage` 的视图模式（kanban/gantt/table）与过滤条件绑定至 TanStack Router search params

## 9. Phase 9: 表单基础设施与 Schema 驱动改造 (RHF + Zod)

- [x] 9.1 表单基建：引入 React Hook Form 与 `@hookform/resolvers/zod`，在 `src/components/ui/form.tsx` 建立声明式表单原语
- [x] 9.2 复杂表单改造：重构 `TemplateEditorModal` 及项目创建对话框，以 Zod Schema 驱动表单输入与校验

## 10. Phase 10: 巨石组件拆解与关注点分离

- [x] 10.1 拆解 `TaskQuickEdit`（1600 行）：拆分为头部、象限选择、日程排期、子任务列表、笔记富文本等独立子组件
- [x] 10.2 拆解 `ProjectsPage`（1250 行）：拆分为侧边栏、工具栏及主容器组件

## 11. Phase 11: 架构防腐守卫与端到端验证

- [x] 11.1 配置 ESLint `import/no-restricted-paths` 自动化单向依赖与禁止跨 Feature 检查
- [x] 11.2 执行 `pnpm build` 与 `ai-harness validate` 确认全量编译与文档校验 100% 通过


