# Tasks

## 1. Paste Handler 依赖拉取与本地自持 (Vendorization)

- [x] 1.1 配置临时 `.npmrc` 并通过 `pnpm add @tiptap-pro/extension-paste-handler` 下载扩展，验证包文件成功存入 `node_modules`。
- [x] 1.2 将包代码提取移入本地目录 `src/components/editor/extensions/paste-handler/`，移除 `.npmrc` 中的明文 Token 并解除 `package.json` 对私有 Registry 的直接依赖，验证 `pnpm build` 在无网络凭据下编译通过。
- [x] 1.3 在 `src/components/editor/presets/full.ts` 与 `RichTextEditor.tsx` 中注册本地自持的 Paste Handler 扩展，编写测试用例验证从 Microsoft Word 与富文本网页复制的内容被正确清洗。

## 2. Go 后端 Yjs 协同中继服务 (Yjs Hub)

- [x] 2.1 在 `server/internal/sync/yjs_hub.go` 中实现针对 `y-websocket` 协议规范的轻量级二进制中继，支持按 `note_id` 管理会话房间并处理 `SyncStep1`、`SyncStep2`、`Update` 与 `Awareness` 消息，编写单元测试并通过 `go -C server test ./internal/sync/...` 验证。
- [x] 2.2 在 Go HTTP 路由树中挂载 `/api/v1/notes/:id/collab` WebSocket 端点，并在数据库中新增 `note_snapshots` 表用于持久化聚合状态，通过 `go -C server build ./cmd/server` 验证后端编译。

## 3. 前端多窗口 Yjs 协同绑定

- [x] 3.1 安装开源协同包 `yjs`, `y-websocket`, `@tiptap/extension-collaboration`, `@tiptap/extension-collaboration-cursor`，在 `src/features/knowledge/hooks/useNoteCollab.ts` 中封装生命周期管理与连接状态 Hook，验证单元测试。
- [x] 3.2 将协同扩展接入 `FullNoteEditor.tsx` 与 `NoteStandaloneEditor.tsx`，在编辑器头部展示协作连接指示灯与感知光标（Cursor Presence），验证同时在主窗口和独立弹窗编辑同一篇笔记时字符实时双向同步。

## 4. 基于 Yjs 快照的可视化富文本版本对比

- [x] 4.1 在 `src/features/knowledge/utils/snapshotDiff.ts` 中基于 `Y.snapshot(doc)` 与 `Y.createDocFromSnapshot` 实现版本快照生成与 AST 差异计算，验证差异提取测试。
- [x] 4.2 在 `FullNoteEditor.tsx` 中开发版本历史抽屉与可视化 Diff 面板，以绿色背景显示新增内容、红色删除线显示被删内容，并支持一键恢复历史快照，验证界面在 Retro Pixel 与 Modern 双主题下样式合规。

## 5. 全栈综合验收与闭环验证

- [x] 5.1 执行全量构建与边界检查：运行 `pnpm build`、`pnpm lint:boundaries`、`go -C server test ./...` 与 `go -C server build ./cmd/server` 确保构建全绿。
- [x] 5.2 验证脱网环境下的独立运行能力：在断开外网状态下验证多窗口实时协同打字无冲突、剪贴板清洗有效、历史版本比对渲染正常。

## Workflow follow-up

- 实施完成后使用 `openspec-sync-specs` 或按流程归档变更。
- 更新受管架构文档与知识库技术边界约定。
