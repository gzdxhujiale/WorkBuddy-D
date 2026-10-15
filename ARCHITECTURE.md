# ARCHITECTURE.md

## System Topology & Overview (系统全局拓扑与职责边界)

WorkBuddy-D 是由 Tauri 2 桌面宿主、React 19 多 Webview 前端、Go 1.26 独立后端服务与 PostgreSQL（Neon / 本地环境）构建的现代化个人规划与专注桌面系统。

```text
Tauri 2 / Rust Desktop Host (src-tauri/)
  ├─ main Webview (index.html -> src/main.tsx)
  ├─ quick-edit Webview (quick-edit.html -> src/quick-edit-window.tsx)
  ├─ focus-assistant Webview (focus-assistant.html -> src/focus-assistant-window.tsx)
  └─ notification Webview (notification-toast.html -> src/notification-toast-window.tsx)
       │ HTTP REST API (Bearer JWT) & WebSocket (ENTITY_DELTA)
       ▼
Go 1.26 Independent Backend Service (server/cmd/server)
  ├─ Gin Engine (RESTful API endpoints /api/v1/*)
  ├─ JWT Middleware & Auth Handler (/api/v1/auth/*)
  ├─ WebSocket Hub & Sync Handler (/ws, /api/v1/sync?since_seq=)
  ├─ NoteBufferManager (In-memory write-behind buffer & 2.5s flush timer)
  └─ pgxpool (Bounded PostgreSQL connection pool, max=25 conns)
       │ Goose embedded migrations & sqlc type-safe queries
       ▼
PostgreSQL Database (Neon Serverless Postgres / Local Docker)
  ├─ Clean relational schema (users, tasks, habits, projects, notes, daily_reviews)
  ├─ Sequential event log (entity_change_logs with monotonic seq_id)
  ├─ Trigram GIN index (notes title & content pg_trgm search)
  └─ Application-level tenant isolation via foreign key user_id
```

- **React 前端**：负责多 Webview 窗口内的视图呈现、路由导航、交互反馈与状态调度。通过 TanStack Query、Zustand、apiClient 与 wsClient 与后端进行高效通信。
- **Tauri / Rust 宿主**：负责桌面多窗口生命周期调度、多显示器透明通知悬浮窗、系统托盘常驻交互、全局快捷键捕获、原生单实例运行与窗口位置尺寸持久化。
- **Go 独立后端 (`server/`)**：作为全系统数据变更与业务逻辑的唯一权威源。基于 Gin 框架提供 RESTful API，通过 JWT 落实请求鉴权，借助 `pgxpool` 提供受控的高性能连接池，运行 `NoteBufferManager` 写后缓冲池平滑磁盘 I/O，并利用 WebSocket Hub 向已连接窗口增量广播携带 `seq_id` 的变更事件。
- **PostgreSQL 数据库**：采用 Neon Serverless PostgreSQL 或本地 Docker 容器，保存业务全量实体与单调递增的增量同步日志表（`entity_change_logs`），通过主外键强约束保证租户数据隔离。

## Repository Boundaries (顶层资产与仓库边界)

- `src/` — React 应用源码，包含应用组合装配（`app/`）、全局环境与路由配置（`config/`）、业务特性领域（`features/`）、共享基础设施（`lib/`、`types/`、`components/`）与各 Webview 独立入口。
- `src-tauri/` — Rust 桌面宿主工程，包含 Tauri 2 核心配置（`tauri.conf.json`）、原生插件集成、系统托盘定义与窗口权限配置清单（`capabilities/`）。
- `server/` — Go 独立后端服务工程，包含主程序入口（`cmd/server/`）、配置加载、数据库池、Goose 迁移、sqlc 查询、业务 Handler、中间件与 WebSocket Hub。
- `docs/` — 系统工程与架构规范文档库，包含前端指南（`FRONTEND.md`）、后端规范（`BACKEND.md`）、设计系统（`DESIGN.md`）、安全规约（`SECURITY.md`）与可靠性约定（`RELIABILITY.md`）。
- `openspec/` — 业务需求与系统行为规约权威源，包含已归档与演进中的能力规格。
- `.agents/skills/` — 仓库内 Agent 自动化脚本与领域专家技能集。
- 根目录构建与配置文件 — 前端清单（`package.json`、`pnpm-lock.yaml`）、多窗口 HTML 载体（`index.html`、`quick-edit.html`、`focus-assistant.html`、`notification-toast.html`）。

### Backend Structure

- `server/cmd/server/` — Go 服务端独立二进制主入口，负责依赖装配、HTTP/WebSocket 监听与优雅关机
- `server/internal/buffer/` — 笔记写后缓冲管理器（`NoteBufferManager`），实现定时去抖落盘与关机强制冲刷
- `server/internal/config/` — 服务端配置加载器，负责 `.env` 读取、端口与数据库连接串解析
- `server/internal/database/` — 数据库连接池（`pgxpool`）、Goose 嵌入式版本化迁移与 sqlc 查询层
- `server/internal/database/migrations/` — PostgreSQL DDL 演进脚本与 Goose 版本化迁移定义
- `server/internal/database/queries/` — 业务领域 SQL 查询源文件，供 sqlc 生成类型安全 Go 代码
- `server/internal/database/sqlc/` — sqlc 编译生成的类型安全数据访问对象与模型实体
- `server/internal/handler/` — RESTful 领域请求处理器，处理认证、任务、笔记、复盘、专注、习惯、项目与增量同步
- `server/internal/middleware/` — HTTP 与 WebSocket 认证中间件，负责 JWT 签名校验与用户上下文提取
- `server/internal/ws/` — WebSocket 连接生命周期管理、客户端 Hub、单调递增序列分发与实时增量广播

#### Dependency Boundaries

后端各模块遵循清晰的自顶向下单向依赖：
`cmd/server → handler / ws / buffer → database (sqlc & migrations) → pgxpool`。
前端各 Webview 实例仅通过 HTTP REST API 和 WebSocket 增量协议与 Go 服务端通信；Tauri Rust 宿主仅管理桌面原生窗口与系统插件，不承载业务持久化逻辑；Go 服务端各 Handler 依赖 `sqlc.Querier` 与 `ws.Hub`，数据库表结构变更统一在 `server/internal/database/migrations/` 中以 Goose 脚本追加演进。

## Dependency Flow & Architecture Invariants (单向依赖流向与架构铁律)

全局依赖保持自底层基础设施向应用业务呈现层的单向流动：

```text
PostgreSQL (Neon / Local)
        ↑
pgxpool + sqlc querier (server/internal/database)
        ↑
Handler + Buffer + Hub (server/internal)
        ↑
HTTP REST API & WebSocket (/api/v1/*, /ws)
        ↑
src/lib (apiClient, wsClient, syncEngine) + src/config + src/types + src/components
        ↑
src/features/<domain> (api + components + hooks + schemas + types)
        ↑
src/app + src/pages (route tree & multi-webview window entries)
```

- **远端数据单一权威**：Go 服务端与 PostgreSQL 作为持久化业务数据的唯一权威来源；前端 TanStack Query 缓存作为可失效的呈现副本。
- **状态分层自治**：TanStack Query 统一接管异步服务端状态与请求重试；Zustand 仅保存客户端 UI 纯净交互状态（侧边栏折叠、浮层开合、主题模式）。
- **单调递增增量广播**：WebSocket 发送携带 `seq_id` 的 `ENTITY_DELTA` 增量事件；前端根据实体类型执行针对性 Query Key 失效并刷新，断线重连时依据本地最大 `last_seq_id` 通过 `/api/v1/sync` 拉取补偿增量。
- **租户隔离应用保障**：所有数据库表结构显式包含 `user_id` 外键字段，Go 后端通过 JWT 中间件统一提取 `userID` 并注入各 Handler 查询参数，由数据库主外键级联与索引保障租户数据隔离。
- **知识库分级与缓冲加载**：目录和分组框架秒级呈现，笔记正文按需拉取；高频输入通过 `/api/v1/notes/:id/buffer` 进入服务端写后缓冲池，由后台 Worker 异步批量刷盘。
- **乐观更新可靠回滚**：前端高频交互（打卡、完成标记、排序）优先更新本地 UI 缓存，接口响应异常时自动回滚至权威状态并向用户呈现提示。
- **迁移追加不可变**：数据库结构演进始终以新版本号追加到 Goose 迁移目录，保持历史版本记录的不可变性。
- **权限按需分配**：桌面各 Webview 窗口依据实际业务调用需求在 `src-tauri/capabilities/` 声明最小权限集。

## Cross-Boundary Contracts (跨端通信契约与协议规范)

- **认证请求**：
  - 基于 Bearer JWT 规范。客户端通过 `/api/v1/auth/login` 与 `/api/v1/auth/register` 获取 JWT Token，持久化存储于 `localStorage`（`workbuddy_auth_session`）。
  - HTTP 请求在 `Authorization: Bearer <token>` 请求头中携带；WebSocket 连接在握手阶段通过 Query 参数 `?token=<token>` 或 Bearer 头传递。
- **数据交互契约**：
  - 标准 RESTful JSON 接口，统一挂载于 `/api/v1/*`。
  - 实体创建与更新遵循乐观并发锁协议，请求载荷包含 `lock_version`，服务端在更新时校验版本并递增；发生版本冲突时返回 HTTP 409，前端捕获后提示并重新拉取最新记录。
- **增量同步契约**：
  - WebSocket 消息格式：`{ "type": "ENTITY_DELTA", "seq_id": 1042, "table": "notes", "action": "UPDATE", "id": "<uuid>", "data": { ... } }`。
  - 增量补偿接口：`GET /api/v1/sync?since_seq=<seq_id>`，返回增量变更列表与最新序列号 `{ "latest_seq": 1050, "since_seq": 1042, "changes": [...] }`。
- **跨窗口与桌面通信契约**：
  - 窗口间事件通知基于 Tauri Event API（`emit` / `listen`）分发轻量级指令（如通知点击唤醒主窗口、专注助手联动）。
  - 桌面原生操作通过 Tauri Invoke 执行 Rust 命令（`show_multi_monitor_notification`、`show_center_interactive_notification`、`quit_app` 等）。

## Shared Data Architecture (全局数据模型与多租户隔离原则)

- **权威数据模型**：
  - 用户核心表：`users`（认证凭据与时间戳）。
  - 任务领域：`time_management_tasks`（四象限属性、起止时间、完成状态、排序权重与锁版本）。
  - 习惯领域：`habits`（打卡频次、分组、目标）与 `habit_checkins`（打卡记录）。
  - 知识库领域：`knowledge_bases`、`knowledge_base_folders`、`folder_note_groups`、`notes`（正文、排序与锁版本）及 `knowledge_base_templates`。
  - 专注领域：`focus_sessions`（专注时长、中断状态、关联任务）。
  - 项目领域：`projects`、`project_stages`、`project_templates`。
  - 复盘领域：`daily_reviews`（日期、富文本内容、摘要与字数统计）。
  - 增量日志表：`entity_change_logs`（单调递增 `seq_id`、`user_id`、`entity_type`、`action`、`payload`）。
- **多租户隔离机制**：
  - 所有业务表通过 `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE` 建立级联关联。
  - 数据库建立复合索引（如 `(user_id, deleted_at)`、`(user_id, seq_id)`）保障单租户查询性能与数据边界。
  - 服务端中间件验证 JWT 提取 `userID` 并注入请求上下文，所有 sqlc 查询条件显式绑定上下文 `user_id`。
- **缓冲与搜索优化**：
  - 针对知识库搜索启用 PostgreSQL `pg_trgm` 扩展与 GIN 索引，支持标题与正文的高性能模糊匹配。
  - 针对高频文本输入实施服务端写后缓冲（`NoteBufferManager`），由内存哈希表维护脏状态并在 2.5 秒定时器触发批量事务提交。

## Architectural Decisions & Evolution (核心架构决策与演进指引)

### 当前关键决策

1. **架构解耦与自建 Go 后端**：以独立 Go 1.26 服务替代外部托管 BaaS，彻底解决多 Webview 高频写入导致的连接池耗尽与无序失效风暴，显著降低内存与运行时资源消耗。
2. **顺序增量日志与无缝断线重放**：通过 `entity_change_logs` 与单调递增 `seq_id`，将粗粒度全表刷新升级为精确实体增量广播与断线追赶补偿。
3. **服务端写后缓冲与分级读取**：知识库引入服务端内存缓冲池，有效平滑富文本自动保存的磁盘写入毛刺；复盘与笔记采用“元数据先行、正文懒加载”策略降低传输负载。
4. **状态所有权严格隔离**：TanStack Query 专责服务端缓存生命周期，Zustand 专责客户端 UI 偏好，实现远端与本地状态的清晰边界。

### 演进约定

- 新增业务特性时，先在 `server/internal/database/migrations/` 追加迁移，编写对应 SQL 查询并运行 `sqlc generate`，随后在 `server/internal/handler/` 暴露 REST 接口与增量广播。
- 前端特性遵循 Bulletproof React 规范，在 `src/features/<domain>/` 内部收敛 `api/`、`components/`、`hooks/` 与 `types/`，跨特性组合统一在页面与应用层完成。
- 涉及用户可见行为契约变动时，优先在 `openspec/changes/` 起草提案并通过 OpenSpec 校验，实施完毕后同步主规约。
