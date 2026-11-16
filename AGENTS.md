# AGENTS.md

## Project (项目与技术基线)

WorkBuddy-D 是一款以 Tauri 2、React 19 多 Webview 前端、Go 1.26 独立后端与 Neon PostgreSQL 构建的现代化个人规划和专注桌面应用。主窗口与快捷编辑、悬浮专注助手及通知微窗口共享同一套前端多入口代码；Go 独立后端提供 REST API、JWT 认证、Goose 嵌入式版本化迁移、`log/slog` 结构化日志、写后笔记缓冲池与基于单调递增序列的 WebSocket 增量广播。

- **后端服务**：Go 1.26，Gin Web 引擎，`pgx/v5` 与 `pgxpool` 连接池，sqlc 类型安全 SQL 持久层，Goose 嵌入式版本化增量数据库迁移，内置 `NoteBufferManager` 内存写后去抖缓冲池，基于 Gorilla WebSocket 的单调递增序列增量同步 Hub，`log/slog` 结构化日志。
- **前端架构**：TypeScript 5.8+，React 19.1+，Vite 7+，TanStack Router（集中式类型安全路由树），TanStack Query 5.101+（服务端异步状态治理），Tailwind CSS 4.3+，shadcn / Base UI 原语体系（`src/components/ui/` 与 `src/components/pixel/`），Zustand 5.0+（纯客户端 UI 瞬态），Tiptap 3.32+（富文本知识库编辑）。
- **桌面宿主**：Tauri 2 与 Rust；管理多 Webview 窗口生命周期、系统托盘、原生单实例（`single-instance`）、窗口状态持久化（`window-state`）、全局快捷键（`global-shortcut`）、通知与开机自启动。
- **数据与存储**：Neon Serverless PostgreSQL / 本地 PostgreSQL 16+ 存储业务数据，启用 `pg_trgm` 扩展与 GIN 复合索引支持模糊全文检索；`entity_change_logs` 维护自增序列 `seq_id` 支撑增量同步与断线重放。

## 仓库结构

- `openspec/` — 业务需求规格主仓库（`specs/`）与变更提案工件（`changes/`）
- `src/` — React 多 Webview 前端工程源码
  - `src/app/` — 应用全局外壳、Provider 装配（`AppProviders.tsx`）与路由集中配置（`routes/`）
  - `src/features/` — 业务特性领域模块（`auth/`、`projects/`、`habit/`、`knowledge/`、`daily-review/`、`time-management/`、`focus/`、`settings/`）
  - `src/components/` — 跨特性共享展示组件（`ui/`、`pixel/`、`layout/`）
  - `src/hooks/` — 全局通用 React Hooks
  - `src/lib/` — 客户端基础设施（`apiClient.ts`、`wsClient.ts`、`syncEngine.ts`、`realtimeManager.ts`、`offlineSyncQueue.ts`）
  - `src/stores/` — 全局客户端纯净 UI 状态（`uiStore.ts`）
  - `src/types/` — 全局领域实体与数据契约类型
  - `src/config/` — 全局环境与路由路径配置（`env.ts`、`paths.ts`）
- `src-tauri/` — Rust 桌面宿主工程（`tauri.conf.json`、`src/lib.rs`、`capabilities/`）
- `server/` — Go 独立后端模块化工程
  - `server/cmd/server/` — 服务端主二进制入口（`main.go`）
  - `server/internal/handler/` — RESTful 领域请求处理器
  - `server/internal/buffer/` — 笔记写后缓冲管理器（`NoteBufferManager`）
  - `server/internal/ws/` — WebSocket 连接池、客户端 Hub 与单调递增增量广播
  - `server/internal/database/` — 数据库连接池（`pgxpool`）与 Goose 嵌入式自动迁移
  - `server/internal/database/migrations/` — PostgreSQL Goose 版本化增量数据库迁移脚本
  - `server/internal/database/queries/` — 类型安全 sqlc SQL 查询源定义
  - `server/internal/database/sqlc/` — sqlc 编译生成的类型安全数据模型与 Querier 接口
  - `server/internal/middleware/` — JWT 认证与上下文中间件
  - `server/internal/config/` — 环境变量与配置解析
- `docs/` — 架构与工程规范文档库（`FRONTEND.md`、`BACKEND.md`、`DESIGN.md`、`SECURITY.md`、`RELIABILITY.md`）

## Operating Redlines

- **状态归属契约**：
  - TanStack Query 统一管理远端服务端 API 异步数据与缓存生命周期；通过领域 `*Queries.ts` 标准化声明 `queryOptions`。
  - Zustand 仅持有纯客户端瞬态 UI 交互偏好（侧边栏折叠、全局主题模式、弹窗浮层显隐）；严禁将服务端实体镜像至 Zustand。
  - 实体创建、删除与破坏性流转以服务端响应确认为唯一结算标准，杜绝乐观删除实体；打卡与排序等高频动作执行乐观更新时，接口失败必须可靠回滚并向用户提示。
  - WebSocket 实时事件统一分发携带 `seq_id` 的 `ENTITY_DELTA` 变更载荷，触发精确的 Query 失效或局部补丁，网络恢复时通过 `/api/v1/sync?since_seq=` 执行断线增量补偿。
- **API 容错与防白屏契约**：
  - 前端消费服务端 JSON 响应统一经由 Zod / 类型校验，有报错明确输出并由局部 `SectionErrorBoundary` 隔离拦截，保护桌面宿主窗口免受崩溃白屏。
  - 未知服务端枚举与可选字段缺失时，UI 不盲目降级，必须输出结构化警告日志便于诊断。
  - 严禁前端在生产路径编写 Mock 数据；严禁私自添加内部兼容 Shim、双写逻辑、Fallback 降级分支或遗留系统适配器。
- **租户强隔离契约**：
  - 全量业务表显式绑定 `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`。
  - 所有持久层 SQL 查询与 sqlc 代码严格绑定上下文 `user_id`，Gin 中间件从 JWT 验证提取 `userID` 并注入请求上下文，杜绝跨租户数据串透。
- **并发控制与迁移安全契约**：
  - 业务实体更新显式传递 `lock_version` 乐观锁；版本冲突时服务端返回 HTTP 409，前端捕获后提示并重新拉取最新记录。
  - 数据库结构变更全部以增量文件追加至 `server/internal/database/migrations/`，使用 Goose 规范的 `-- +goose Up` 与 `-- +goose Down` 注解进行版本化管理，严禁修改已生效的历史迁移脚本。
- **原生权限契约**：
  - 新增或变更桌面原生能力时，依据各 Webview 窗口的实际调用边界最小化配置 `src-tauri/capabilities/`，杜绝通配宽泛授权。
- **视觉与布局基线**：
  - 严格遵循 `docs/DESIGN.md` 与 `src/index.css` 定义的 5 级 Elevation 视觉层级体系（L0 桌面外壳、L1 主画布、L2 容器面板、L3 控件层、L4 顶层浮层 `z-index: 1100`）。
  - 全面支持「现代极简」与「复古 8-Bit 像素」双主题无缝切换，基于语义化 CSS 变量与 Tailwind CSS 4 工具类组合排版。
  - 严禁不必要的冗余辅助描述（Description）；禁止机械复述标题、标签名、数值或按钮动作，仅在选项晦涩、存在特殊约束或潜在后果时补充业务性说明。
- **缓冲落盘与优雅关机契约**：
  - 高频富文本编辑通过 `/api/v1/notes/:id/buffer` 进入 `NoteBufferManager` 写后缓冲池，由后台 Worker 异步批量刷盘。
  - 服务端收到 `SIGINT` / `SIGTERM` 信号时，必须优先调用 `noteBufferMgr.Stop()` 强制冲刷脏数据落盘，再优雅终止 HTTP 与 WebSocket 服务。
- **工程不变量与差分验证**：
  - 最小因果改动与保留现状：围绕目标实施最小必要变更；工作区内既有的无关改动与历史遗留问题严格保留现状（Leave as-is）。
  - 差分作用域验证：从 `git diff` 识别本次受影响文件与直接依赖链路，集中执行针对性验证。

## Task Routing

- **前端与 UI 开发任务**：
  - 必须执行技能 / 规范：`shadcn`、`tailwindcss`、`bulletproof-react-architecture`、`frontend-design`、[docs/FRONTEND.md](docs/FRONTEND.md)、[docs/DESIGN.md](docs/DESIGN.md)。
  - 要求：
    - 遵循 Bulletproof React 特性驱动架构，新特性内聚收敛于 `src/features/<domain>/`（`api/`、`components/`、`hooks/`、`schemas/`、`types/`）。
    - 跨特性共享组件优先复用 `src/components/ui/` 与 shadcn / Base UI 原语，非必要不手写原始 div 组件；现有组件不满足时按设计规范封装。
    - 辅助描述默认为非必选项，常规场景直接省略；严禁前端硬编码 Mock 数据或私加兼容 Shim。
- **后端与服务开发任务**：
  - 必须执行技能 / 规范：`go-code-review`、`go-error-handling`、`go-concurrency`、`golang-code-style`、[docs/BACKEND.md](docs/BACKEND.md)。
  - 要求：
    - 垂直分层契约：严格遵循 `Handler (Gin HTTP / WebSocket) → Buffer / Hub / Service → Database / sqlc.Queries (Persistence) → pgxpool` 单向依赖流动。
    - 日志与错误规范：统一使用标准库 `log/slog` 输出结构化日志；敏感数据（密码凭据、私钥）严格脱敏。
- **数据库与持久层任务**：
  - 增量迁移脚本收敛于 `server/internal/database/migrations/` 与 Goose 嵌入式迁移。
  - 查询收敛于 `server/internal/database/queries/`，修改后重新生成 sqlc 代码。
- **Tauri 原生能力与桌面集成**：
  - 必须执行技能 / 规范：`tauri`、`tauri-window`、`tauri-security`、[ARCHITECTURE.md](ARCHITECTURE.md)。
  - 权限变更严格收敛于 `src-tauri/capabilities/`。
- **业务行为与规格变更**：
  - 查阅与维护 `openspec/specs/`，按 OpenSpec 规约在 `openspec/changes/` 推进变更提案与归档。
- **受管文档维护**：
  - 统一使用 `cmd /c ai-harness` 命令；受管文档包括 `AGENTS.md`、`ARCHITECTURE.md`、`docs/FRONTEND.md`、`docs/BACKEND.md`。
- **Git 提交规范**：
  - 执行技能：`commit`。

## Commands

- 前端依赖安装：`pnpm install`
- 前端开发服务器启动：`pnpm dev`
- 前端全栈联合调试（Go + 前端）：`pnpm dev:all`
- 前端类型检查与生产构建：`pnpm build`
- 前端架构依赖边界校验：`pnpm lint:boundaries`
- Tauri 桌面开发环境：`pnpm tauri`
- 全栈桌面联合调试（Go + Tauri）：`pnpm tauri:all`
- 桌面应用安装包构建：`pnpm run "tauri build"`
- Rust 宿主编译检查：在 `src-tauri/` 目录执行 `cargo check`
- Go 依赖整理：`go -C server mod tidy`
- Go 后端单元测试：`go -C server test ./...`
- Go 后端代码检查：`go -C server vet ./...`
- Go 后端二进制构建：`go -C server build -o bin/server.exe ./cmd/server`
- Go 服务端独立启动：`pnpm server:dev`
- OpenSpec 规格校验：`cmd /c openspec validate --specs`
- OpenSpec 归档变更：`cmd /c openspec archive <change>`
- 检查受管文档状态：`cmd /c ai-harness status`
- 扫描项目事实上下文：`cmd /c ai-harness inspect`
- 全量校验受管文档：`cmd /c ai-harness validate`
- 单文档针对性校验：`cmd /c ai-harness validate <file> --json`
- 提取领域上下文：`cmd /c ai-harness context <domain>`

## Completion Criteria

- **针对性构建全绿**：前端变更通过 `pnpm build` 与 `pnpm lint:boundaries`；Rust 变更通过 `cargo check`；Go 后端变更通过 `go -C server test ./...` 与 `go -C server build ./cmd/server`。
- **受管文档零缺陷**：文档修改后执行 `cmd /c ai-harness validate <file> --json` 验证退出码为 0、`issues` 数组为空且全量清除占位符；全量文档变更执行 `cmd /c ai-harness validate` 确认所有必需文档均为 `valid` 状态。
- **事实符号全量对应**：文档引用的文件路径、模块结构、环境变量和执行命令与当前仓库实际存在的物理文件完全对齐。
- **差分作用域闭环**：最终执行 `git status` / `git diff` 核对修改范围，确保全部改动均归属于本次任务目标。

## Ask for Human Judgment When

- 需求规格存在多种合理实现路径且将实质改变数据语义、安全信任边界或用户交互流向。
- 操作可能涉及清除或覆盖尚未备份的用户数据、已归档历史、敏感凭证或全局用户配置。
- 系统设计涉及第三方服务凭证、隐私权限申请或 Tauri 原生系统级权限扩张决策。
- 出现权威规约（OpenSpec）与代码实现冲突，或需要调整单体/分布式架构部署形态与平台支持策略。

提问时按以下标准结构提供完整上下文：

1. **阻碍与证据**：指出具体文件、配置、代码行或规约条款的冲突表现与影响范围。
2. **可选路径**：提供至少两种可行技术方案，并明确列出各自的技术代价与长远影响。
3. **建议与求证**：给出依据项目事实与工程准则的最佳推荐方案，并请求用户对决策点进行明确裁决。
