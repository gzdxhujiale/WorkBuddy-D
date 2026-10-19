# Tasks

## 1. Tiptap 编辑器命令扩展与快捷键 (Snapshot Extension)

- [x] 1.1 在 `src/components/editor/extensions/snapshot/snapshotExtension.ts` 中实现自定义扩展，注册 `saveSnapshot(name?: string)` 与 `openVersionHistory()` 命令，绑定快捷键 `Mod-Shift-S`，并编写单元测试验证命令派发。
- [x] 1.2 在 `presets/full.ts` 与 `presets/compact.ts` 中注册快照扩展，支持通过编辑器全局回调唤起命名快照弹窗或直接触发快照存储。

## 2. 自动防抖快照机制与知识库全场景入口打通

- [x] 2.1 在 `src/features/knowledge/hooks/useNoteCollab.ts` 中引入静默防抖引擎（5 分钟停止键入且内容有变更时自动持久化快照），并在窗口关闭与页面卸载前置守护中执行脏数据快照刷盘，编写单元测试验证防抖机制。
- [x] 2.2 在 `NoteStandaloneEditor.tsx`（独立原生弹窗标题栏）与 `KnowledgePanel.tsx`（`NoteDrawerContent` 侧边抽屉顶部与菜单）挂载版本历史按钮，打通非铺满模式下的快照浏览、AST 差异对比与回滚能力。

## 3. 每日复盘后端快照存储与 API

- [x] 3.1 编写 Goose 迁移脚本 `000009_add_daily_review_snapshots.sql` 创建 `daily_review_snapshots` 表，在 `server/internal/database/queries/` 中添加快照查询，生成 SQLC 代码。
- [x] 3.2 在 Go 服务端实现 `ListDailyReviewSnapshots` 与 `CreateDailyReviewSnapshot` 处理函数，挂载 `/api/v1/reviews/:date/snapshots` 端点，通过 `go -C server test ./...` 与 `go -C server build ./cmd/server` 验证。

## 4. 每日复盘前端版本历史与可视化比对

- [x] 4.1 在 `src/features/daily-review/api/dailyReviewService.ts` 中封装复盘快照 API，并在 `DailyReviewPanel.tsx` 的 `useReviewAutoSave` 中加入静默防抖快照机制。
- [x] 4.2 开发 `DailyReviewHistoryDrawer.tsx` 复盘历史对比抽屉，复用 `snapshotDiff.ts` 计算富文本差异（绿色新增、红色删除线），并在 `DailyReviewPanel.tsx` 顶部挂载版本历史入口，支持一键恢复历史复盘。

## 5. 全栈综合验收与闭环验证

- [x] 5.1 执行全量构建与边界检查：运行 `pnpm build`、`pnpm lint:boundaries`、`go -C server test ./...` 与 `go -C server build ./cmd/server` 确保构建全绿。
- [x] 5.2 验证 OpenSpec 规约状态与受管文档合规性：执行 `openspec validate --all --json` 与 `ai-harness validate --json` 确认所有项目零缺陷通过。
