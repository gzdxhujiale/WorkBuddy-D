# AGENTS.md

## Project (项目概述与技术基线)

WorkBuddy-D 是一款以 Tauri 2、React 19 与 Go 1.26 独立后端、Neon PostgreSQL 构建的个人规划和专注桌面应用。主窗口与快捷编辑、悬浮专注助手及通知微窗口共享同一套前端多入口代码；Go 独立后端提供 REST API、JWT 认证、Goose 嵌入式版本化迁移、`log/slog` 结构化日志、写后笔记缓冲池与基于单调递增序列的 WebSocket 增量广播。

- 前端：TypeScript、React 19、Vite 7、Tailwind CSS 4、TanStack Query 5、TanStack Router、Zustand 5、Tiptap 3。
- 桌面端：Tauri 2 与 Rust；窗口管理、系统托盘、原生单实例（`single-instance`）、窗口状态持久化（`window-state`）、全局快捷键（`global-shortcut`）、通知和自启动能力由 `src-tauri/` 管理。
- 数据与服务端：Go 1.26 独立后端服务（`server/`）、`pgxpool` 数据库连接池、Goose 嵌入式版本化迁移、Neon PostgreSQL、`sqlc` 类型安全查询、NoteBufferManager 写后缓冲池与 WebSocket Sync Hub。
- 依赖事实以 `package.json`、`pnpm-lock.yaml`、`src-tauri/Cargo.toml` 与 `server/go.mod` 为准。
- [ARCHITECTURE.md](ARCHITECTURE.md) 说明系统拓扑与边界；[docs/FRONTEND.md](docs/FRONTEND.md) 说明 React 工程组织；[docs/BACKEND.md](docs/BACKEND.md) 说明 Go 服务端与持久化边界。
- [docs/DESIGN.md](docs/DESIGN.md)、[docs/SECURITY.md](docs/SECURITY.md) 和 [docs/RELIABILITY.md](docs/RELIABILITY.md) 分别记录设计、安全和可靠性约定；`openspec/specs/` 是已批准业务规约的权威来源。

## Operating Invariants (工程不变量与操作准则)

- **差分作用域验证**：从 `git diff` 识别本次受影响文件与直接依赖链路，集中执行针对性验证；验证范围严格限定于改动引起的直接因果链路。
- **最小因果改动与保留现状**：围绕目标实施最小必要变更；工作区内既有的无关改动与历史遗留问题严格保留现状（Leave as-is）。
- **事实符号锚定**：代码路径、执行命令、包依赖项、API 契约和架构陈述以仓库代码、配置文件、数据库迁移及锁文件为客观证据；未经验证项保持待核验标记。
- **数据所有权划分**：TanStack Query 统一管理远端服务端异步缓存与请求生命周期；Zustand 承载客户端纯净 UI 交互偏好；Go 独立后端与 PostgreSQL 决定持久化业务数据、行级隔离与状态流转权威。
- **分层契约访问**：页面与组件通过领域 Hook 与 Service 访问 Go API；WebSocket 增量广播分发 `seq_id` 与变更载荷，触发精确的 Query 失效与重取，网络恢复时通过 `/api/v1/sync?since_seq=` 执行断线增量补偿。
- **迁移追加演进**：数据库结构变更以增量文件追加到 `server/internal/database/migrations/`，使用 Goose 规范的 `-- +goose Up` 与 `-- +goose Down` 注解进行版本化管理，服务启动时自动执行嵌入式迁移。
- **原生权限契约**：新增或变更桌面原生能力时，依据各 Webview 窗口的实际调用边界最小化配置 `src-tauri/capabilities/`。
- **正向行动化规约**：`openspec/specs/` 与受管文档全程贯彻正向行动化表述，明确定义系统不变量、期望状态与合法封闭作用域。

## Task Routing (任务路由与事实来源)

- **React、路由、状态与数据加载**：以 [docs/FRONTEND.md](docs/FRONTEND.md)、`src/` 与 `package.json` 为事实源；UI 规范参考 `.agents/skills/frontend-design/`。
- **系统拓扑、多 Webview、跨端通信**：以 [ARCHITECTURE.md](ARCHITECTURE.md)、`src-tauri/`、HTML 窗口入口、前端源码与 `server/` 为事实源。
- **Go 后端、数据库、认证、缓冲池与增量同步**：以 [docs/BACKEND.md](docs/BACKEND.md)、`server/`、SQL 迁移（`server/internal/database/migrations/`）与服务端源码为事实源；Go 代码质量参考 `.agents/skills/go-*`。
- **视觉系统与交互规范**：以 [docs/DESIGN.md](docs/DESIGN.md) 和 `src/index.css` 为事实源。
- **Tauri 原生能力与桌面集成**：以 [ARCHITECTURE.md](ARCHITECTURE.md)、`src-tauri/tauri.conf.json`、`src-tauri/src/lib.rs` 与 `src-tauri/capabilities/` 为事实源；参考 `.agents/skills/tauri/`。
- **用户可见行为与数据契约变化**：查阅 `openspec/specs/`，按 OpenSpec 规约在 `openspec/changes/` 推进变更提案与归档。
- **受管文档维护**：统一使用全局 `ai-harness` 命令；受管文档包括 `AGENTS.md`、`ARCHITECTURE.md`、`docs/FRONTEND.md`、`docs/BACKEND.md`。
- **事实冲突裁决**：已批准的 OpenSpec 规约确定产品行为；运行代码与配置文件确定当前实现事实；数据库迁移历史确定存储演进事实。两项权威来源存在分歧时，整理分歧对比与可行方案后发起人工裁决。

## Commands (高频指令集)

- 前端依赖安装：`pnpm install`
- 前端开发服务器启动：`pnpm dev`
- 前端类型检查与生产构建：`pnpm build`
- 前端架构边界校验：`pnpm lint:boundaries`
- Tauri 桌面开发环境：`pnpm tauri`
- 全栈联合调试（Go + Tauri）：`pnpm tauri:all`
- 桌面应用安装包构建：`pnpm run "tauri build"`
- Rust 宿主编译检查：在 `src-tauri/` 目录执行 `cargo check`
- Go 依赖整理：`go -C server mod tidy`
- Go 后端单元测试：`go -C server test ./...`
- Go 后端代码检查：`go -C server vet ./...`
- Go 后端二进制构建：`go -C server build ./cmd/server`
- Go 服务端独立启动：`pnpm server:dev`
- 检查受管文档状态：`ai-harness status`
- 扫描项目事实上下文：`ai-harness inspect`
- 全量校验受管文档：`ai-harness validate`
- 单文档针对性校验：`ai-harness validate <file> --json`
- 提取领域上下文：`ai-harness context <domain>`

## Completion Criteria (任务准出与交付标准)

- 针对性构建全绿：前端变更通过 `pnpm build` 与 `pnpm lint:boundaries`；Rust 变更通过 `cargo check`；Go 后端变更通过 `go -C server test ./...` 与 `go -C server build ./cmd/server`。
- 受管文档零缺陷：文档修改后执行 `ai-harness validate <file> --json` 验证退出码为 0、issues 数组为空且全量清除占位符；全量文档变更执行 `ai-harness validate` 和 `ai-harness status` 确认所有必需文档均为 `valid` 状态。
- 事实符号全量对应：文档引用的文件路径、模块结构、环境变量和执行命令与当前仓库实际存在的物理文件完全对齐。
- 差分作用域闭环：最终执行 `git diff` 核对修改范围，确保全部改动均归属于本次任务目标，并在交付汇报中提供完整的执行命令与成功凭证。

## Ask for Human Judgment When (人工介入条件)

- 需求规格存在多种合理实现路径且将实质改变数据语义、安全信任边界或用户交互流向。
- 操作可能涉及清除或覆盖尚未备份的用户数据、已归档历史、敏感凭证或全局用户配置。
- 系统设计涉及第三方服务凭证、隐私权限申请或 Tauri 原生系统级权限扩张决策。
- 出现权威规约（OpenSpec）与代码实现冲突，或需要调整单体/分布式架构部署形态与平台支持策略。

提问时按以下标准结构提供完整上下文：

1. **阻碍与证据**：指出具体文件、配置、代码行或规约条款的冲突表现与影响范围。
2. **可选路径**：提供至少两种可行技术方案，并明确列出各自的技术代价与长远影响。
3. **建议与求证**：给出依据项目事实与工程准则的最佳推荐方案，并请求用户对决策点进行明确裁决。
