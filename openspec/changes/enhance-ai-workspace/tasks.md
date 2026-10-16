# Tasks

## 1. 数据库与会话持久化层 (Database & Session Persistence)

- [x] 1.1 编写 Goose 增量迁移脚本 `000006_add_ai_sessions_and_messages.sql`（`ai_sessions`、`ai_messages` 表及索引），编写 sqlc 查询并验证 `go -C server test ./...` 编译通过
- [x] 1.2 在 `server/internal/handler/ai_handler.go` 暴露会话 CRUD REST 接口（`/api/v1/ai/sessions`、`/api/v1/ai/sessions/:id`、`/api/v1/ai/sessions/:id/messages`）并编写单元测试验证

## 2. 后端事件驱动流式协议升级 (Event-Driven SSE Protocol)

- [x] 2.1 升级 `/api/v1/ai/chat` 为事件驱动流（输出 `event: session`、`event: thinking`、`event: tool_call`、`event: tool_result`、`event: content`、`event: done`），并在流式结束或中断时自动将完整消息落库
- [x] 2.2 编写后端单元测试验证多事件 SSE 输出、思考内容提取与会话异步落库正确性

## 3. 前端双栏工作台与会话历史 (Two-Column Layout & Session Sider)

- [x] 3.1 基于 Semi Design `Layout.Sider` 实现左侧会话历史侧边栏（新建会话、按时间分组、检索过滤、快捷键折叠、重命名与置顶）
- [x] 3.2 实现会话切换与 TanStack Query 缓存联动，切换会话秒级加载并恢复历史聊天消息流

## 4. 深度思考链与工具调用卡片组件 (Thinking & Tool Invocation Components)

- [x] 4.1 开发 `AIThinkingBlock` 组件，基于 Semi `Collapse` 与 `Tag` 实时展示思考过程，在思考结束转正文时自动收起为耗时摘要标签并支持用户手动展开
- [x] 4.2 开发 `AIToolCallBlock` 组件，卡片化展示 Tool Calls 执行状态（Pending / Running / Success / Error）、入参简报与执行耗时

## 5. 复合输入胶囊盒与 Semi Markdown 渲染 (Capsule Input Box & Semi MarkdownRender)

- [x] 5.1 基于 Semi `Chat` 的 `renderInputArea` 重构输入区域，在输入框内部工具栏直接集成模型切换下拉菜单（`Select`）、深度思考开关及快捷发送控制
- [x] 5.2 对话正文集成 Semi Design 官方 `MarkdownRender`，验证代码块语法高亮、一键复制、数学公式排版与表格展示

## 6. 全量验证与端到端质量保障 (Verification & Quality Assurance)

- [x] 6.1 执行 Go 后端全量测试与静态检查：`go -C server test ./...` 与 `go -C server vet ./...`
- [x] 6.2 执行前端全量构建与架构边界校验：`pnpm build` 与 `pnpm lint:boundaries`
- [x] 6.3 运行 `openspec validate enhance-ai-workspace --json` 验证全部规约与产物完全合规

