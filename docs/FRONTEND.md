# Frontend Engineering Guide

## Baseline & Tech Stack (技术栈基线与严格模式)

WorkBuddy-D 的前端运行于 Tauri 2 多 Webview 桌面宿主环境，支持通过 Vite 开发服务器进行独立调试与生产构建。当前工具链和依赖范围以 `package.json` 与 `pnpm-lock.yaml` 为权威事实依据。

- **语言与编译**：TypeScript 5.8.3，启用严格模式（`strict: true`、`noUnusedLocals: true`、`noUnusedParameters: true`、`noFallthroughCasesInSwitch: true`）；统一使用路径别名 `@/*` 映射至 `src/*`。
- **界面与路由**：React 19.1.0、TanStack Router 1.170.21、React Hook Form 7.89.0、Zod 4.6.5、Lucide React、Framer Motion 与 @dnd-kit 拖拽套件。
- **样式系统**：Tailwind CSS 4.3.3 与 `src/index.css` 声明的 5 级 Elevation 语义化 CSS 变量。
- **服务端状态管理**：TanStack Query 5.101.4，负责异步请求生命周期调度、智能缓存、去重与增量失效。
- **客户端交互状态**：Zustand 5.0.14，负责管理跨组件的纯净会话 UI 状态。
- **富文本编辑**：Tiptap 3.29.2 全套扩展（表格、任务列表、Markdown、代码块）与 `reactjs-tiptap-editor`。
- **桌面端集成**：`@tauri-apps/api` v2 与 Tauri 官方插件（`autostart`、`notification`、`opener`）。
- **工程构建命令**：`pnpm dev` 启动 Vite 开发服务；`pnpm build` 执行生产级类型检查与打包；`pnpm lint:boundaries` 校验特性模块单向依赖边界。

## Source Structure & Ownership (源码分层与所有权边界)

前端架构贯彻 Bulletproof React 的特性驱动架构（Feature-based Architecture），按业务领域组织代码资产，强化物理内聚与单向依赖流向。

- `src/app/` — 应用组合层：包含应用级 Provider 装配（`AppProviders.tsx`）、集中式路由配置（`routes/`）、桌面多 Webview 窗口组件（`windows/`）与主应用编排（`App.tsx`）。
- `src/config/` — 全局环境与路由路径配置：`env.ts` 与 `paths.ts`（集中式类型安全路由常量）。
- `src/features/<domain>/` — 垂直特性模块，聚合领域内聚资产：
  - 核心特性涵盖 `projects/`、`habit/`、`knowledge/`、`daily-review/`、`time-management/`、`focus/`、`auth/`、`settings/`。
  - 每个特性收敛其专有资产：`api/`（Go REST API 适配与 TanStack Query v5 `queryOptions`）、`components/`（领域专属 UI）、`hooks/`（领域业务逻辑）、`schemas/`（基于 Zod 的表单模式）、`types/`（契约类型定义）与 `utils/`（领域纯函数计算）。
- `src/pages/` — 页面路由视图组合看板（如 `TodayPage.tsx` 装配各 Feature 导出的 Section 组件；`ProjectsPage.tsx` 组合侧边栏与看板），并包裹局部容错边界（`SectionErrorBoundary`）。
- `src/components/ui/` 与 `src/components/pixel/` — 跨特性通用基础 UI（包括声明式表单基建 `form.tsx`、按钮、对话框、抽屉、选择器）、像素图标及局部容错边界（`SectionErrorBoundary.tsx`）。
- `src/components/layout/` — 桌面主布局与侧边栏导航组件（`AppLayout.tsx`）。
- `src/lib/` — 核心基础设施：统一 HTTP 客户端（`apiClient.ts`）、WebSocket 增量客户端（`wsClient.ts`）、查询键工厂与延时常量（`syncEngine.ts`）、实时管理器（`realtimeManager.ts`）、离线持久化队列（`offlineSyncQueue.ts`）、文档快照版本对比引擎（`snapshotDiff.ts`）与通用工具。
- `src/stores/` — 跨特性的全局客户端纯净 UI 状态（如 `uiStore.ts`）。
- `src/types/` — 共享跨领域核心实体与数据库模式契约类型（`task.ts`、`project.ts`、`database.ts`）。
- `src/hooks/` — 跨领域通用共享客户端 Hooks（如 `useAppThemeStyle.ts`、`useDebouncedMutation.ts`、`useOptimisticSync.ts`）。
- 顶层 Webview 窗口载体与入口：`index.html`（`src/main.tsx`）、`note-window.html`（`src/note-window.tsx`）、`quick-edit.html`（`src/quick-edit-window.tsx`）、`focus-assistant.html`（`src/focus-assistant-window.tsx`）、`notification-toast.html`（`src/notification-toast-window.tsx`）。

### 领域内聚与单向依赖规则

- 新增功能资产优先就近归属于具体的 `src/features/<domain>/` 目录；仅当两个及以上领域存在明确复用事实时，方可提炼至 `components/ui/`、`lib/`、`types/` 或 `config/`。
- 依赖关系严格遵循自底向上流动：`shared (config/lib/types/components) → features → app/pages`。
- 特性模块之间保持相互解耦，跨特性的数据组合通过 App 页面层（Composition Pattern）进行编排，由 ESLint `import-x/no-restricted-paths` 门禁（`pnpm lint:boundaries`）执行自动化校验。

## UI System & Styling Ownership (组件库与样式所有权分工)

- `src/components/ui/` 是通用基础组件的所有者，统一封装 Button、Dialog、Drawer、Input、Select、DropdownMenu、Form 等高频控件。
- 严格遵循 5 级 Elevation 视觉层级体系：
  - **L0**：桌面宿主外壳（Window Frame / Custom Titlebar）。
  - **L1**：主画布背景（Primary Canvas / Viewport）。
  - **L2**：内容承载容器（Cards / Sidebars / Content Panels）。
  - **L3**：交互式控件层（Inputs / Action Buttons / Badges）。
  - **L4**：顶层浮层与遮罩（Modals / Popovers / Tooltips，统一设置 `z-index: 1100` 隔离防裁切）。
- 双主题风格体系与像素资产：
  - 全面支持「现代极简」与「复古 8-Bit 像素」双主题无缝切换。
  - `src/index.css` 定义设计令牌（CSS Variables：`--background`, `--card`, `--border`, `--accent` 等）与动画基线（如 `steps(4, jump-none)` 阶梯展开、`animate-pixel-hop` 游标跳跃）。
  - `src/components/pixel/` 封装专用像素图标与像素徽章（`PixelBadge.tsx`）。
- Tailwind CSS 4 工具类与样式规范：基于语义变量与 Tailwind 工具类组合界面，保持样式声明的单一真值源。设计评审基线遵循 [docs/DESIGN.md](DESIGN.md)。

## State Classification & Data Fetching (5类状态划分与远端缓存)

系统严格按照数据所有权划分为 5 类状态：

1. **远端服务端状态 (Remote Server State)**：任务、项目、习惯、笔记、复盘等持久化实体。由 TanStack Query 5 统一管理，通过各 feature 目录下的 `*Queries.ts` 标准化声明 `queryOptions`，支持缓存、去重与精准失效。
2. **URL 与导航状态 (URL & Navigation State)**：由 TanStack Router 统一托管，路由路径与查询参数（视图模式、过滤条件）直接驱动视图状态。
3. **全局客户端 UI 状态 (Global Client UI State)**：仅存储无服务端的纯净会话交互偏好（侧边栏折叠、全局主题、浮层激活），由 Zustand `uiStore` 承载。
4. **局部组件交互状态 (Local Interactive State)**：组件内部瞬态（悬停、局部展开、轻量动画），使用 React `useState` / `useReducer`。
5. **表单与编辑草稿状态 (Form & Draft State)**：由 React Hook Form 与 Zod 校验驱动；富文本草稿由 Tiptap 编辑器本地持有，提交或写后缓冲保存成功后以 Query 缓存为准。

### 数据流转链路

- **读操作流**：`Component/Page → useQuery(queryOptions) → featureService → apiClient.get → Go REST API`。
- **写操作流**：`Component/Page → useMutation → featureService → apiClient.post/put/patch → Go REST API`。
- **增量广播与失效流**：`Go ws.Hub → WebSocket (ENTITY_DELTA) → wsClient.ts → realtimeManager.ts → queryClient.invalidateQueries(queryKey)`。
- **断线重连补偿流**：`wsClient.ts (syncMissedDeltas) → GET /api/v1/sync?since_seq= → 依次触发历史增量事件与缓存刷新`。
- **离线持久化重放**：`offlineSyncQueue.ts` 持久化暂存网络异常操作，待网络恢复后依次重放。

## Routing & Data Lifecycle (路由架构与数据生命周期)

- 路由表在 `src/app/routes/router.tsx` 集中声明，`/` 重定向到 `/today`；页面组件采用 `React.lazy` 懒加载。
- **意图感知预加载与并发调度**：路由配置 50ms 悬停延迟预拉取页面代码包与数据资源；跨视图切换采用 React 19 并发过渡（Concurrent Transition）调度，确保用户输入响应零卡顿。
- **根 Provider 装配与认证生命周期**：
  - `src/main.tsx` 装配 `QueryClientProvider` 与 `AppErrorBoundary`。
  - `App.tsx` 监听 `authService` 会话状态，登录状态切换时执行 `queryClient.clear()` 清理旧账户缓存，使用新会话挂载路由树与 `realtimeManager`。
- **知识库分级按需加载**：
  - 首屏秒级加载知识库与目录树结构元数据，笔记正文根据用户选中动态触发单笔拉取，避免大体量富文本阻塞首屏渲染。

## Interactive States & Feedback (异步状态与统一交互反馈)

- **加载状态 (Loading)**：优先使用局部 Skeleton 骨架屏占位，保障页面整体框架可用。
- **乐观更新 (Optimistic Updates)**：打卡、任务勾选完成、拖拽排序等高频动作执行乐观 UI 更新，后台异步提交；写入异常时自动回滚至前置缓存并 Toast 告警。
- **错误与恢复 (Error & Recovery)**：局部异常由 `SectionErrorBoundary` 捕获隔离，展示重试按钮与人类可读提示，保护整个桌面窗口免受白屏崩溃。
- **提交防重 (Submitting)**：Mutation 状态绑定按钮禁用态与加载动画，防止表单重复提交。
- **离线反馈 (Offline Feedback)**：离线写入由 `offlineSyncQueue` 显示暂存徽章，并在网络恢复后自动提交。
- **资源生命周期释放**：所有 WebSocket 监听、页面定时器与窗口事件在 React 组件卸载或 Webview 销毁时显式解绑。

## Frontend Invariants & Verification (前端架构不变量与验证准出)

- 页面与组件以 Hooks 和 Services 作为数据访问边界，底层请求统一通过 `apiClient` 与 `wsClient` 调度。
- TanStack Query 专责服务端缓存生命周期，Zustand 专责客户端 UI 偏好，实现远端与本地状态的清晰边界。
- WebSocket 变更载荷作为精确失效与增量凭证，各 Webview 通过统一查询键重新读取权威数据。
- 数据库并发写操作显式传递 `lockVersion` 参与乐观锁校验。
- 样式与主题统一使用 `src/index.css` 声明的语义化 CSS 变量与 Tailwind 语义类，遵循 5 级 Elevation 规范。
- 模块依赖严格遵守 `shared → features → app/pages` 单向流动，特性间解耦由 `pnpm lint:boundaries` 门禁保障。
- 前端准出验证命令：
  - 执行 `pnpm build`（`tsc && vite build`）通过类型检查与生产打包。
  - 执行 `pnpm lint:boundaries` 通过特性间依赖架构门禁。
  - 文档修改后运行 `ai-harness validate docs/FRONTEND.md --json` 确认 0 错误。
