# Proposal

## Why

WorkBuddy-D 支持主窗口全屏编辑、抽屉预览以及多独立的原生弹窗编辑，但当前多窗口并发编辑依赖粗粒度的整篇草稿自动保存覆盖，缺乏字符级的并发冲突解决与光标感知机制；同时用户从外部 Office/网页复制内容时常带入杂乱 HTML 样式。趁着获得 Tiptap Team 计划访问权限的契机，通过本地自持关键 Pro 扩展（Paste Handler）、构建 Go 后端兼容的 Yjs 协同中继以及基于 Yjs 快照的版本可视化对比，既能彻底解决多窗口并发冲突与剪贴板污染，又保证在 1 个月试用期结束后系统完全自主可控、离线可用。

## What Changes

- **本地自持 Paste Handler 扩展**：使用 Tiptap Pro Token 从私有 Registry 下载 `@tiptap-pro/extension-paste-handler`，并将其完整代码移入 `src/components/editor/extensions/paste-handler/` 本地目录自持，在 `RichTextEditor` 中默认启用，实现对 Word、Excel、飞书等外部来源剪贴板的语义化清洗。
- **Go 独立后端 Yjs 协同中继服务**：在 Go 后端 (`server/internal/sync`) 新增对 Yjs 协同协议（`y-websocket` / Hocuspocus 兼容协议）的支持，提供轻量级二进制消息中继与文档房间状态管理，将多窗口连接聚合至本地内存与 PostgreSQL 快照持久化。
- **前端多窗口 Yjs 协同绑定**：在 `RichTextEditor` 与 `FullNoteEditor` / `NoteStandaloneEditor` 中集成 `@tiptap/extension-collaboration` 与 `@tiptap/extension-collaboration-cursor`，连接 Go 后端协同中继，实现主窗口与独立弹窗之间的毫秒级打字同步与光标状态感知。
- **基于 Yjs 快照的可视化富文本版本对比**：利用 Yjs 的 `Y.snapshot(doc)` 与历史差异计算能力，在笔记编辑区提供版本历史抽屉与可视化 Diff 面板，直观展示段落增删、格式变动的颜色高亮与删除线。
- **构建配置与 Token 安全收敛**：在本地开发配置中临时注入 Tiptap Pro Registry 凭据拉取包，代码自持落盘后清除全局配置明文凭据，避免敏感 Token 泄露。

## Capabilities

### New Capabilities

*(无新增独立领域 capability，相关需求归入既有核心能力)*

### Modified Capabilities

- `rich-text-editor`: 扩展剪贴板内容处理规约，增加对外部富文本源（Office/Word/网页）的自动化样式与结构清洗要求；集成本地自持的 Paste Handler 保证离线排毒能力。
- `knowledge-base`: 扩展多端/多窗口笔记交互规约，要求主窗口与独立笔记编辑窗口在打开同一笔记时实现基于 Yjs CRDT 的无锁并发协作与实时光标感知；增加基于 Yjs 快照的富文本历史版本比对与变更可视化规约。

## Impact

- **前端影响**：
  - 新增本地自持扩展 `src/components/editor/extensions/paste-handler/`。
  - `src/components/editor/presets/full.ts` 与 `RichTextEditor.tsx` 新增 Yjs Collaboration 扩展配置与 Paste Handler 绑定。
  - `src/features/knowledge/components/FullNoteEditor.tsx` 与 `NoteStandaloneEditor.tsx` 增加协同状态指示器与版本对比面板。
  - 新增前端依赖：`yjs`, `y-websocket`, `@tiptap/extension-collaboration`, `@tiptap/extension-collaboration-cursor`。
- **后端影响 (`server/`)**：
  - 新增基于 WebSocket 的 Yjs 消息中继模块（路由如 `/api/v1/notes/:id/collab`），负责协调客户端 `sync-step-1`, `sync-step-2`, `update`, `awareness` 二进制报文。
  - 扩展数据库存储或写后缓冲区，定期把 Yjs 二进制状态（`Y.encodeStateAsUpdate`）持久化至数据库，保持与既有 Markdown/JSON 存储架构的平滑过渡。
- **安全性与凭据管理**：
  - Tiptap Pro Registry Token 仅用于提取本地代码，完成后项目构建与测试完全解耦第三方网络凭据。
