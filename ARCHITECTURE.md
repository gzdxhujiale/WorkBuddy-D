# ARCHITECTURE.md

## System Overview

WorkBuddy-D 是一款采用 Tauri 2 架构构建的高性能、多窗口桌面个人生产力与专注工作空间应用。

系统的顶层架构由三大核心运行时边界构成：
1. **多 Webview 客户端层**：基于 Webkit/Webview2 运行 React 19 单页应用，包含主工作空间窗口（`index.html`）、任务快捷编辑悬浮窗（`quick-edit.html`）以及桌面专注助手伴侣窗（`focus-assistant.html`）。
2. **Tauri Rust 宿主运行时**：负责管理原生桌面窗口生命周期、系统托盘（Tray）、全局快捷键、本地通知、跨窗口 IPC 事件广播及精细化的 Capabilities 安全权限控制。
3. **Supabase 云端服务与 PostgreSQL 数据库**：提供基于 GoTrue 的 JWT 用户身份认证、PostgreSQL 结构化持久存储、行级安全隔离（RLS）、存储过程（RPC）事务控制以及私有 Realtime Broadcast 实时变更失效广播通道。

```text
+-----------------------------------------------------------------------------------+
|                            Tauri 2 Desktop Runtime                                |
|  +---------------------------+  +--------------------+  +----------------------+  |
|  |   Main Window (React)     |  | Quick Edit Window  |  | Focus Assist Window  |  |
|  | - Pages & Feature UI      |  | - Lightweight Edit |  | - Mini Status & Pet  |  |
|  | - TanStack Query / Router |  +--------------------+  +----------------------+  |
|  | - Zustand (UI Store)      |             |                       |              |
|  | - RealtimeManager (Sync)  |             |                       |              |
|  +---------------------------+             |                       |              |
|                |                           |                       |              |
|                +---------------------------+-----------------------+              |
|                                            | Tauri IPC / Events                   |
|                        +---------------------------------------+                  |
|                        |   Rust Native Core & Capabilities     |                  |
|                        +---------------------------------------+                  |
+--------------------------------------------|--------------------------------------+
                                             | HTTPS / WebSockets
                                             v
+-----------------------------------------------------------------------------------+
|                                Supabase Backend                                   |
|  +-------------------------+  +-----------------------+  +---------------------+  |
|  | Supabase Auth (GoTrue)  |  | PostgREST / RPC API   |  | Realtime Broadcast  |  |
|  +-------------------------+  +-----------------------+  +---------------------+  |
|                                            |                                      |
|                                            v                                      |
|  +-----------------------------------------------------------------------------+  |
|  | PostgreSQL: Tables, RLS Policies, Versioned Triggers & Migration History     |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

前端作为数据库 API 的直连客户端，无需自建中间层 Node.js/Python 服务。所有业务完整性与安全边界由 PostgreSQL 数据库及 RLS/RPC 强力保障。

## Technology Architecture

系统采用现代高效的技术栈组合，各组件架构职责明确：

- **TypeScript**：全栈主开发语言，启用严格类型检查模式（`strict: true`, `noUnusedLocals`, `noUnusedParameters`），保障跨模块契约的类型安全。
- **React 19**：声明式 UI 渲染引擎与组件模型，支撑高频交互、局部渲染与状态派生。
- **Tauri 2 (Rust)**：轻量级跨平台桌面端应用容器，负责系统级资源隔离、原生窗口生命周期、系统托盘管理及系统能力调度。
- **Vite**：现代化前端本地高速开发服务器与生产打包构建工具。
- **Tailwind CSS**：原子化 CSS 与设计令牌（Design Tokens）引擎，统一驱动「现代极简风」与「复古像素 8-Bit 风」双主题切换。
- **TanStack Query (React Query)**：异步服务端状态管理核心，负责数据拉取、自动重试、内存缓存、乐观更新（Optimistic Updates）与防抖写入编排。
- **TanStack Router**：声明式客户端路由管理，驱动主窗口各模块平滑切换。
- **Zustand**：客户端纯 UI 状态管理，托管当前视图选中项、侧边栏折叠、双主题偏好（`app_theme_style`）等临时性交互状态。
- **Arco Design (@arco-design/web-react)**：企业级 UI 基础组件库，深度集成于弹窗、高级选择器、日期拾取等场景，配合特定全局浮层穿透规则。
- **Tiptap**：现代化无头（Headless）富文本编辑器核心，驱动知识库笔记创作与 Markdown 格式编辑。
- **Supabase (PostgreSQL / PostgREST / GoTrue / Realtime)**：后端即服务基础底座，提供完整的身份认证、数据持久化、行级安全隔离、原子级 RPC 事务与实时通知。
- **pnpm**：高效的依赖包与工作区管理工具。

## Repository Structure

仓库源码组织与架构职责对应关系如下：

- `src/App.tsx`, `src/main.tsx` — 应用入口装载、全局 Provider（QueryClient, AuthProvider, RealtimeProvider, TooltipProvider）及窗口路由挂载。
- `src/pages/` — 各业务领域的主路由页面视图（如 `TodayPage`, `TasksPage`, `ProjectsPage`, `KnowledgePage`, `HabitsPage`, `DailyReviewPage`, `SettingsPage`）。
- `src/components/` — 业务组件及通用 UI 原子库：
  - `src/components/today/` — 今日工作台（时间流/四象限工作流、项目甘特时间轴联动）。
  - `src/components/time-management/` — 任务中心四象限看板与周期管理。
  - `src/components/projects/` — 冒险项目看板、阶段管理与甘特图联动。
  - `src/components/knowledge/` — 知识库三栏工作区、目录树、笔记列表与富文本编辑器。
  - `src/components/habit/` — 习惯打卡与连续天数（Streaks）体系。
  - `src/components/daily-review/` — 每日复盘与总结。
  - `src/components/focus/` — 专注助手伴侣与专注时钟。
  - `src/components/ui/` — 深度适配双主题的基础 UI 原子组件（`Button`, `Card`, `Modal`, `Dialog`, `Drawer`, `Item` 等）。
- `src/hooks/` — 数据读取与变更 Hook（`useTasksQuery.ts`, `useKnowledgeQuery.ts`, `useHabitsQuery.ts` 等），封装 React Query 逻辑。
- `src/services/` — 领域数据交互层（`taskService.ts`, `knowledgeService.ts`, `projectService.ts` 等），封装 PostgREST 查询与 RPC 存储过程调用。
- `src/lib/` — 共享基础设施（`supabase.ts`, `queryKeys.ts`, `realtimeManager.ts`, `auth.tsx`, 离线重放队列等）。
- `src/stores/` — Zustand 管理的本地 UI 状态 Store（`useAppStore.ts`, `useThemeStore.ts` 等）。
- `src/types/`, `src/utils/` — 跨模块共享的 TypeScript 接口类型定义与通用计算函数。
- `src-tauri/` — Rust 桌面端源码、Tauri 配置文件（`tauri.conf.json`）、窗口定义与 Capabilities 权限控制。
- `supabase/migrations/` — 权威且只增不改的数据库结构（DDL）、RLS 策略、RPC 函数及触发器迁移历史。
- `docs/` — 长期工程文档、产品规格说明（`docs/product-specs/`）、设计决策与数据库快照。

## Major Components

系统主要由以下五大核心架构组件构成：

### 1. 应用宿主与多窗口系统 (Application Shell & Multi-Window System)
- **职责**：管理主窗口与两个独立轻量级辅助 Webview 窗口（`quick-edit.html` 快速任务编辑浮窗、`focus-assistant.html` 桌面置顶专注助手）的生命周期、窗口尺寸、托盘交互与全局事件广播。
- **输入/输出**：接收系统托盘点击、全局快捷键；向各 Webview 广播窗口状态与主题切换事件。
- **边界**：宿主仅负责窗口容器与系统 API 桥接，不侵入具体业务逻辑。

### 2. 数据访问与缓存引擎 (Data Access & Query Engine)
- **职责**：通过 Services 和 React Query 统一管理对 Supabase 的读取与 RPC 写入，负责查询缓存分发、乐观更新、防抖请求合并与网络错误重试。
- **输入/输出**：接收 UI 组件触发的操作请求；输出响应式的服务端数据模型与加载/错误状态。
- **边界**：向 UI 提供类型安全的 Hook 接口，屏蔽底层 PostgREST/RPC 与 SQL 细节。

### 3. 实时协同与同步管理器 (Realtime Sync Manager)
- **职责**：主窗口持有私有 Broadcast 通道（`user:<id>:sync`），监听数据库触发器发出的提交变更信号，并将事件分发为精准的 `queryKeys` 失效指令；跨窗口通过 Tauri IPC 事件保持协同。
- **输入/输出**：接收 Supabase Realtime 广播事件与 Tauri 本地事件；输出 QueryClient 缓存失效操作。
- **边界**：广播载荷仅为失效标记，绝不携带也不信任具体数据行。

### 4. 知识库与富文本子系统 (Knowledge & Editor Subsystem)
- **职责**：支撑多级知识库目录树、笔记清单与 Tiptap 富文本正文编辑；实现分级按需加载、编辑草稿本地暂存与防抖自动落库。
- **输入/输出**：接收用户实时文档编辑输入；输出格式化 Markdown/HTML 及其结构化索引。
- **边界**：笔记正文与复杂目录数据仅在用户选中时按需加载，杜绝启动时全量拉取。

### 5. 双视觉主题驱动引擎 (Dual Theme System)
- **职责**：全局驱动「现代极简风」与「复古像素 8-Bit 风」的设计令牌与样式类切换，动态适配圆角、边框、硬阴影、游标动画与 Arco 浮层。
- **输入/输出**：接收用户设置或跨窗口同步的主题风格变更；输出全局 CSS 变量与 HTML root class。
- **边界**：纯视觉层适配，不改变任何业务逻辑或数据协议。

## Dependency Boundaries

系统严格执行单向依赖与层级隔离原则，禁止违规反向依赖：

1. **UI 层 -> Hook/Service 层**：
   - 页面与组件（`src/pages/`, `src/components/`）只能依赖 `src/hooks/`、`src/stores/` 和 `src/types/`。
   - **严禁**在 UI 组件内部直接调用 `src/services/` 或直接操作 `supabaseClient`。
2. **Hook 层 -> Service 层**：
   - `src/hooks/` 负责编排 React Query，调用 `src/services/` 进行实际网络交互。
3. **Service 层 -> 基础设施层**：
   - `src/services/` 依赖 `src/lib/supabase.ts`，专注于数据转换与后端交互。
   - **严禁** Service 层依赖 React 组件、Hook 或 Zustand UI Store。
4. **状态隔离边界**：
   - Zustand 状态库（`src/stores/`）仅管理纯 UI 瞬态，**严禁**导入或镜像服务端持久化数据作为独立真值源。
5. **共享层无上层依赖**：
   - `src/lib/`, `src/utils/`, `src/types/` 严禁反向依赖 `src/components/`, `src/pages/`, `src/hooks/`。

## Data Flow

系统中的核心数据流分为查询读取流与乐观变更写入流：

### 1. 数据读取流 (Query Read Flow)
```text
用户操作/页面加载
  -> 页面组件调用业务 Hook (例如: useTasksQuery)
  -> TanStack Query 检查内存缓存 (Cache Hit / Stale)
  -> 若缓存失效，触发 matching Service (taskService.getTasks)
  -> Service 携带 JWT 调用 Supabase PostgREST API
  -> PostgreSQL 校验 user_id 与 RLS 策略
  -> 返回受保护的结构化数据
  -> 更新 TanStack Query 缓存并通知观察者
  -> React 组件接收新数据触发 UI 渲染
```

### 2. 数据写入与乐观更新流 (Mutation & Optimistic Flow)
```text
用户触发操作 (例如: 完成任务 / 拖拽排序)
  -> 组件调用 Mutation Hook (例如: useUpdateTaskMutation)
  -> Hook 立即触发 onMutate: 取消未决请求，对本地 Query 缓存执行乐观更新 (UI 零延迟响应)
  -> Service 发起 Supabase RPC 事务请求 (附带当前已知的 updated_at 时间戳)
  -> 数据库执行原子事务与版本并发检查 (若版本不匹配则抛出 VERSION_CONFLICT)
  -> 数据库提交事务，并由 Postgres 触发器向 Realtime Broadcast 发送提交信号
  -> 前端收到 RPC 成功响应: 以后端权威返回行覆盖乐观值
  -> 若请求失败: 执行 onError 回滚本地缓存至快照，并弹出 Toast 错误提示
```

## State Management

系统将状态严格划分为四种类型，职责与生命周期互不混淆：

1. **服务端状态 (Server State)**：
   - **托管者**：TanStack Query (`@tanstack/react-query`)。
   - **内容**：任务列表、项目看板、知识库目录与笔记正文、习惯打卡记录、复盘历史等。
   - **真值源**：Supabase PostgreSQL 数据库。前端缓存仅为临时投影，通过权威 `queryKeys` 进行自动失效与生命周期管理。
2. **客户端 UI 状态 (Client UI State)**：
   - **托管者**：Zustand (`src/stores/`)。
   - **内容**：当前激活的侧边栏菜单、高亮选区、双视觉主题体系设置（`app_theme_style`）、折叠展开偏好等。
   - **真值源**：客户端本地内存及 LocalStorage。
3. **组件局部状态 (Local Component State)**：
   - **托管者**：React `useState` / `useReducer`。
   - **内容**：表单即时输入内容、模态框/抽屉开合、富文本编辑器临时选区与编辑草稿。
4. **窗口级会话状态 (Window Session State)**：
   - **托管者**：`WindowSessionGate` / `AuthProvider`。
   - **内容**：Supabase Session、当前登录用户信息，各独立 Webview 窗口共享主会话状态。

## Interfaces and Integrations

系统与外部系统及原生环境的集成接口定义如下：

### 1. Supabase 后端接口
- **PostgREST HTTP API**：通过 `@supabase/supabase-js` 客户端执行标准的类型安全 CRUD 查询。
- **PostgreSQL RPC 接口**：执行复杂业务事务，如 `reorder_project_stages`、`complete_task_with_habit` 等，确保多表操作的原子性与版本一致性。
- **Supabase Auth (GoTrue)**：基于 JWT 的无状态身份认证与会话刷新。
- **Realtime Broadcast WebSocket**：监听私有通道 `user:<user_id>:sync`，接收行级数据提交触发器发送的轻量失效信号。

### 2. Tauri 桌面原生 IPC
- **Window Management API**：创建、展示、隐藏、置顶独立 Webview 窗口（快捷编辑窗、悬浮助手）。
- **System Tray & Notifications**：注册托盘菜单与系统原生推送通知。
- **Cross-Window Event Bus**：利用 Tauri 全局事件（如 `workbuddy:theme-style-change`）在多窗口间即时广播风格偏好变更。

## Runtime and Deployment

系统在运行时的部署与承载拓扑如下：

- **桌面宿主模型**：应用以单原生进程承载，在 Windows 环境下调用 WebView2 运行时，在 macOS/Linux 环境下调用 WebKit 运行时。
- **多 Webview 并存**：
  - `main` 主窗口：承载完整工作空间界面；
  - `quick-edit` 辅助窗口：无边框轻量级快捷任务收集/编辑浮窗；
  - `focus-assistant` 辅助窗口：轻量级桌面悬浮置顶专注时钟与桌宠伴侣。
- **打包与分发**：
  - 前端静态 Bundle 由 Vite 构建输出至 `dist/` 目录；
  - Tauri CLI 将 Rust 原生可执行文件与前端静态资源打包为目标平台安装包（如 Windows `.msi` / `.exe`）。
- **无自建服务器**：无需运维任何独立的 Node.js / Python 容器或网关，直接面向 Supabase 云端实例通信。

## Cross-Cutting Concerns

系统横切关注点的架构处理与详细文档路由指引：

- **视觉与交互系统**：涵盖「现代极简风」与「复古像素 8-Bit 风」双主题体系及 5 级 Elevation 架构。详见 [docs/DESIGN.md](docs/DESIGN.md)。
- **前端规范与性能优化**：涵盖组件拆分、Hook 封装、Tiptap 富文本架构与防抖落库。详见 [docs/FRONTEND.md](docs/FRONTEND.md)。


## Architectural Invariants

在系统架构演进过程中，必须永久遵守以下架构不变式：

1. **UI 与数据层严格解耦**：前端 UI 禁止绕过 Service/Hook 逻辑直接访问数据库。
2. **PostgreSQL 为单一权威源**：所有业务时间戳、完成状态、排序位次及软删除记录以数据库提交结果为唯一真值，客户端时钟仅用于展示。
3. **实时广播为无状态失效标记**：Broadcast 通道仅传输失效信号，不传输敏感数据行，拉取数据必须重新走 RLS 过滤。
4. **知识库按需分级加载**：严格维护按需加载边界，先拉取目录结构，正文内容延迟加载。
5. **数据库迁移历史不可变**：已执行的迁移文件严禁修改，所有结构变更只能追加新迁移。
6. **桌面原生权限最小化**：严禁向无需系统权限的辅助窗口过度授予 Tauri Capabilities。

## Architectural Decisions

系统关键架构决策记录（ADR）：

### 1. 采用 Tauri 2 + Supabase 无独立后端架构
- **决策**：选用 Tauri 2 搭配 Supabase BaaS 作为全站技术底座，不维护独立的 Node.js/Go 后端服务。
- **理由**：极大降低个人生产力软件的部署与运维成本，Tauri 2 内存占用极低且启动极快；Supabase 的 RLS 和 RPC 能够满足所有复杂业务安全与事务要求。
- **后果**：所有权限与并发控制逻辑必须沉淀至 PostgreSQL RLS 与 RPC 函数中。

### 2. 双主题体系的 Token 化抽象驱动
- **决策**：通过底层 CSS 变量与 Tailwind 设计令牌统一驱动「现代简洁」与「复古像素」双套视觉体系。
- **理由**：赋予应用独特的像素复古 RPG 质感与严肃现代办公质感，同时避免为两种风格编写两套重复的业务组件。
- **后果**：所有通用 UI 组件与业务组件必须严格使用语义化设计 Token，禁止内联硬编码色值。

### 3. 基于 RPC 的版本受控原子并发控制
- **决策**：在涉及多阶段排序、任务多维度批量移动等复杂场景下，使用自定义 Postgres RPC 函数并传递 `updated_at` 时间戳。
- **理由**：避免网络延迟或多端操作引发的数据覆盖与脏写问题。
- **后果**：相关写操作需要统一处理 `VERSION_CONFLICT` 错误并回滚前端乐观状态。

## Known Constraints

当前系统存在的已知边界与物理约束：

- **桌面平台专用**：当前架构专为桌面多窗口设计，暂未针对移动端（iOS/Android）或 Web 浏览器独立部署进行适配。
- **单主广播长连接归属**：为避免多 Webview 产生多个重复的 Supabase Realtime 连接，仅主窗口维持 WebSocket 长连接，次级窗口通过 Tauri 本地事件同步。
- **自动化测试覆盖度**：目前仓库以 TypeScript 编译构建与严格类型检查为主要自动化保障，暂无端到端自动化测试套件，需结合手动验证。

## Evolution Guidance

指导系统未来健康演进的原则与规范：

1. **规范化变更流转**：任何新增功能或核心行为改动，必须进入 `openspec/changes/` 创建标准化提案，包含规约 Delta、设计与任务清单。
2. **架构边界维护**：新增功能模块必须在 `src/pages/`、`src/components/`、`src/hooks/` 和 `src/services/` 中建立清晰的职责边界，不可混杂。
3. **数据库变更合规**：表结构或安全策略变更必须在 `supabase/migrations/` 中创建时间戳命名的追加迁移，并及时更新 `docs/generated/db-schema.md`。
4. **组件复用优先**：新增 UI 必须优先复用 `src/components/ui/` 基础原子库与 Arco 封装组件，保持双主题与 5 级 Elevation 架构的一致性。
