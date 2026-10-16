# Design

## Context

WorkBuddy-D 基于 Tauri 2 桌面宿主、React 19 多 Webview 前端、Go 1.26 独立后端以及 Neon/本地 PostgreSQL 构建。当前系统通过 Gin 提供 RESTful 接口，通过 `pgxpool` 和 `sqlc` 执行类型安全数据访问，并通过 `ws.Hub` 单调递增序列广播实时数据增量。

本次变更旨在引入完整的 AI 基础设施与办公工作台，实现统一模型网关、业务 Skill 编排、开放 MCP 服务及调用度量监控。动机与边界详见 [proposal.md](proposal.md)。

## Goals / Non-Goals

**Goals:**
- **Go 端 Eino 核心编排**：基于 ByteDance Eino（`github.com/cloudwego/eino`）构建 AI 服务核心，统一 ChatModel 抽象、PromptTemplate 模板、Tool 装配与 DAG 执行图。
- **轻量级模型网关与容灾**：支持注册与管理多供应商渠道（OpenAI、DeepSeek、Claude、Ollama 等），实现主备渠道动态优先级调度与超时/异常自动降级（Fallback）。
- **全链路调用度量与审计**：基于 Eino Callback 机制，拦截捕获每次调用的 Prompt/Completion Tokens、首字延迟（TTFT）、总耗时与执行状态，写入 PostgreSQL `ai_invocation_logs`。
- **Semi Design AI 办公工作台**：前端主导航新增 `/ai` 入口，集成 `@douyinfe/semi-ui` 的 `Chat` 与 `MarkdownRender` 组件，提供具备流式吐字、代码语法高亮、中止生成与清空上下文能力的高质感会话界面。
- **设置中心新增【AI配置】**：在 `SettingsDialog.tsx` 新增“AI配置”标签页（`tab="ai"`），提供渠道配置 CRUD、连通性探测（Ping）、默认/备用模型切换与 Skill 参数调节。
- **双协议 MCP 开放服务**：基于 `mark3labs/mcp-go` 实现标准 MCP Server，提供 HTTP/SSE（`/api/v1/mcp/sse`）与命令行 stdio（`server.exe mcp`）双通信模式，将任务中心、项目中心与每日复盘 CRUD 暴露为原子 Tool，写操作复用 `ws.Hub` 广播保障桌面端毫秒级视图同步。

**Non-Goals:**
- 不打包本地几百兆/几十G的私有大模型权重，本地推理统一依赖用户本地运行的 Ollama 或第三方服务。
- 不做面向外部多租户的复杂点卡与商业计费转售系统，聚焦个人工作台单用户效能管理。
- 不全量替换既有任务看板、四象限和 Tiptap 富文本组件的 Tailwind CSS 4 基础样式，Semi Design 严格限定在 AI 工作台与 AI 配置相关界面。

## Decisions

### 1. 后端 AI 引擎选型：采用 ByteDance Eino (`github.com/cloudwego/eino`)
- **选择理由**：Eino 是 Go 语言中目前组件化、工程规范度最高的 LLM 框架。其组件接口（`ChatModel`、`Tool`、`PromptTemplate`、`Graph`）高度契合 Go 习惯用法，拥有出色的泛型支持、极低反射开销和清晰的 DAG 编排能力。
- **替代方案考虑**：
  - *LangChainGo*：Python 风格移植严重，抽象层级深且繁冗，更新与新特性支持不够及时。
  - *纯手写 go-openai*：缺少成熟的 DAG 图编排、切面拦截器以及标准化的 Tool 状态机，随着业务 Skill 增多会积累大量粘合代码。

### 2. 前端 AI 界面选型：采用 Semi Design (`@douyinfe/semi-ui`)
- **选择理由**：Semi Design 拥有专为大模型交互打磨的 `Chat` 与 `MarkdownRender` 成熟组件，原生支持流式 SSE 数据渲染、状态徽标、中止生成、复制代码块、公式渲染与多轮上下文重置，极大降低了前端造轮子的研发成本。
- **替代方案考虑**：
  - *基于 Radix UI + Tailwind 自建 Chat 气泡*：代码量巨大（需处理流式打字效果、光标闪烁、Markdown AST 解析、代码高亮等），且难以保证交互细节与性能。
- **共存与隔离策略**：
  - Semi Design 组件样式均以 `semi-` 为前缀，在 `src/index.css` 引入 `@douyinfe/semi-ui/dist/css/semi.css`，利用 CSS 级联规则保障不与 Tailwind CSS 4 原子类冲突。
  - 暗色模式联动通过切换 `document.body.setAttribute('theme-mode', 'dark' | 'light')` 保证两套 UI 视觉一致。

### 3. MCP 开放协议架构：双模接入 + 核心数据库复用
- **选择理由**：外部 AI 工具偏好的传输协议不同，Cursor / Claude Desktop 倾向本地进程管道（stdio），而网络 Agent / 远程助手倾向 HTTP/SSE。Go 后端同时支持：
  1. HTTP/SSE 挂载端点：`/api/v1/mcp/sse`；
  2. CLI 子命令模式：`server.exe mcp`，从标准输入输出启动 stdio 传输。
- **数据一致性保障**：MCP Tools 底层直接调用现有的 `sqlc.Querier` 与 `ws.Hub`，任何外部 Agent 创建或修改任务，都会立即向前端广播 `ENTITY_DELTA` 事件，触发 TanStack Query 失效并刷新，用户无需手动刷新页面。

### 4. 架构分层与目录拓扑
Go 后端新增模块拓扑如下：
```text
server/internal/ai/
├── gateway/          # Eino ChatModel 工厂、多渠道配置与路由/降级
├── tools/            # 业务领域原子工具 (Task/Project/Review CRUD)
├── skill/            # Eino DAG 业务工作流 (复盘合成、任务拆解、项目建议)
├── monitor/          # Eino Callback 监控切面 (Token 记账、TTFT、调用日志)
└── mcp/              # MCP Server 协议适配 (stdio & SSE 传输)
```

## Risks / Trade-offs

- **[样式层叠与字体冲突]** → Semi CSS 与 Tailwind 4 的 Preflight 可能在个别基准字体或行高上有微小差异。
  - *缓解措施*：在引入 `semi.css` 时通过 CSS Layer 或仅在 `/ai` 路由及设置弹窗容器下引入局部样式，保障既有视图零污染。
- **[上游供应商超时与流中断]** → 外部大模型 API 网络不稳定可能导致用户界面假死。
  - *缓解措施*：Eino 执行层与 Gin SSE 均绑定 `context.Context`，前端触发“停止生成”或关闭窗口时立刻通知后端取消上游 HTTP 请求，释放连接。
- **[并发写锁与版本冲突]** → 外部 MCP 工具与桌面端用户同时修改同一条笔记或任务可能导致并发覆盖。
  - *缓解措施*：复用现有的乐观并发版本锁（`lock_version`），发生冲突时返回明确的 HTTP/MCP 错误码，阻止脏写并提示重试。

## Migration Plan

1. **数据库迁移脚本**：
   - 增加 `000005_add_ai_module_tables.sql`，创建 `ai_channels`、`ai_skills`、`ai_invocation_logs` 表，提供正向 `-- +goose Up` 与回滚 `-- +goose Down` 脚本。
2. **渐进式演进与向前兼容**：
   - AI 模块完全解耦，未配置 AI 渠道时，系统仅禁用 AI 功能入口，核心任务、习惯、项目与笔记等既有业务完全不受任何影响。
