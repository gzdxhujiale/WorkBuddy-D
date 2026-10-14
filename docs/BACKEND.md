# 后端与数据服务规范

## Baseline & Runtime

WorkBuddy-D 仓库不运行独立的业务应用服务器。Supabase 提供托管后端服务，Tauri Webview 中的前端通过 Supabase 客户端访问这些服务。

- **身份认证**：Supabase Auth 签发用户会话，供已认证的数据请求使用。
- **数据 API**：PostgREST 提供 PostgreSQL 查询和常规读写；数据库 RPC 函数处理事务性或带版本校验的操作。
- **持久化**：Supabase PostgreSQL 保存用户数据；数据库结构演进记录在 `supabase/migrations/`。
- **实时更新**：Supabase Realtime Broadcast 分发按用户隔离的私有变更提示。
- **运行配置**：`src/lib/supabase.ts` 读取 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_PUBLISHABLE_KEY`。两者都是公开的客户端配置；公开密钥不替代 RLS 授权。
- **桌面宿主**：`src-tauri/` 提供 Rust 桌面运行时，不承载业务 API 服务。

## Package & Layering Boundaries

- `src/features/<feature>/api/` 负责领域数据访问和 RPC 调用。
- `src/features/<feature>/hooks/` 将 API 操作与 React 组件、TanStack Query 生命周期连接起来。
- `src/lib/supabase.ts` 根据 `src/types/database.ts` 创建带类型的 Supabase 客户端。
- `src/lib/realtimeManager.ts` 订阅 Broadcast，并使受影响的 Query Key 失效。
- `src/lib/offlineSyncQueue.ts` 为受支持的离线写入提供客户端重放队列；它不属于服务端任务队列或分布式作业处理器。
- `supabase/migrations/` 管理数据库表、函数、触发器、索引、RLS 和 Realtime 授权策略。
- `src-tauri/src/` 管理原生桌面命令与宿主集成；业务持久化由 Supabase 承担。

数据依赖方向为 `UI → Query Hook → 领域 API → Supabase 客户端 → PostgREST/RPC → PostgreSQL`。持久化记录和访问决策以数据库约束及 RLS 为准。

## Configuration & Security Operations

- 本地前端配置通过 Vite `import.meta.env` 读取；`src/lib/supabase.ts` 使用 `VITE_SUPABASE_URL` 与 `VITE_SUPABASE_PUBLISHABLE_KEY`。
- `VITE_` 前缀的值会进入客户端构建产物，因此属于公开配置。数据库访问控制依赖认证会话、RLS 策略和受限的 RPC 授权。
- 迁移为用户数据表启用行级安全策略，并以 `auth.uid()` 和 `user_id` 所有权条件约束认证用户的访问。
- 特权触发器和 RPC 函数在相应迁移中定义执行上下文与授权。修改这些函数时，需一并核对函数所有者、`search_path`、执行权限及 RLS 关系。
- 私有 Realtime 授权定义在 `supabase/migrations/20260814010000_replace_postgres_changes_with_private_broadcast.sql`。变更时同时核对数据库策略和客户端主题名称。
- Tauri 原生能力由独立配置管理；涉及宿主权限时检查 `src-tauri/capabilities/`。

## Persistence & Data Isolation

- 数据库 DDL 与策略历史追加保存在 `supabase/migrations/`；迁移历史是数据库演进的权威记录。
- `src/types/database.ts` 提供 TypeScript 数据库契约；`docs/generated/db-schema.md` 是生成的参考快照。
- 用户自有记录通过 `user_id` 和 RLS 中的 `auth.uid()` 条件隔离。新增用户数据表时，在迁移中按相同所有权模型配置策略。
- 涉及多条记录或服务端决定值的写操作由数据库 RPC 执行，使校验与提交在 PostgreSQL 中完成。
- 数据库时间戳、锁版本、排序分配及完成状态转换以迁移声明的默认值、触发器和函数为准。
- 客户端 Query Key 按用户身份区分；Auth 用户变化时清除旧账户缓存。此客户端边界与数据库授权共同工作，不能替代 RLS。

## Concurrency, Queue & Reliability

- 带版本控制的 RPC 写入会比较预期锁版本；遇到过期编辑时返回冲突，调用方提示用户并重新读取权威数据。
- `src/lib/sync.ts` 和 `src/lib/offlineSyncQueue.ts` 对受支持的网络错误进行分类；主 Webview 启动或网络恢复后重放符合条件的操作。
- 队列条目存放在客户端本地存储，并按应用存储/用户范围管理；不提供服务端调度或跨设备队列保证。
- Realtime 消息触发精确的 Query 失效。错过消息后，后续授权查询会重新取得当前数据；广播不充当持久事件日志。
- Supabase 客户端与 Query 重试行为分别在 `src/lib/supabase.ts`、`src/lib/queryClient.ts` 配置，以减少平台故障时请求叠加。
- 专注会话中断和任务提醒调度由前端或 Service 生命周期处理；仓库中没有独立后台 Worker 服务。

## Backend Invariants & Verification

- PostgreSQL RLS/RPC 负责持久化访问控制；界面过滤只用于展示。
- 执行多行领域操作的 RPC 在数据库事务中校验所有权、预期版本和允许的状态转换。
- 数据库变更新增带时间戳的迁移文件；根据权威结构刷新生成的 schema 参考资料。
- Broadcast 载荷只作为失效提示；客户端通过认证查询重新加载记录。
- 离线重放仅处理明确支持的操作，并复用在线写入使用的 Service/RPC 契约。
- 前端或数据客户端变更运行 `pnpm build`；SQL 变更检查 RLS 策略、函数授权、触发器和迁移顺序。本文档修改后运行 `ai-harness validate docs/BACKEND.md --json`。
