# ARCHITECTURE.md

## System Topology & Overview (系统全局拓扑与职责边界)

WorkBuddy-D 是由 Tauri 2 桌面宿主、React 多 Webview 前端与 Supabase 托管服务组成的个人效率应用。仓库不包含独立的 Node、Java 或 Python 应用服务器。

```text
Tauri 2 / Rust desktop process
  ├─ main Webview: React + TanStack Router/Query + Zustand
  ├─ quick-edit Webview
  ├─ focus-assistant Webview
  └─ notification Webview(s)
       │ frontend services via Supabase client
       ├─ Supabase Auth (session/JWT)
       ├─ PostgREST and PostgreSQL RPC
       └─ private Supabase Realtime Broadcast
             └─ authenticated PostgreSQL tables, RLS, functions and triggers
```

- **React 前端**负责窗口内界面、路由、客户端交互和请求编排；Hook/Service 层将业务读写交给 Supabase JS 客户端。
- **Tauri/Rust 宿主**负责桌面窗口、系统托盘、通知窗口和插件能力；构建与窗口入口由 `src-tauri/tauri.conf.json` 声明。
- **Supabase**负责身份认证、持久化、数据库授权、事务函数与实时消息。数据库 RLS 是每个用户数据访问的安全边界。
- 各 Webview 运行独立前端实例；主窗口拥有应用启动时的离线队列重放和 Realtime 订阅职责，辅助窗口复用认证存储并通过 Tauri 窗口/API 交互。

## Repository Boundaries (顶层资产与仓库边界)

- `src/` — React 应用组合层（`app/`）、全局配置（`config/`）、特性模块（`features/`）、共享基础设施（`lib/`、`types/`、`components/ui/`）与桌面窗口入口。
- `src-tauri/` — Rust 宿主、Tauri 配置、能力清单、图标与原生集成。
- `supabase/migrations/` — 数据库 DDL、RLS、RPC、触发器及其追加式演进记录。
- `docs/` — 前端/后端工程规范、设计、安全、可靠性、产品规格、参考资料和生成快照。
- `openspec/` — 已批准行为规格、进行中的变更与归档记录。
- `.agents/skills/` — 仓库内 Agent 工作流与领域技能说明。
- 根目录 `package.json` / `pnpm-lock.yaml` — 前端依赖和 npm 脚本；`src-tauri/Cargo.toml` / `Cargo.lock` — Rust 依赖。

### Backend Structure

本仓库没有自建应用服务器代码。持久化后端由 Supabase 托管，数据库实现和访问策略在 SQL 迁移与前端数据访问层内维护：

- `supabase/migrations/` — PostgreSQL 表、索引、RLS 策略、RPC 函数、触发器与 Realtime 授权策略。
- `src/features/` — 业务特性数据访问层（各 feature 内部 `api/` 适配器），通过 Supabase JS 调用 PostgREST 与 RPC。
- `server/` — 独立 Go 后端服务，基于 Gin、pgxpool、sqlc 与 WebSocket Sync Hub。
- `src/lib/apiClient.ts` — 统一 HTTP API 客户端，挂载 Bearer JWT Token 请求后端。
- `src/lib/wsClient.ts` — 桌面端 WebSocket 客户端，连接 Go Sync Hub 并分发增量事件。
- `src/lib/offlineSyncQueue.ts` — Webview 本地持久化队列和网络恢复后的写入重放。
- `src/lib/realtimeManager.ts` — WebSocket 实时增量订阅以及 Query Key 失效分发。

#### Dependency Boundaries

依赖方向为 `React app/pages → features → shared (config/lib/types/ui) → Supabase client → PostgreSQL/RPC`。`src/lib/` 提供客户端基础设施；`supabase/migrations/` 定义持久化权威规则。Rust 宿主通过 Tauri 插件和命令服务桌面能力，不承担业务数据 API。

## Dependency Flow & Architecture Invariants (单向依赖流向与架构铁律)

全局依赖由共享基础设施流向业务呈现层：

```text
platform services / database
        ↑
src/config + src/lib + src/types + src/components/ui
        ↑
src/features/<domain> (api + components + hooks + types)
        ↑
src/app + src/pages (webview entry points & route composition)
```

- 页面和组件通过领域 Hook/Service 使用远端数据；领域 Service 封装表访问与 RPC。
- TanStack Query 持有远端缓存和请求生命周期；Zustand 只承载客户端 UI 偏好与交互状态。
- Realtime Broadcast 是失效提示：收到消息后使对应查询失效，重新读取经过 RLS 筛选的数据库结果。
- 用户隔离由 PostgreSQL RLS 和 RPC 所有权校验落实；客户端过滤只服务展示。
- 知识库先加载目录和列表框架，笔记正文在用户选择后按需读取。
- 数据库迁移以新文件追加，保留已应用的迁移历史。
- Tauri capability 的权限范围与目标 Webview 的功能相匹配。

## Cross-Boundary Contracts (跨端通信契约与协议规范)

- **认证请求**：前端由 `@supabase/supabase-js` 管理 Auth Session，并通过 Supabase 客户端向 PostgREST/RPC 发起认证请求。
- **数据读写**：领域服务使用表查询或数据库函数；复合且需要原子性的写入由迁移中定义的 RPC 承担。数据库字段和 RPC 参数的类型以 `src/types/database.ts` 与 `supabase/migrations/` 为依据。
- **授权边界**：业务数据访问以有效用户身份和表/函数授权为基础；RLS 使用 `auth.uid()` 匹配 `user_id`，并对写入结果执行所有权约束。
- **实时同步**：客户端订阅 `user:<userId>:sync` 私有频道的 `entity_changed` 事件。数据库触发器发送表、操作和实体关联等变更提示；客户端据此失效 Query Key，再经授权查询取得权威数据。
- **桌面窗口通信**：窗口管理和原生能力通过 Tauri API、插件、Rust 命令与窗口事件完成。配置与实际事件名以 `src-tauri/` 和 `src/` 实现为准。
- 当前仓库没有通用 REST 中间层或统一 HTTP Response Envelope；跨边界数据契约由 Supabase schema、生成/维护的数据库类型与 RPC 定义承载。

## Shared Data Architecture (全局数据模型与数据隔离原则)

- **权威数据源**：PostgreSQL 中的用户数据由服务端事务与约束决定；浏览器/WebView 缓存是可失效的展示副本。
- **用户隔离**：迁移为业务表启用 RLS，并通过认证用户 `auth.uid()` 与行的 `user_id` 限定访问；涉及特权上下文的数据库函数在迁移中单独约束执行权限和 `search_path`。
- **冲突与审计字段**：版本化写入、服务端更新时间及领域状态转换以对应迁移定义为准；客户端乐观更新根据 RPC 结果提交或回滚。
- **实时消息**：Broadcast 帮助多个客户端及时发现变化，但消息不是数据库行快照或授权结果。
- **结构快照**：`docs/generated/db-schema.md` 是 schema 参考材料；SQL 迁移是数据库结构变更的权威历史。

## Architectural Decisions & Evolution (核心架构决策与演进指引)

### 当前关键决策

1. **Tauri 2 + Supabase 托管后端**：桌面客户端直接使用 Supabase Auth、PostgREST、RPC 和 Realtime；数据库承担持久数据隔离与原子事务。
2. **Query 与 UI 状态分离**：TanStack Query 管理可重新读取的服务端状态，Zustand 管理主题和界面交互状态。
3. **多窗口共享前端能力**：Vite 为多个 HTML/Webview 入口构建资源；Rust/Tauri 管理窗口生命周期和原生能力。
4. **基于私有 Broadcast 的查询失效**：变化通知不覆盖缓存；各 Webview 通过认证查询重新获取权威记录。

### 演进约定

- 新增系统边界、原生能力或持久化机制时，先更新本架构图和对应端侧文档。
- 用户可见行为与数据契约变化通过 `openspec/changes/` 管理，并在实现后同步批准的规格。
- 数据结构、RLS、RPC 或触发器变化通过新的 `supabase/migrations/` 文件演进，并同步生成的 schema 参考。
- 前端新增领域模块时，优先保持领域视图、Hooks、Services、类型的职责清晰；只有存在跨领域复用时才提升为共享基础设施。
