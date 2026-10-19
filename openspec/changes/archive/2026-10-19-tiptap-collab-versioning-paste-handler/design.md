# Design

## Context

WorkBuddy-D 采用 Tauri 2 原生桌面容器配合独立 Go 1.26 后端与 Neon PostgreSQL 构建。在知识库笔记模块中，系统支持主工作区全功能编辑、抽屉预览以及多独立的 `NoteStandaloneEditor` 原生弹窗。目前多窗口编辑同一篇笔记时，各窗口均依赖本地草稿定时提交至 Go 后端的 `NoteBufferManager`，依靠版本锁（Optimistic Lock Version）做冲突检测，容易导致后编辑窗口遭遇乐观锁冲突或静默覆盖。

在富文本编辑方面，系统使用 Tiptap 3.32.0 开源核心，缺少对外部复杂排版（如 Microsoft Word、Excel、富文本网页）剪贴板内容的系统化清洗。通过用户提供的 Tiptap Pro 凭据自持关键扩展，并结合 Yjs 协同中继与快照机制，可系统性升级上述能力。

## Goals / Non-Goals

**Goals:**
- **本地自持 Paste Handler 扩展**：借助 Tiptap Pro 个人令牌拉取 `@tiptap-pro/extension-paste-handler`，并将其完整代码移入 `src/components/editor/extensions/paste-handler/` 自行维护，解除对私有 NPM Registry 的长期依赖。
- **Go 后端内嵌 Yjs 协同中继服务**：在现有 Go 后端内以原生 WebSocket 实现 `y-websocket` / Hocuspocus 兼容协议的轻量级二进制消息中继，无缝管理以 Note ID 为房间单位的多连接协同。
- **多窗口实时零冲突协同**：主窗口与独立原生编辑窗口打通 Yjs CRDT 增量数据流，实现毫秒级双向键入同步与感知光标展示。
- **基于 Yjs 快照的富文本可视化版本比对**：支持在笔记保存点捕获 `Y.snapshot`，并在前端以结构化富文本 Mark（绿色高亮/红色删除线）呈现差异对比与回滚能力。
- **向后兼容性保障**：维持现有的 Markdown/JSON 存储和写后缓冲机制，确保搜索、导出与外部同步契约不受影响。

**Non-Goals:**
- 不引入外部 Node.js Hocuspocus 守护进程或 Sidecar，严格保持 Go 独立后端单体轻量性。
- 不引入公网多用户鉴权系统（范围聚焦于单用户在桌面应用内的多窗口、多设备本地网络协同）。
- 不破坏现有 PostgreSQL `notes` 表的文本字段存储语义，Yjs 增量与快照作为协同层与版本历史层共存。

## Architecture & Data Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Tauri Desktop Frontend                          │
│                                                                        │
│   ┌───────────────────────────┐    ┌───────────────────────────┐       │
│   │   Main Window (Full)      │    │  Standalone Note Window   │       │
│   │   - Tiptap + PasteHandler │    │   - Tiptap + PasteHandler │       │
│   │   - Collaboration Ext     │    │   - Collaboration Ext     │       │
│   │   - y-websocket Provider  │    │   - y-websocket Provider  │       │
│   └─────────────┬─────────────┘    └─────────────┬─────────────┘       │
└─────────────────┼────────────────────────────────┼─────────────────────┘
                  │ ws://127.0.0.1:8080/api/v1/notes/:id/collab           │
                  ▼                                ▼                     
┌────────────────────────────────────────────────────────────────────────┐
│                      Go Backend (server/)                              │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ Yjs Sync Hub (server/internal/sync/yjs_hub.go)                 │   │
│   │ - Room Manager (key: note_id)                                  │   │
│   │ - Message Protocol Handler (SyncStep1, SyncStep2, Update, Aware)│   │
│   │ - Binary Broadcast Relay between clients                       │   │
│   └──────────────────────────────┬─────────────────────────────────┘   │
│                                  │ Snapshot & Compact                  │
│                                  ▼                                     │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ NoteBufferManager & Repository                                 │   │
│   │ - notes table (markdown content & updated_at)                  │   │
│   │ - note_snapshots table (note_id, snapshot_bin, created_at)     │   │
│   └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

## Decisions

### Decision 1: Go 原生 WebSocket 协同中继 vs 独立 Node.js Hocuspocus 进程
- **选择**: 在 Go 后端原生实现 Yjs WebSocket 中继模块。
- **原因**: 遵循 WorkBuddy-D 的技术基线（纯 Go 独立后端 + Tauri），避免引入 Node.js 运行时或额外 Sidecar 进程造成的内存膨胀和安装包构建复杂化。Yjs 的客户端连接协议（`y-websocket`）极其紧凑，主要涵盖 `SyncStep1`（发送本地 StateVector）、`SyncStep2`（回复差异 Update）、`Update`（广播增量变更）和 `Awareness`（光标状态广播）。Go 仅需作为二进制中继管道，并在所有连接关闭或定时刷新时将状态快照存入数据库。
- **替代方案**: 启动 Node.js Hocuspocus 容器或可执行文件（增加进程管理负担与安装包体积）。

### Decision 2: Paste Handler 的自持 (Vendorize) 策略
- **选择**: 临时在项目配置中加入 `.npmrc`（使用提供的令牌 `mukAlfaiWmH5/U4+tbe8H+GaIaEYzwGFJhZIvSFuCbgpq/kJq2LHjkCklEB0V2jP`），使用 pnpm 安装 `@tiptap-pro/extension-paste-handler` 后，将其源码/dist 完整拷贝至 `src/components/editor/extensions/paste-handler/`，移除全局令牌记录并切换为本地模块导入。
- **原因**: Tiptap Pro 的 `@tiptap-pro/extension-paste-handler` 属于纯客户端前端插件，不包含任何运行时云端鉴权调用。通过自持代码（Vendorize），可以在 1 个月试用期结束后永久保持项目离线构建和开箱即用，彻底消除私有 Registry 凭据过期后的构建阻断风险。
- **替代方案**: 持续在 `package.json` 中引用私有包（导致到期后在新机器或 CI 上 `pnpm install` 失败）。

### Decision 3: 双轨数据模型（Yjs 协同 + Markdown/JSON 持久化）
- **选择**: 保留 `notes` 表主体的 Markdown 文本字段，新增 `note_snapshots` 表记录 Yjs 二进制快照。
- **原因**: WorkBuddy-D 现有的全文检索、模板克隆、批量导出、写后缓冲等 18 项知识库规约全部以标准文本和 Markdown 为基准。在编辑器连接期间，文档以 Yjs CRDT 数据结构在内存中高频更新；当编辑静默或保存时，自动将 Yjs Doc 状态导出为最新 Markdown 内容更新 `notes` 表，兼顾并发协同与生态兼容。
- **替代方案**: 完全抛弃 Markdown 存储仅存 Yjs 二进制（会导致现有搜索、导出与外部同步逻辑全部需要重写）。

### Decision 4: 基于 Yjs 快照的富文本可视化比对
- **选择**: 利用 Yjs 的 `Y.snapshot(doc)` 与 `Y.createDocFromSnapshot(doc, snapshot)` 机制，在前端实例化只读比对视图，计算两份快照之间的变更节点并注入自定义 Mark（高亮与删除线）。
- **原因**: 规避了传统行级 Diff 对富文本 HTML / ProseMirror 树形结构的破坏，保持跨段落、表格、代码块等复合节点的渲染稳定性和视觉可读性。

## Risks / Trade-offs

- **[Risk] Yjs 二进制增量日志长期累积导致内存膨胀**  
  → **Mitigation**: 在房间所有客户端断开连接时，或在定时同步触发时，执行 `Y.encodeStateAsUpdate` 压缩合并为单一基准 Update，重置历史增量链条。
- **[Risk] 自持的 Paste Handler 与未来 Tiptap 大版本升级潜在的不兼容**  
  → **Mitigation**: 编写针对 Word/Excel 粘贴的专门自动化单测用例，验证其在当前锁定的 Tiptap 3.32.0 版本下的清洗有效性，并在升级主版本时集中验证。
- **[Risk] 凭据泄露风险**  
  → **Mitigation**: 个人令牌仅用于初始化阶段拉取离线文件，严禁将包含真实 Token 的 `.npmrc` 提交至 Git 仓库，拉取完成后立即自持并清除凭据配置。
