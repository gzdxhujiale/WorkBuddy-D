# Proposal

## Why

WorkBuddy-D 现已具备完整的任务执行、项目阶段推进、习惯养成、深度专注与每日复盘能力，但用户在任务拆解、复盘撰写与规划总结等环节仍需大量手动录入与整理。

通过引入以 ByteDance Eino 为核心的 Go 后端 AI 架构、Semi Design 驱动的 AI 会话与工作台前端、统一模型网关与监控，以及标准 MCP (Model Context Protocol) 开放服务，WorkBuddy-D 将从“被动记录型工具”升级为“具备自主规划辅助与开放上下文能力的个人工作大脑”，同时赋予外部 AI 工具（如 Cursor、Claude Desktop 等）安全读写本地业务数据的能力。

## What Changes

1. **统一模型网关与监控 (AI Gateway & Observability)**：
   - 基于 Go 语言与 Eino ChatModel 体系构建轻量级统一模型网关，兼容 OpenAI 规范，支持多渠道配置（OpenAI、DeepSeek、Claude、Ollama、SiliconFlow 及自定义中继）、连通性测试与故障转移（Fallback）。
   - 实现调用链路监控中间件，自动捕获模型调用的 Token 消耗量（Prompt/Completion）、首字延迟（TTFT）、总耗时与执行状态，持久化入库供审计与用量分析。
2. **设置中心新增【AI配置】标签页 (Settings AI Configuration)**：
   - 在设置面板中新增“AI配置”标签页（`tab: "ai"`），提供渠道配置管理、默认/备用模型切换、Skill 开关与提示词参数微调、MCP 服务状态与一键客户端配置导出。
3. **主导航新增【AI】工作台与业务 Skill 赋能 (AI Workspace & Skills)**：
   - 桌面主导航栏新增“AI”入口，集成 Semi Design（`@douyinfe/semi-ui`）的 `Chat` 和 `MarkdownRender` 组件，提供高质感的流式对话、代码高亮、上下文清空与终止生成能力。
   - 基于 Eino Chain/Graph 编排预设 3 大核心业务 Skill：
     - **每日复盘智能合成 (Daily Review Synthesizer)**：自动抽取当日已完成任务、专注时长、习惯打卡数据，按照 4D 结构化模板起草复盘内容并回填编辑器。
     - **任务四象限智能拆解 (Task SMART Breakdown)**：分析高阶目标，按照 SMART 原则与重要/紧急四象限规则拆解为可执行子任务并批量落库。
     - **项目阶段推进顾问 (Project Milestone Advisor)**：依据项目愿景推演阶段划分方案与里程碑建议。
4. **MCP 开放服务与核心业务互通 (MCP Server)**：
   - 基于 Go 实现标准 MCP Server（支持 HTTP/SSE 与独立 stdio 管道命令）。
   - 将现有核心业务层封装为 MCP Tools：
     - **任务中心 CRUD**：`list_tasks`、`create_task`、`update_task_status`、`batch_create_tasks`。
     - **项目中心 CRUD**：`list_projects`、`get_project_stages`、`create_project_stage`、`update_stage_progress`。
     - **每日复盘 CRUD**：`get_daily_review`、`upsert_daily_review`、`get_today_summary_data`。
   - 所有 MCP 写入操作直接复用现有 `sqlc` 查询与 `ws.Hub` 增量事件广播，确保外部修改毫秒级同步刷新桌面端界面。

## Non-goals

- **不内置自包含大模型权重**：不在桌面端打包内置几十 GB 的本地模型文件或实现复杂的量化推理引擎，本地模型统一通过用户自建的 Ollama 或第三方兼容 API 接入。
- **不做多租户计费转售系统**：专注于个人知识工作者的本地效能管理与单用户环境，不引入复杂的商业化点卡扣费、多用户分账或在线充值网关。
- **不侵入性重构现有页面核心样式**：Semi Design 仅作为 AI 办公工作台与 AI 配置模块的专用组件引入，不强行替换既有任务看板、四象限和 Tiptap 富文本编辑器的 Tailwind CSS 4 设计系统。

## Capabilities

### New Capabilities
- `ai-gateway`: 统一模型网关管理、多渠道配置与故障转移、调用监控（Latency/TTFT/Tokens）与审计日志持久化。
- `ai-skills`: 基于 Eino 的 Skill 编排引擎、预设业务技能（复盘合成、任务四象限拆解、项目阶段建议），以及前端主导航 AI 工作台（基于 Semi Design Chat 与 MarkdownRender）。
- `mcp-server`: Model Context Protocol 开放服务，将任务中心、项目中心与每日复盘 CRUD 读写操作暴露为标准 MCP Tools，支持 HTTP/SSE 与 stdio 传输。

### Modified Capabilities
- `client-preferences-sync`: 设置界面扩展“AI配置”标签页，支持模型渠道、默认模型选择与客户端 AI 交互偏好的安全存储与跨窗口状态联动。

## Impact

- **服务端依赖**：引入 Eino 核心模块（`github.com/cloudwego/eino`、`github.com/cloudwego/eino-ext/components/model/openai`）与 Go MCP 库（`github.com/mark3labs/mcp-go`）。
- **数据库迁移**：追加 Goose 增量迁移脚本，新增 `ai_channels`、`ai_skills`、`ai_invocation_logs` 表及索引。
- **前端依赖**：引入 `@douyinfe/semi-ui` 与 `@douyinfe/semi-icons`，配置全局暗色模式联动与 CSS 隔离。
- **桌面与路由**：前端主路由新增 `/ai` 页面路由与主导航图标；设置弹窗扩展 `tab="ai"` 配置组件。
