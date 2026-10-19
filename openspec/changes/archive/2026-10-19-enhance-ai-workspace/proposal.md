# Proposal

## Why

WorkBuddy-D 现有的 AI 界面仅支持单轮对话且未提供会话历史管理，在多任务与复杂规划场景下无法回溯上下文；同时，缺乏类似 Codex 与 Antigravity 的思考链可视化、工具调用进度反馈以及输入框内置模型切换，导致用户在复杂思考模型（如 DeepSeek-R1、Claude 3.7、o3-mini）下体验不够清晰透明。本次升级旨在引入双栏专业工作台架构，提供会话持久化管理、思考链折叠展示、工具执行卡片与 Semi MarkdownRender 渲染，全面提升 AI 效能协同体验。

## What Changes

- **双栏工作台布局**：新增左侧会话历史侧边栏（会话创建、分组、切换、重命名、置顶与删除，支持快捷折叠）与右侧主对话区。
- **思考链与深度推理可视化**：支持流式解析与折叠渲染思考过程（Thinking Process），思考过程中实时滚动，完成后自动平滑收折为耗时摘要标签，支持手动展开回看。
- **工具调用状态与卡片化展示**：在消息卡片中实时渲染 Tool Calls 执行状态（Pending、Running、Success、Failed）、入参预览与执行耗时。
- **输入框集成模型选择胶囊**：重构输入区域，在输入框内部工具栏直接集成模型选择下拉器（切换渠道与模型）、深度思考开关及上下文引用。
- **Semi MarkdownRender 富文本渲染**：对话正文使用 Semi Design MarkdownRender，支持代码高亮复制、数学公式、表格及自定义组件。
- **会话持久化与结构化 SSE 协议**：Go 后端引入 `ai_sessions` 与 `ai_messages` 表，升级 SSE 推送协议为事件驱动流（`event: thinking`、`event: tool_call`、`event: content`、`event: done`）。

## Capabilities

### New Capabilities
- `ai-workspace`: 覆盖双栏会话历史管理、思考链折叠展示、工具调用卡片化渲染、输入框模型选择胶囊以及基于 Semi MarkdownRender 的消息渲染与持久化。

### Modified Capabilities
<!-- 无现有 capability 的需求发生破坏性变更 -->

## Impact

- **数据层**：新增 Goose 迁移文件 `000006_add_ai_sessions_and_messages.sql`，建立 `ai_sessions` 和 `ai_messages` 表及对应级联外键。
- **后端服务**：扩展 `server/internal/handler/ai_handler.go`，提供会话 CRUD 接口，并升级 `/api/v1/ai/chat` 为多事件标准 SSE 输出。
- **前端架构**：升级 `src/features/ai/components/AIWorkspace.tsx` 为双栏布局，引入 `AISessionList`、`AIThinkingBlock`、`AIToolCallBlock` 等组件，利用 Semi `Chat` 的 `renderInputArea` 实现内置模型切换。
- **组件依赖**：充分利用 `@douyinfe/semi-ui` 现存的 `Layout`、`Collapse`、`Dropdown`、`Card`、`Tag`、`MarkdownRender` 等组件。
