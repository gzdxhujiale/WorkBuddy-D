# Tasks

## 1. 基础设施与数据库演进 (Infrastructure & Database)

- [x] 1.1 引入 Go 后端依赖（`github.com/cloudwego/eino`、`github.com/cloudwego/eino-ext`、`github.com/mark3labs/mcp-go`），运行 `go -C server mod tidy` 并验证编译通过
- [x] 1.2 编写 Goose 增量迁移脚本 `000005_add_ai_module_tables.sql`（`ai_channels`、`ai_skills`、`ai_invocation_logs` 表及其索引），启动服务验证迁移自动应用成功
- [x] 1.3 引入前端 Semi Design 依赖（`@douyinfe/semi-ui` 与 `@douyinfe/semi-icons`），在 `src/index.css` 引入样式并验证 `pnpm build` 无类型与构建错误

## 2. 统一模型网关与调用监控 (AI Gateway & Observability)

- [x] 2.1 在 `server/internal/ai/gateway/` 实现多渠道管理、连通性探测（Ping）与基于 Eino 的 OpenAI 兼容 ChatModel 工厂，编写单元测试验证渠道解析与 Ping 逻辑
- [x] 2.2 在 `server/internal/ai/gateway/` 实现主备渠道动态优先级调度与超时自动降级（Fallback）链，验证主渠道故障时自动无缝切换至备用渠道
- [x] 2.3 在 `server/internal/ai/monitor/` 实现 Eino Callbacks 监控拦截切面，自动记录 Prompt/Completion Tokens、首字延迟（TTFT）与总耗时并持久化至 `ai_invocation_logs`
- [x] 2.4 在 `server/internal/handler/` 暴露网关与监控 REST 接口（`/api/v1/ai/channels`、`/api/v1/ai/channels/:id/ping`、`/api/v1/ai/metrics`），通过 HTTP 请求验证增删改查与监控统计输出

## 3. 设置中心【AI配置】界面开发 (Settings AI Configuration)

- [x] 3.1 在 `src/features/settings/components/SettingsDialog.tsx` 新增“AI配置”标签页（`tab="ai"`），构建基于 Semi UI 的渠道列表管理与添加渠道弹窗
- [x] 3.2 实现模型渠道一键“测试连接”交互，展示往返延迟 Tag 与状态徽标，并提供默认主模型与备用降级模型下拉切换
- [x] 3.3 实现调用监控看板组件，直观展示今日 Token 消耗统计、平均响应耗时图表与最近调用审计日志列表

## 4. 业务 Skill 编排与 Semi Chat 工作台 (Skills & AI Workspace)

- [x] 4.1 在 `server/internal/ai/tools/` 将任务中心、项目中心与每日复盘现有数据操作封装为标准 Eino Tools（参数验证、租户隔离与错误处理）
- [x] 4.2 在 `server/internal/ai/skill/` 基于 Eino DAG 编排 3 个核心业务 Skill：每日复盘智能合成（提取今日任务/打卡/专注）、任务四象限智能拆解与项目阶段规划建议，验证输出 JSON 与 Markdown 契约
- [x] 4.3 在 Go 后端暴露流式对话接口 `/api/v1/ai/chat`（支持 SSE 输出与客户端 CancelContext 中断）
- [x] 4.4 在前端导航栏新增“AI”入口与 `/ai` 独立路由页面，基于 Semi Design `Chat` 与 `MarkdownRender` 构建对话工作台，验证流式打字渲染、中止生成与一键应用到复盘/任务

## 5. MCP 开放协议服务端 (MCP Server)

- [x] 5.1 基于 `mark3labs/mcp-go` 实现标准 MCP Server，注册任务中心 CRUD、项目中心 CRUD 与每日复盘 CRUD 对应的 MCP Tools
- [x] 5.2 在 Go 后端挂载 `/api/v1/mcp/sse` 端点，并在主程序增加 `server mcp` 命令行子命令以支持 stdio 传输
- [x] 5.3 验证 MCP 写入操作触发 `ws.Hub` 广播 `ENTITY_DELTA` 事件，确认外部写入时桌面端前端无感知自动刷新
- [x] 5.4 在设置“AI配置”标签页中提供 MCP 运行状态展示，并提供一键复制 Cursor 与 Claude Desktop 配置文件（`mcp.json`）片段功能

## 6. 全链路集成与端到端验证 (Integration & Quality Assurance)

- [x] 6.1 执行 Go 后端全量测试与代码检查：`go -C server test ./...` 与 `go -C server vet ./...`
- [x] 6.2 执行前端全量构建与架构边界校验：`pnpm build` 与 `pnpm lint:boundaries`
- [x] 6.3 运行 `openspec validate add-ai-module --json` 验证全部规约与产物完全合规
