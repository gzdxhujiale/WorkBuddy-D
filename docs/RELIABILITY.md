# RELIABILITY.md

## Runtime Overview

WorkBuddy-D 采用 Tauri 2 桌面原生环境与 Supabase 云端 BaaS（Auth / PostgREST / RPC / Realtime）混合运行时架构。系统通过严格的客户端契约、乐观更新回滚、单向防抖落库与离线排队机制保障运行稳定性：

| 可靠性核心不变式 | 实现与保障机制 | 事实依据与代码位置 |
| :--- | :--- | :--- |
| **账户切换时旧数据强清理** | 监听 Auth 会话变更，在装载新 Session 前全量清空 TanStack Query 与 Zustand UI 状态。 | `src/App.tsx` |
| **可重试网络错误自动排队** | `runOrQueue` 将支持离线的写操作保存在本地 LocalStorage，网络恢复或主窗口重连时自动重放。 | `src/lib/offlineSyncQueue.ts` |
| **非网络错误严禁混入离线队列** | 仅归类为 Network/Offline 的错误进入排队；业务校验错误、权限错误或数据冲突立即向上传播报错。 | `src/lib/offlineSyncQueue.ts`, `src/lib/sync.ts` |
| **过期版本禁止静默覆盖** | 所有可编辑实体在提交 RPC 时携带 `p_expected_lock_version`，数据库校验版本不符时抛出 `VERSION_CONFLICT`。 | `supabase/migrations/`, [ARCHITECTURE.md](../ARCHITECTURE.md) |
| **实时广播丢失安全可恢复** | 私有 Broadcast 仅作为失效提示；连接丢失或漏收消息时，通过常规的 RLS 查询请求拉取最新数据。 | `src/lib/realtimeManager.ts` |
| **服务端故障防请求风暴** | 全局禁用 TanStack Query 激进重试与挂载自动重拉；遇到 Supabase 521 故障时强制熔断暂停 Auth 刷新 30 秒。 | `src/lib/queryClient.ts`, `src/lib/supabase.ts` |

## Critical Dependencies

系统运行强依赖以下核心运行时组件与外部服务，各自具备严格的隔离与故障边界：

1. **Tauri 2 桌面宿主与 Webview 容器**：负责窗口创建、多窗口生命周期管理、桌面原生通知与本地持久化存储。
2. **Supabase Auth**：负责用户身份认证与 JWT 令牌续期；Session 失效时平滑重定向至登录页。
3. **Supabase PostgREST & RPC 存储过程**：负责数据持久化读写、原子事务执行与基于行级安全策略（RLS）的数据过滤。
4. **Supabase Realtime Broadcast**：私有实时广播频道（`user:<id>:sync`），负责跨窗口与跨端分发数据变更失效提示。
5. **Tiptap 富文本编辑器引擎**：负责知识库与任务描述的结构化 JSON 编辑与本地草稿暂存。

## Failure Modes

系统已识别的典型故障模式及针对性处理策略：

- **网络断连与弱网环境 (Offline / Network Partition)**：
  - 支持离线操作的领域（任务、习惯、每日复盘、清单列表）自动进入本地 `offlineSyncQueue`；
  - 界面保持乐观展示并提示离线暂存状态；检测到 `window.online` 事件后按序自动重放。
- **并发写入与版本冲突 (Concurrent Edit Conflict)**：
  - 当另一个窗口或设备已提交更高版本的更新时，当前提交触发 `VERSION_CONFLICT`；
  - 前端保留本地冲突草稿并提示用户，严禁使用本地时钟自增版本强制覆盖。
- **实时广播丢包或重连 (Broadcast Packet Loss)**：
  - Broadcast 通道设计为弱保证传输层，即使广播消息丢失，用户切页或手动刷新时通过 RLS 读路径即可实现数据最终一致性。
- **后端服务熔断与 521 故障 (Backend Outage)**：
  - 触发 30 秒静默熔断窗口，阻止客户端高频轮询放大服务端负载，向用户展示友好离线警示。
- **桌面窗口非正常关闭 (Unexpected Window Unload)**：
  - 主窗口卸载时自动触发正在进行的专注会话标记中断；知识库编辑器在组件卸载（`componentWillUnmount`）前同步触发防抖强制提交。

## Observability

当前系统的可观测性与运行诊断体系：

- **本地运行时诊断**：通过 `console.warn`、`console.error` 与内部 `logSilent` 输出关键链路诊断信息。
- **开发与调试工具**：支持通过 Vite DevTools、React DevTools 及 Tauri 开发控制台实时捕获状态变化。
- **当前限制说明**：仓库当前未集成云端 Sentry 错误监控、Prometheus 指标采集或集中式日志聚合管道，故障排查以本地日志复现为主。

## Recovery

系统的故障自愈与数据恢复机制：

1. **离线重放引擎 (Offline Replay Engine)**：主窗口启动或网络恢复时，自动遍历本地队列并执行最新有效操作，遇到已解决冲突自动清理。
2. **单实体乐观回滚 (Narrow Invalidation)**：单个写操作失败时，仅失效该实体对应的 Query Key 并通过 RLS 重新拉取，严禁回滚整张表的全局快照以避免冲掉其他实体的有效编辑。
3. **富文本草稿防丢保护**：知识库与任务富文本在本地维护单向数据流与防抖计时器，网络异常时草稿保留在编辑器内存中供用户重试。
4. **分级按需降级策略**：知识库优先保证侧边栏目录可用，单篇笔记内容加载失败时不阻断整个知识库导航。

## Reliability Review Criteria

在对核心数据链路、网络请求或窗口生命周期进行变更时，必须通过以下可靠性评审检查：

1. **[ ] 断网与重连验证**：断开网络后执行操作能够正确进入离线队列，网络恢复后能够 100% 成功重放。
2. **[ ] 版本冲突不被覆盖**：在模拟并发冲突时，`VERSION_CONFLICT` 能够被正确捕获，未发生静默覆盖。
3. **[ ] 广播失效正确收敛**：接收到 Broadcast 提示后，仅精确失效受影响的 Query Key，未触发全表无脑重拉。
4. **[ ] 异常不被静默吞没**：数据写入链路不存在无处理的 `catch(() => {})`，错误能够转化为用户可见提示或可控重试。
5. **[ ] 防抖与卸载落库安全**：快速连续键入并立即关闭窗口，修改内容未发生丢失。
6. **[ ] 编译与类型零错误**：`pnpm build`（`tsc && vite build`）通过，无悬空 Promise 或类型断言漏洞。
