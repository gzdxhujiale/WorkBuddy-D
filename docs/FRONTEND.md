# Frontend Engineering Guide

## Baseline & Tech Stack

WorkBuddy-D 的前端运行于 Tauri Webview，也可由 Vite 开发服务器启动。Vite 使用 React 插件构建 React 19 与 TypeScript 应用；当前工具链和依赖范围以 `package.json` 与 `pnpm-lock.yaml` 为准。

- **语言与编译**：TypeScript `strict`、`noUnusedLocals`、`noUnusedParameters` 与 `noFallthroughCasesInSwitch` 已启用；路径别名 `@/*` 指向 `src/*`。
- **界面和路由**：React 19、TanStack Router、React Hook Form、Zod、Arco Design、Tailwind CSS 4 与 CSS variables。
- **服务端状态**：TanStack Query 负责异步请求、缓存和失效。
- **客户端全局状态**：Zustand 管理共享 UI 状态。
- **富文本**：Tiptap 与 `reactjs-tiptap-editor` 支持知识库内容编辑。
- **桌面集成**：`@tauri-apps/api` 连接 Tauri 2 的窗口与事件接口。
- **构建命令**：`pnpm dev` 启动 Vite；`pnpm build` 执行 `tsc && vite build`；`pnpm lint:boundaries` 校验特性间单向架构边界；`pnpm tauri` 启动桌面开发环境。

## Source Structure & Ownership

代码采用 Bulletproof React 的特性驱动架构（Feature-based Architecture），按业务领域聚合实现、强化模块物理内聚与单向依赖流向，将组件、API 访问与状态逻辑放在最接近使用点的位置。参见 [Bulletproof React: Project Structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md)。

- `src/app/` — 应用组合层：包含应用级 Provider 装配（`AppProviders.tsx`）、路由导出（`routes/`）、桌面多 Webview 窗口组件（`windows/`）与主应用编排（`App.tsx`）。
- `src/config/` — 全局配置与环境声明：`env.ts`（基于 Zod 校验运行时环境变量）与 `paths.ts`（集中式类型安全路由路径常量）。
- `src/features/<domain>/` — 垂直特性模块，聚合领域内聚资产：
  - 核心特性涵盖 `projects/`、`habit/`、`knowledge/`、`daily-review/`、`time-management/`、`focus/`、`auth/`、`settings/`。
  - 每个特性内部视需要收敛其 `api/`（Supabase 数据读写与 TanStack Query v5 `queryOptions`）、`components/`（领域专有 UI）、`hooks/`（领域逻辑）、`schemas/`（领域表单 Zod 校验）、`types/`（契约类型）与 `utils/`（领域纯计算）。
- `src/pages/` — 页面级路由与组合看板视图（如 `TodayPage.tsx` 装配各 Feature 导出的 Section 组件；`ProjectsPage.tsx` 组合 `ProjectSidebar` 与 `ProjectHeaderToolbar`），并包裹局部 `SectionErrorBoundary`。
- `src/components/ui/` 与 `src/components/pixel/` — 跨特性通用基础 UI（包括 `form.tsx` 声明式表单基建）、像素图标及局部容错边界组件（`SectionErrorBoundary.tsx`）。
- `src/components/layout/` — 桌面主布局与侧边栏导航组件（`AppLayout.tsx`）。
- `src/lib/` — 核心基础设施：Supabase 客户端、认证会话管理、查询键工厂（`syncEngine.ts`）、私有 Realtime 广播管理、离线队列与通用工具函数。
- `src/stores/` — 跨特性的全局客户端 UI 状态（纯净会话 UI 状态，如 `uiStore.ts`）。
- `src/types/` — 共享领域核心实体与数据库 Schema 类型（如 `task.ts`、`project.ts`、`database.ts`）。
- `src/hooks/` — 跨领域通用共享客户端 Hooks（如 `useAppThemeStyle.ts`、`useDebouncedMutation.ts`、`useOptimisticSync.ts`）。
- `src-tauri/` — 多 Webview 原生壳；入口页面分别由仓库根目录 HTML 与 `src/` 下窗口入口承接。

### Domain locality and dependency direction

新增功能优先将只服务一个领域的组件、Hook、类型和工具放在 `src/features/<domain>/` 对应目录内；多个领域确有复用时，再提升至 `components/ui/`、`lib/`、`types/` 或 `config/`。

依赖保持严格的单向流向：`shared (config/lib/types/ui) → features → app/pages`。特性之间禁止直接穿透导入（No cross-feature imports），跨特性的数据组合通过 App 页面层（Composition Pattern）或共享核心契约协调，并由 ESLint `import-x/no-restricted-paths` 自动化门禁保障。模块通过明确导出的函数与类型通信，保持职责内聚并杜绝相互穿透。Bulletproof React 关于按功能分组和单向依赖的建议见 [Project Structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md)。

## UI System & Styling Ownership

- `src/components/ui/` 是项目通用基础组件的所有者；优先复用其中的 Button、Dialog、Drawer、Input、Select、Form 等组件。
- Arco Design 为已有复杂控件提供实现；应用侧在业务需要时包装第三方交互，使设计样式和调用方式保持一致。
- `src/components/pixel/` 与 `src/index.css` 共同承载 8-Bit 像素表现和全局主题令牌；业务组件基于语义类和变量组合界面。
- Tailwind CSS 4 管理常规布局和语义化工具类；`src/index.css` 定义 CSS 变量、组件全局规则和主题基线。
- 新增通用组件时先确认跨领域复用场景，再抽象 API；领域专属呈现留在相应业务目录。这个“先识别重复再抽象、封装第三方库”的边界与 [Bulletproof React: Components and Styling](https://github.com/alan2207/bulletproof-react/blob/master/docs/components-and-styling.md) 一致。
- 具体视觉层级、双主题令牌与设计判断以 [DESIGN.md](DESIGN.md) 和 `src/index.css` 为准。

## State Classification & Data Fetching

先判断状态的所有者，再选择状态工具；同一份持久化远端事实保持一个权威来源。以下类别用于新增需求归属，项目当前各能力按实际使用情况落地：

1. **远端服务端状态**：任务、项目、习惯、笔记、复盘等由 TanStack Query 管理缓存、请求生命周期与失效；定义通过 `src/features/*/api/*Queries.ts` 中声明的 `queryOptions` 标准化封装。
2. **URL/导航状态**：可分享或需在刷新后恢复的导航选择属于 Router。当前路由表在 `src/app/routes/router.tsx`；项目视图模式与过滤条件等通过 TanStack Router search params 管理。
3. **全局客户端 UI 状态**：跨页面共享的展开、选择和主题交互放在 `src/stores/uiStore.ts` 等 Zustand Store。
4. **局部交互状态**：仅当前组件生命周期需要的开合、悬停和临时选择使用 React `useState`/`useReducer`。
5. **表单与编辑草稿**：采用 React Hook Form 与 Zod（基于 `src/components/ui/form.tsx` 声明式基建与 `schemas/` 驱动校验）；未提交输入由表单/编辑器本地状态所有；成功持久化后以 Query 返回或失效后的数据为准。Tiptap 文档正文按选中的笔记加载。

数据读取和写入采用 `component/page → hook → service → supabase client → PostgreSQL/RPC`。组件只消费领域 Hook 暴露的状态和动作；Service 封装表名、列、RPC 和结果适配。`src/types/database.ts` 维护数据库契约类型，领域核心实体位于 `src/types/`。

Realtime 由 `RealtimeProvider` 和 `src/lib/realtimeManager.ts` 管理。私有 `user:<id>:sync` 通道只提供变化提示；订阅事件映射至 Query Key 失效，远端查询重新按 RLS 获取记录。离线写入通过 `src/lib/offlineSyncQueue.ts` 支持的服务流程恢复；其具体适用范围以 `src/lib/sync.ts` 和各 Service 调用为准。

Bulletproof React 将可从服务器取得的远端数据与客户端 UI 状态分开处理，并建议把请求封装在功能/API 模块中；本仓库对应层为 Query Hook 与领域 Service。参考 [State Management](https://github.com/alan2207/bulletproof-react/blob/master/docs/state-management.md) 和 [API Layer](https://github.com/alan2207/bulletproof-react/blob/master/docs/api-layer.md)。

## Routing & Data Lifecycle

- 路由树在 `src/app/routes/router.tsx` 定义，`/` 重定向到 `/today`；页面使用 `React.lazy` 延迟导入。
- `src/main.tsx` 装配 QueryClient Provider 与 `AppErrorBoundary`；`App.tsx` 检测 Supabase Session 后显示登录视图或带 Auth/Realtime Provider 的应用路由。
- 登录用户变化时清理 Query 缓存和 UI 用户作用域，再使用新 Session 渲染已认证区域，避免上一个账户的缓存展示给下一个账户。
- 页面与领域组件通过 Hook 访问查询状态；Query Key 由 `src/lib/syncEngine.ts` 等现有查询键工厂统一维护，并按用户标识隔离。
- 知识库先获取目录/列表所需数据；笔记详情通过 `useKnowledgeQuery` 的选择行为触发按需读取，保持正文延迟加载。
- 面向主窗口的离线同步和 Realtime 生命周期应由已认证用户及主 Webview 状态驱动，并清理监听器/订阅。

## Interactive States & Feedback

- **加载**：根据查询粒度展示局部加载反馈，使页面导航框架和已加载内容保持可用。
- **空数据**：由领域视图说明当前没有数据，并提供与该视图有关的下一步操作。
- **错误**：查询/变更 Hook 将失败状态反馈给界面；可恢复写入展示重试或重新加载路径，乐观更新在写入失败时回滚或失效重取。
- **提交中**：按钮和表单根据 Mutation 状态反馈不可重复提交状态；输入草稿在明确提交或保存后转换为远端状态。
- **离线**：由离线写入流程区分可排队网络故障与业务/权限/版本冲突，并向用户表达操作是否暂存、是否需要重新处理。
- **无障碍交互**：控件保持语义化元素和可访问名称；键盘操作与焦点行为跟随组件职责，使用原生语义或 Arco/UI 封装能力。
- **定时器/订阅**：通过 Effect 生命周期或领域管理器集中启动，并在用户、窗口或组件生命周期结束时释放资源。

## Frontend Invariants & Verification

- 页面与组件以 Hooks 和 Services 作为数据边界；Supabase 查询细节归 Service。
- Query 缓存承载远端权威数据的客户端副本；Zustand 只保存 UI 偏好与交互状态。
- Broadcast 仅使 Query 失效；状态更新以重新读取的 RLS 结果为准。
- 用户数据的授权、审计时间及版本转换由 PostgreSQL/RPC 决定；客户端时间仅用于展示和本地临时交互。
- 知识库正文依选择按需读取；新增 UI 同时遵循 `docs/DESIGN.md` 指定的主题系统。
- 依赖方向保持为共享能力 (config/lib/types/ui) → features → app/pages；提升共享模块需要明确的跨领域复用证据。
- 前端构建与类型检查命令为 `pnpm build`。涉及原生配置时增加 `cd src-tauri && cargo check`；文档改动按 Harness 门禁执行 `ai-harness validate docs/FRONTEND.md --json`。

## References

- [Bulletproof React](https://github.com/alan2207/bulletproof-react) — 参考其按领域组织代码、保持依赖单向、贴近使用点放置模块、状态职责分离、组件复用与错误反馈等原则；本指南按 WorkBuddy-D 已有目录和 Tauri/Supabase 架构适配。
