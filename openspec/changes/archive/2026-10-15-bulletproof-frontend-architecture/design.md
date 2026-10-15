# Design: Bulletproof React Architecture Refactor

## Context

WorkBuddy-D 是基于 Tauri 2 + React 19 + Supabase 构建的桌面个人生产力应用。当前前端结构以横向技术职责（`pages/`、`components/`、`hooks/`、`services/`、`types/`、`utils/`）划分。这种结构在业务领域扩展时容易导致关注点分散、跨文件跳转频繁。

本项目需要遵循 `bulletproof-react-architecture` 核心规范，并结合 Tauri 多窗口与 Supabase 托管架构进行定制化落地。参见 `proposal.md`。

## Goals / Non-Goals

**Goals:**
- **特性内聚（Feature Colocation）**：将领域专属代码归拢到 `src/features/<feature>/`（含 `api/`、`components/`、`hooks/`、`types/` 等）。
- **单向依赖流向（Unidirectional Flow）**：`shared (components/lib/config) → features → app`，杜绝 Feature 间互相穿透。
- **标准化 API 层**：在 Feature 内部标准化使用 TanStack Query v5 `queryOptions` 模式，解耦查询定义与组件消费。
- **统一应用与配置层**：建立 `src/config/`（环境变量与路径定义）与 `src/app/`（路由、多窗口装配与全局 Providers）。
- **健壮的多级容灾**：在主窗口各功能分区引入局部 Error Boundary，保障桌面端操作连续性。

**Non-Goals:**
- 不重写现有业务逻辑、PostgreSQL 数据库 schema、RLS 策略与 RPC。
- 不替换现有基础库选型（TanStack Router、TanStack Query、Zustand、Arco Design 保持不变）。
- 不破坏现有未完工的业务变更契约。

## Decisions

### 1. 特性边界与目录划分 (Feature Slicing)
将业务逻辑划分为 7 大核心 Feature：
- `knowledge`：知识库目录、Tiptap 富文本、排序与选择器
- `habit`：习惯定义、打卡记录、统计热力图
- `projects`：项目元数据、多阶段管理、阶段任务
- `daily-review`：每日复盘记录与打分
- `time-management`：四象限、周计划、使命愿景
- `focus`：专注模式、番茄钟、白噪音
- `today`：今日聚焦工作台、收集箱、综合视图

每个 Feature 内部结构视需要保持精炼：
```text
src/features/<feature>/
├── api/             # Supabase 服务调用与 TanStack Query v5 queryOptions
├── components/      # 该特性专属 UI
├── hooks/           # 该特性专属逻辑 Hook
├── types/           # 该特性契约类型
└── utils/           # 该特性专属纯函数
```

*备选方案考虑*：保持现状并在 `FRONTEND.md` 仅做软性约定。
*裁决理由*：软性约定容易随迭代恶化，物理目录切分能直接从编译器和文件层级强化代码归属。

### 2. 跨 Feature 依赖解耦（Cross-Feature Boundaries）
**挑战**：`today` 页面需要关联 `projects` 的阶段任务和 `habit` 的打卡。
**架构决策**：
- 严禁 `features/today` 直接 import `features/projects` 的内部组件或私有状态。
- **解耦模式 1 (Composition at App Layer)**：页面路由组件（如 `TodayPage`）在应用层统一编排组合各 Feature 暴露的自包含组件（如 `<ProjectTaskPicker />`）。
- **解耦模式 2 (Shared Core Models)**：跨领域的底层实体（如全局任务实体类型、通用查询键）下沉至 `src/types/` 或 `src/lib/`。

### 3. API 层规范：`queryOptions` 包装
在每个 `features/<feature>/api/` 中：
- 保留 Supabase 调用为独立纯函数。
- 导出强类型的 `queryOptions` 工厂函数，使得组件中的 `useQuery`、页面 prefetch、以及 mutation 后的 `queryClient.invalidateQueries` 共享统一契约。

### 4. 桌面多窗口入口与 App 层组织
- 建立 `src/app/`：
  - `src/app/routes/`：TanStack Router 路由与页面映射。
  - `src/app/providers/`：统一 QueryClientProvider、SessionGate、ThemeProvider、RealtimeProvider。
  - `src/app/windows/`：承接 Tauri 2 的主窗口、快速编辑窗口、专注助手窗口及通知窗口。
- 保持根目录下 `main.tsx`、`quick-edit-window.tsx` 等入口文件作为轻量桥接，指向 `src/app/windows/`，确保 Vite 构建配置与 `tauri.conf.json` 无缝兼容。

### 5. 认证（Auth）与设置（Settings）特性化
- **`features/auth/`**：聚合 `LoginPage.tsx`、认证上下文、用户 Session 监听与授权验证。
- **`features/settings/`**：聚合全局设置弹窗（`SettingsDialog.tsx`）、外观主题选项、备份恢复与音频反馈偏好。

### 6. 边缘页面领域归巢
- 番茄专注（`Pomodoro`）归入 `features/focus/components/`；
- 周战术计划（`WeeklyPlanning`）与长期使命（`Mission`）归入 `features/time-management/components/`；
- 各 Page 保持轻量路由转发与 `SectionErrorBoundary` 包裹。

### 7. 方案 B 落地：Today 组合看板与核心模型提升
- **定位纠偏**：`Today` 本质为跨领域聚合看板而非独立业务领域。物理移除 `src/features/today/`，正名为 `src/pages/TodayPage.tsx` 及页面级子模块。
- **切片下放**：各 Feature 只负责导出自包含的切片 Widget：
  - `features/time-management` 导出 `<TodayTasksSection />`
  - `features/habit` 导出 `<TodayHabitsSection />`
  - `features/daily-review` 导出 `<TodayReviewSection />`
  - `features/projects` 导出 `<TodayProjectTimeline />`
- **核心实体提升**：将高频流转的基础契约（`Task`、`QuadrantType`、`Project`、`ProjectStage`）提升至 `src/types/`，消除 `projects` 与 `time-management` 间的循环引用。

### 8. API 层 queryOptions 消费闭环
- 各 Feature 的 `use*Data` hooks 必须消费对应 `*Queries.ts` 中定义的 `queryOptions`。
- 不再在 Hook 中重复内联声明 `queryKey` 和 `queryFn`，保证查询选项与预取/失效逻辑 100% 契约一致。

### 9. 状态分类治理与 uiStore 瘦身
- **清除悬浮瞬态**：`hoveredTaskId` 与 `hoveredStageId` 从 `uiStore` 中彻底移除，转为组件局部状态。
- **领域状态下沉**：笔记激活与列表状态下沉至 `features/knowledge/` 或 URL 搜索参数。
- **URL 状态化**：`ProjectsPage` 视图模式与过滤条件改由 TanStack Router search params 驱动，实现持久化与可定位。

### 10. 表单基建化 (React Hook Form + Zod)
- 引入 React Hook Form 与 `@hookform/resolvers/zod`。
- 在 `src/components/ui/form.tsx` 封装统一的 Form 字段包装原语，复杂对话框（`TemplateEditorModal` 等）从分散 `useState` 迁移至 Schema 驱动。

### 11. 巨石组件关注点拆分
- `TaskQuickEdit.tsx`（1600 行）分解为基础信息、象限调度、子任务、富文本笔记等子组件。
- `ProjectsPage.tsx`（1250 行）按侧边栏、看板/甘特图/表格容器及工具栏进行组件化解耦。

### 12. 架构依赖自动化守卫
- 引入 ESLint 规则 `import/no-restricted-paths`，自动拦截后续开发中可能出现的跨 Feature 导入与逆向导入。


## Risks / Trade-offs

- **[Risk 1: 批量文件移动引发大量 Import 路径断裂]**
  → *缓解措施*：分阶段逐步执行，并在旧路径保持向后兼容导出，每阶段严格执行 `pnpm build` 验证。
- **[Risk 2: 今日工作台与多项目/习惯依赖过于紧密]**
  → *缓解措施*：在页面组合层完成拼装，避免循环依赖。
- **[Risk 3: 受管文档漂移]**
  → *缓解措施*：完成代码迁移后同步更新 `docs/FRONTEND.md` 和 `ARCHITECTURE.md`，执行 `ai-harness validate` 确保文档通过门禁。

## Migration Plan

1. **Phase 1**：基础设施建设（`config/`、`queryOptions` 工具、局部 `ErrorBoundary`）。验证 `pnpm build`。
2. **Phase 2**：`knowledge` 特性试点迁移（构建 `src/features/knowledge/`，迁移组件/Hook/Service/Types）。验证 `pnpm build`。
3. **Phase 3**：核心特性迁移与 `src/app/` 收敛（迁移 6 个核心 Feature，搭建 `src/app/`，解耦跨特性调用）。验证 `pnpm build` 与受管文档更新。
4. **Phase 4**：剩余模块全量特性化（Auth、Settings、衍生视图归巢、桌面窗口收敛至 `src/app/windows/` 与 `src/app/` 入口收束）。
