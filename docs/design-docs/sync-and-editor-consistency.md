# 同步、版本与编辑器一致性

状态：Accepted（当前实现差异见下文）

最后验证：2026-08-14（Supabase `workbuddy` 实时 schema 快照）

## 决策摘要

WorkBuddy-D 使用 **私有 Supabase Broadcast 作为失效提示**，使用普通的、受 RLS 保护的查询作为权威读路径；不把 Broadcast 或 Tauri 窗口事件当作行数据复制协议。数据库拥有审计字段及领域状态转换的时间事实。笔记编辑器先更新本地状态，再经过去重与防抖写入缓存和数据库。

## Realtime：提示而非数据复制

### 当前实现

- Realtime Settings 必须保持服务开启，并关闭 **Allow public access to channels**；这是 Dashboard 设置，仓库文件本身不能证明当前值，变更或发布前必须复核。
- 客户端只订阅私有主题 `user:<user_id>:sync`。
- 应用表不加入 `supabase_realtime` publication；每张应用表的 `AFTER INSERT OR UPDATE OR DELETE` 触发器调用 `realtime.send`。
- 触发器的消息只含 `{ table, operation, id, folder_id, previous_folder_id }`，不含笔记正文或完整行。
- 主窗口将消息映射为最窄的 TanStack Query key 失效，并由活动视图通过正常的 RLS 查询重新读取。

### 原因与边界

Postgres Changes 会为每个订阅客户端按行执行访问检查并传送行内容，适合低频、确实需要行级流的场景。这里的跨窗口同步只需知道“哪个实体变了”，因此私有 Broadcast 的扇出、负载与权限边界更可控。

Broadcast 不保证作为持久化队列：断线、重连或错过消息必须由正常加载/刷新恢复。不要依据消息 payload 覆盖本地实体，也不要因一个提示重拉整张表；优先失效受影响的列表、单条笔记或当前活动视图。

数据库触发器应只在事务提交后的行变化时发送提示。客户端写成功后仍以 RPC 返回的版本和后续 RLS 查询为准。

### 当前实现差异：列表 Tauri 事件

`src/hooks/useKnowledgeQuery.ts` 当前通过 `lists:note-updated`、`lists:note-deleted` 与 `lists:notes-reordered` Tauri 事件，把部分笔记字段直接补丁到其他窗口的 Query cache。事件名为兼容旧窗口而保留；这个快速路径与本决策“不要把 Tauri 窗口事件当作行数据复制协议”的边界不一致。

在该差异被解决前：

1. 不要为更多实体或字段扩展这套 Tauri 行补丁协议。
2. 不要把它作为数据库真相、冲突版本或权限判断的来源。
3. 任何涉及它的变更都应同时评估两种收敛方向：移除补丁并使用精确失效/重取，或用证据更新本决策、权限模型和验证覆盖。

该差异已在 [Architecture](/architecture)、[Reliability](/RELIABILITY) 和 [Quality score](/QUALITY_SCORE) 中登记。

## 数据库负责的事实

客户端不能生成会影响顺序、审计、冲突检测或状态语义的事实。当前约定如下：

| 事实 | 责任方 | 写入方式 |
| --- | --- | --- |
| `created_at`、`updated_at` | 数据库 | 默认值和 `BEFORE UPDATE` 触发器 |
| 乐观锁版本 | 数据库 | 客户端传 `p_expected_updated_at`；成功后采用 RPC 返回的新值 |
| `deleted_at` | 数据库 | 专用软删除 RPC 内部 `now()` |
| 任务 `completed_at` | 数据库 | 任务完成状态的转换逻辑 |
| 专注 `started_at`、`ended_at` | 数据库 | 创建、完成和中断 RPC |
| 新列表/分组/笔记 `sort_order` | 数据库 | 保存 RPC + 父级范围 advisory lock |

客户端可以做乐观显示，但必须在 RPC 成功后用数据库返回的 `updated_at`、`sort_order` 替换缓存值。遇到 `VERSION_CONFLICT` 时保留冲突，不得用本地时钟伪造一个新版本后重试覆盖。

## 笔记编辑器与缓存写入

笔记正文是 Tiptap JSON 字符串。编辑生命周期必须是单向的：

```text
用户编辑 -> 编辑器 onUpdate -> 本地 title/content state
          -> 3 秒防抖 -> 去重后的 optimistic cache update
          -> RPC / Broadcast hint -> 权威查询或返回版本
```

实现约束：

1. 外部内容同步前比较序列化 JSON；仅在内容实际不同才调用 `editor.commands.setContent(..., { emitUpdate: false })`。
2. 编辑器 `onUpdate` 先与最近内容比较，重复 JSON 不上报。
3. 自动保存回调用 ref 保存最新函数。卸载保存的 effect 只能在真实卸载时 cleanup，不能依赖一个会随 Query cache 刷新而改变的回调引用。
4. 防抖 timer 触发保存前先清除 dirty 标记，避免同步缓存更新引起重入时再次触发卸载保存。
5. `updateNote` 在更新缓存、发跨窗口事件或调度 RPC 之前，先比较 `Partial<Note>` 与当前缓存；所有字段相同即为 no-op。

这些规则避免 `编辑器 -> setState -> 缓存更新 -> 父组件重渲染 -> effect cleanup 保存 -> 编辑器` 的闭环；这类闭环会表现为 React 的 `Maximum update depth exceeded`，而不是 Supabase 的 RPC 或字段错误。

## 变更检查清单

修改同步、RPC 或笔记编辑功能时：

1. 确认 RLS、RPC grant 与私有 Realtime topic 都按 `user_id` 隔离。
2. 确认事件是最小失效提示，查询 key 足够精确。
3. 确认新 RPC 的服务端时间、顺序及返回版本被客户端采用。
4. 验证笔记内容未变时不会更新缓存、发送事件或发起网络写入。
5. 验证连续输入、关闭抽屉、跨窗口刷新与断线重连。
6. 运行 `pnpm build`；涉及原生窗口、权限或打包时再执行相应的 Tauri 验证。

## 验收证据

同步或编辑器改动的验收应覆盖可观察行为，而不只看编译结果：

| 场景 | 预期观察 |
| --- | --- |
| 两个同一用户主窗口发生数据库写入 | 私有 Broadcast 只提示受影响范围，活动视图经 RLS 查询收敛。 |
| 离线后保存支持队列的实体并恢复网络 | 每个实体只保留最新待重放操作；不可恢复错误显式保留为冲突。 |
| 两个客户端编辑同一版本化记录 | 后到的陈旧写入获得 `VERSION_CONFLICT`，而不是覆盖远端版本。 |
| 连续编辑笔记并关闭编辑表面 | 相同 JSON 不产生额外写入；最后的有效草稿按防抖/卸载规则保存。 |
| 失去 Broadcast 或重新连接 | 不依赖补发消息；正常加载或精确失效后的 RLS 查询恢复状态。 |
