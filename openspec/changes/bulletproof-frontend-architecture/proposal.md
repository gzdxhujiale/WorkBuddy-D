# Proposal: Bulletproof React Frontend Architecture Refactor

## Why

WorkBuddy-D 前端代码目前采用横向技术职责分层（`src/pages/`、`src/components/`、`src/hooks/`、`src/services/`、`src/types/`、`src/utils/` 顶级分散）。随着项目功能不断扩展，开发人员维护单一业务领域（如知识库、项目、打卡习惯）时需要在 5 个以上的顶级目录中频繁跳转，缺乏物理内聚力；且跨领域的直接导入缺乏清晰的单向约束。

引入 `bulletproof-react-architecture` 架构规范，将横向分层演进为“垂直特性切片（Feature-based Slicing）+ 单向依赖流（shared → features → app）+ 标准化 API 查询声明（queryOptions）+ 健壮的多级错误边界”，能够显著降低认知负载，明确模块边界，保障桌面端长期演进的代码健康度。

## What Changes

本变更涵盖 Phase 1 到 Phase 3 的系统性重整：

### Phase 1: 基础设施与契约基线
- **配置与路径集中**：建立 `src/config/env.ts`（使用 Zod 校验环境变量）与 `src/config/paths.ts`（集中定义类型安全路由路径常量）。
- **细粒度错误边界**：在全局 `AppErrorBoundary` 基础上，为主要工作台视图和独立面板增加局部 Error Boundary，防止单个特性异常导致桌面 Webview 整屏崩溃。
- **TanStack Query v5 规范化**：建立统一的 `queryOptions` 声明模式模板，解耦数据获取声明与组件使用。

### Phase 2: 独立特性试点迁移 (Pilot Feature: Knowledge)
- **建立 `src/features/knowledge/`**：将 `components/knowledge/`、`hooks/useKnowledgeQuery.ts`、`services/knowledgeService.ts`、`types/knowledge.ts`、`utils/knowledge*.ts` 完整迁移至特性内。
- **封装 API 层**：在 `features/knowledge/api/` 中组织 `knowledgeService` 与基于 `queryOptions` 的查询/变更导出。
- **验证内聚性与构建**：确保无外部特性侵入，完成编译与渲染验证。

### Phase 3: 核心特性切分与 App 编排层解耦
- **建立核心 Feature 模块**：
  - `src/features/habit/`（习惯与打卡热力）
  - `src/features/projects/`（项目与多阶段管理）
  - `src/features/daily-review/`（复盘）
  - `src/features/time-management/`（四象限、周计划、使命）
  - `src/features/focus/`（专注助手与番茄钟）
  - `src/features/today/`（今日聚焦工作台）
- **建立 `src/app/` 组合层**：
  - 收敛路由配置 `src/app/routes/`。
  - 收敛全局 Providers `src/app/providers/`。
  - 统一桌面端多窗口入口至 `src/app/windows/`。
- **跨 Feature 依赖解耦**：遵循 `shared → features → app` 单向流向，`today` 特性与 `projects`/`habit` 的交互通过 App 页面层组合（Composition）或抽取共享 Task/Project 契约完成，禁止特性间直接穿透导入。
- **文档同步**：同步更新 `docs/FRONTEND.md` 与 `ARCHITECTURE.md`，执行 `ai-harness` 验证。

### Phase 5: 全量过渡垫片清理与严格架构边界落地 (已完成)
- 物理清理所有旧 services、hooks、types 转发垫片文件及废弃目录。
- 根级 router 与 app 全量收拢至 `src/app/`。
- 消除 Windows 大小写文件冲突，补齐各页面局部错误边界。

### Phase 6: 核心领域模型提升与跨 Feature 依赖解耦 (方案 B 落地)
- **共享核心实体提升**：将 `Task`、`QuadrantType`、`Project`、`ProjectStage` 等全应用通用的核心实体定义提升至 `src/types/`，切断 `projects` 与 `time-management` 的循环数据依赖。
- **Today 聚合看板正名与组合化**：将 `features/today` 移出 feature 目录，正名为 App/Page 级组合看板 `src/pages/today/`（或 `src/app/dashboards/today/`）；由各个独立 Feature 导出自包含的切片组件（`<TodayTasksSection />`、`<TodayHabitsSection />`、`<TodayReviewSection />`），在看板层完成纯装配，彻底杜绝跨 Feature 穿透。
- **专注悬浮助手解耦**：将 `FocusAssistant` 的跨领域选择逻辑通过回调或共享选择器解耦。

### Phase 7: API 层标准化与 queryOptions 消费闭环
- **Hooks 消费闭环**：重构各 Feature 的 `use*Data` hooks，使其直接消费各模块 `api/*Queries.ts` 中定义的 `queryOptions`，提供统一的数据缓存、预取和类型推导能力。
- **单体服务模块化**：拆解超大 Service（如 `knowledgeService.ts`），按资源划分独立 API 端点。

### Phase 8: 状态分层治理与 uiStore 瘦身
- **移除全局瞬态状态**：从 `uiStore.ts` 中移除纯组件悬浮状态（`hoveredTaskId`、`hoveredStageId`），由局部 state 或 Context 承接。
- **领域状态下沉**：将笔记与列表激活状态下沉至 Feature 内部或 URL 查询参数。
- **URL 状态化**：将项目看板的视图模式（kanban/gantt/table）与过滤条件绑定至 TanStack Router 搜索参数。

### Phase 9: 表单基础设施与 Schema 驱动改造
- **引入标准表单体系**：集成 React Hook Form 与 `@hookform/resolvers/zod`，在 `src/components/ui/form.tsx` 建立声明式表单基建。
- **复杂编辑组件重构**：将 `TemplateEditorModal`、`CreateProjectDialog` 等包含大量独立 `useState` 的表单重构为 Schema 驱动。

### Phase 10: 巨石组件拆解与关注点分离
- **拆分超大组件**：将 `TaskQuickEdit.tsx`（1600 行）、`ProjectsPage.tsx`（1250 行）等千行巨石组件拆分为高内聚的子组件与展示容器，降低单文件认知负载。

### Phase 11: 架构防腐守卫与端到端构建验证
- **ESLint 限制路径规则**：配置 `import/no-restricted-paths`，在构建与 linter 层物理禁止跨 Feature 导入。
- **门禁验证**：执行 `pnpm build` 与 `ai-harness validate` 确认无回归。

## Capabilities

### New Capabilities
- None (本变更为纯架构与工程目录结构重构，不增加新的产品级行为契约)。

### Modified Capabilities
- None (产品既有功能与业务逻辑行为保持不变；已在 `.openspec.yaml` 声明 `skip_specs: true`)。

## Impact

- **Affected Code**: `src/` 下大部分代码的目录归位及 import 路径更新（保留 `src/components/ui/`、`src/components/pixel/`、`src/lib/` 等共享模块）。
- **APIs & Dependencies**: 不改动 Supabase 数据库、RLS 或 RPC 契约；新增 `zod` 环境变量校验（若尚未引入则复用既有依赖）。
- **Desktop Host**: Tauri 2 窗口入口配置路径按需兼容或更新。
