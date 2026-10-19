# 后端与数据服务规范

## Baseline & Runtime (运行时基线与工程管理)

WorkBuddy-D 采用 Go 1.26 独立后端服务（`server/`，模块名为 `workbuddy-server`）与 PostgreSQL（Neon Serverless Postgres / 本地开发环境）作为系统核心持久化与业务支撑层。

- **语言与标准库**：Go 1.26，使用标准库 `log/slog` 进行结构化日志记录，使用 `context` 贯穿处理超时与取消生命周期。
- **Web 服务框架**：Gin v1.10.0（`github.com/gin-gonic/gin`）提供高性能 RESTful API 路由与中间件流水线；CORS 跨域由 `github.com/gin-contrib/cors` 管理。
- **数据库连接与池化**：基于 `github.com/jackc/pgx/v5` 与 `pgxpool` 实现连接池管理，配置受控的连接数与空闲回收策略。
- **数据库版本化迁移**：Goose v3.29.0（`github.com/pressly/goose/v3`）配合 `embed.FS` 嵌入式迁移，服务启动时自动检查并演进数据库版本。
- **类型安全查询**：基于 `sqlc` 预编译 SQL 查询并自动生成 Go 强类型数据访问模型与 `Querier` 接口。
- **认证与加密**：JWT 规范采用 `github.com/golang-jwt/jwt/v5`（HS256 签名），密码哈希采用 `golang.org/x/crypto/bcrypt`（Cost 10）。
- **实时同步 Hub**：基于 Gorilla WebSocket v1.5.3（`github.com/gorilla/websocket`）构建多客户端连接池与单调递增序列增量广播中心。
- **异步写后缓冲**：内置 `NoteBufferManager` 内存去抖缓冲池，平滑高频富文本编辑的磁盘写入负载。
- **工程构建与测试命令**：
  - 后端依赖整理：`go -C server mod tidy`
  - 单元测试运行：`go -C server test ./...`
  - 静态代码检查：`go -C server vet ./...`
  - 二进制程序编译：`go -C server build ./cmd/server`

## Package & Layering Boundaries (包结构垂直分层与边界)

Go 服务端采用清晰的垂直分层包结构，各层职责内聚、单向依赖：

- `server/cmd/server/main.go` — 服务端主入口，负责配置加载、连接池创建、Goose 迁移触发、路由挂载、Worker 启动与基于 OS 信号的优雅关机。
- `server/internal/config/` — 配置管理包，通过 `bufio.Scanner` 解析 `.env` 与系统环境变量，封装 `Config` 结构体。
- `server/internal/database/` — 数据持久化基础设施包：
  - `db.go`：管理 `pgxpool.Pool` 连接池生命周期与 Goose 嵌入式自动迁移执行。
  - `migrations/`：包含 `000001_init_schema.sql` 至 `000009_add_daily_review_snapshots.sql` 版本化 SQL 脚本。
  - `queries/`：业务 SQL 查询文件（`tasks.sql`、`notes.sql`、`sync.sql`、`habits.sql`、`focus.sql`、`projects.sql`、`daily_reviews.sql`、`users.sql`、`ai.sql`）。
  - `sqlc/`：sqlc 自动生成的类型安全数据模型与 `Querier` 接口。
- `server/internal/buffer/` — 写后缓冲池包，提供 `NoteBufferManager`，去抖暂存高频笔记更新并在 2.5 秒定时器或系统关机时批量事务刷盘。
- `server/internal/ws/` — WebSocket 实时同步包：
  - `hub.go`：维护客户端注册映射表（`map[uuid.UUID]map[*Client]bool`），写入变更时在 `entity_change_logs` 记录单调递增序列并向目标用户的各连接分发 `ENTITY_DELTA` 载荷。
  - `client.go`：管理单个 WebSocket 客户端连接的读写 Pump 与心跳保活。
  - `message.go`：定义增量事件格式与动作枚举。
- `server/internal/middleware/` — 认证与请求上下文中间件，负责校验 Bearer JWT 并将 `user_id` 注入 Gin 上下文。
- `server/internal/handler/` — 领域请求处理器：
  - `auth_handler.go`：注册、登录与 `/auth/me`。
  - `task_handler.go`：任务 CRUD 与乐观锁版本控制。
  - `note_handler.go`：知识库、目录、分组、笔记（CRUD、搜索、缓冲 Patch、重排序与移动）以及笔记快照版本管理。
  - `habit_handler.go`：习惯与打卡 CRUD。
  - `focus_handler.go`：专注会话创建、更新与未完成会话中断。
  - `project_handler.go`：项目、阶段看板与项目模板。
  - `daily_review_handler.go`：复盘元数据摘要、日期懒加载正文、统计数据、热力图矩阵与复盘版本快照。
  - `sync_handler.go`：基于单调递增序列 `seq_id` 的增量日志查询重放（`/api/v1/sync?since_seq=`）。

### 单向依赖流动边界

数据调用与业务流程遵循严格单向规则：
`cmd/server → handler / ws / buffer → database (sqlc) → pgxpool → PostgreSQL`。
各领域 Handler 仅通过注入的 `sqlc.Querier` 访问数据库，通过 `ws.Hub` 广播变更事件，跨业务领域的逻辑由统一数据模型与事务保障。

## Configuration & Security Operations (配置隔离、安全与数据脱敏)

- **环境配置加载与优先级**：
  - `server/internal/config/config.go` 依次加载当前目录与上级目录的 `.env` 文件。
  - 核心配置项包括 `PORT`（默认 8080）、`DB_DSN`（PostgreSQL 连接串）、`JWT_SECRET`（JWT 签名密钥）与 `CORS_ORIGIN`。
  - 生产环境下敏感配置（如数据库密码、JWT 密钥）由环境变量直接注入，不在代码中硬编码敏感凭据。
- **认证中间件与会话鉴权**：
  - 用户密码经 bcrypt 加盐哈希存储，不可逆向还原。
  - 客户端登录成功后签发标准 HS256 JWT Token，有效载荷包含用户标识与过期时间戳。
  - 受保护路由统一挂载 `middleware.Auth` 中间件，校验有效性后将 `user_id` 注入请求上下文；WebSocket 路由在握手阶段通过 Query Token 校验。
- **结构化日志与安全脱敏**：
  - 采用 `log/slog` 进行全链路结构化日志输出，包含操作级别、模块名、执行耗时与实体唯一标识。
  - 用户明文密码、私钥凭据与敏感富文本内容在日志打印时进行过滤脱敏，保持日志安全合规。

## Persistence & Data Isolation (数据持久化与多租户隔离)

- **模式版本化演进**：
  - 数据库表结构变更全部以带前缀编号的 SQL 迁移文件追加至 `server/internal/database/migrations/`。
  - 每个迁移文件严格包含 `-- +goose Up` 与 `-- +goose Down` 幂等脚本。
  - 启动阶段调用 `goose.Up(db, "migrations")` 确保数据库版本与当前代码完全对齐。
- **多租户物理与逻辑隔离**：
  - 系统所有实体表均显式声明 `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`。
  - 建立基于 `(user_id, deleted_at)` 等复合局部索引，确保单租户查询命中专有索引且不可跨租户穿透。
  - 所有 sqlc 查询语句均强制绑定 `WHERE user_id = $1` 条件，由服务端层层校验用户所属权。
- **并发乐观锁机制**：
  - 实体表具备 `lock_version BIGINT NOT NULL DEFAULT 1` 字段。
  - 更新操作要求调用方提供预期的 `lock_version`；更新成功时版本号递增，若版本冲突则返回 HTTP 409 引导前端重新加载。
- **全文检索与序列增量**：
  - 启用 PostgreSQL `pg_trgm` 扩展并在 `notes` 表构建 GIN 复合三元组索引 `((title || ' ' || content) gin_trgm_ops)`，支撑高性能模糊搜索。
  - `entity_change_logs` 维护自增主键 `seq_id`，持久化记录实体的操作类型与载荷快照。

## Concurrency, Queue & Reliability (并发流控、队列与可靠性)

- **数据库连接池流控管理**：
  - `pgxpool` 显式设置连接池边界：`MaxConns = 25`、`MinConns = 3`、`MaxConnLifetime = 1h`、`MaxConnIdleTime = 30m`、`HealthCheckPeriod = 1m`，避免并发突发耗尽 Neon Serverless 数据库连接配额。
- **异步写后缓冲池 (`NoteBufferManager`)**：
  - 采用互斥锁 `sync.Mutex` 保护内存脏数据哈希表。
  - 启动独立 Goroutine 运行 2.5 秒定时器，批量抽取脏数据并在独立上下文执行数据库更新。
  - 系统接收 `SIGINT` / `SIGTERM` 信号时，执行优雅关机流程，优先调用 `noteBufferMgr.Stop()` 强制冲刷所有脏数据落盘，随后调用 `http.Server.Shutdown(ctx)` 优雅断开 HTTP 与 WebSocket 连接。
- **WebSocket Hub 与单调递增广播**：
  - 读写锁 `sync.RWMutex` 保护客户端连接映射表。
  - 每个客户端拥有独立缓冲通道（容量 256），由专有 `WritePump` 与 `ReadPump` Goroutine 负责消息收发与心跳检测（Ping/Pong），避免慢客户端阻塞广播主循环。
  - 写操作时在 `entity_change_logs` 递增记录并附带 `seq_id`；客户端断线恢复后通过 `GET /api/v1/sync?since_seq=` 精确拉取历史增量，无需触发全库重扫。

## Backend Invariants & Verification (后端架构不变量与验证准出)

- Go 独立服务端作为持久化数据与业务规则的单一真值源，各 Handler 统一通过 JWT 中间件提取 `userID` 并注入查询。
- 数据库并发写操作始终校验 `lock_version` 乐观锁。
- 数据库变更全部以递增编号的 Goose 脚本追加至 `server/internal/database/migrations/`。
- 结构化日志统一使用 `log/slog`，保持上下文键值对规范。
- 系统关机必须触发缓冲池冲刷（`Stop()`）与 HTTP 优雅终止。
- 后端准出验证命令：
  - 执行 `go -C server test ./...` 运行全部 Go 后端单元测试。
  - 执行 `go -C server vet ./...` 运行静态语法检查。
  - 执行 `go -C server build ./cmd/server` 验证二进制编译通过。
  - 文档修改后运行 `ai-harness validate docs/BACKEND.md --json` 确认 0 错误。
