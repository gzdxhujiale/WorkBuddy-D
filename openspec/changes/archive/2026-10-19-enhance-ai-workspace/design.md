# Design

## Context

当前 WorkBuddy-D 已具备模型统一网关、动态降级调度与 MCP 开放能力，但前端聊天工作台尚为单会话无状态模式，且流式仅传递纯文本正文。随着 DeepSeek-R1、Claude 3.7、o3-mini 等推理模型普及，用户强烈需要直观看到思维链推导逻辑、工具调用过程，并能够在左侧回溯管理过往的会话记录。

## Goals / Non-Goals

**Goals:**
- **双栏工作台体系**：左侧提供可折叠的会话历史侧边栏（新建、分组、检索、重命名、置顶、删除），右侧为主对话界面。
- **思考链深度透视**：解析流式推理内容，实时渲染思考过程，思考完毕后自动折叠为展示总耗时的摘要标签，支持用户手动展开。
- **工具调用卡片化**：结构化展示 Tool Calls 执行状态（Pending / Running / Success / Error）、入参简报及耗时。
- **输入框内嵌控制胶囊**：在输入框内底部工具栏集成当前渠道与模型选择下拉、思考模式开关及上下文引用（@）。
- **Semi MarkdownRender 富文本**：全量采用 Semi Design 官方 `MarkdownRender`，提供代码高亮、一键复制、数学公式排版与表格展示。
- **持久化与事件驱动 SSE**：在 Neon PostgreSQL 建立 `ai_sessions` 与 `ai_messages` 表，升级 Go 后端 SSE 协议为标准事件流。

**Non-Goals:**
- 多模态音视频与图片本地生图（后续独立变更推进）。
- 在桌面端内嵌本地大模型推理引擎（统一通过网关代理 Ollama / 远程模型）。

## Decisions

### 1. 采用 Semi Design 官方生态组合装配

- **选择**：`Layout.Sider` + `Chat` + `renderInputArea` + `Collapse` + `MarkdownRender`。
- **原因**：充分复用已引入的 `@douyinfe/semi-ui` 体系，保障与当前应用界面的统一视觉基调（暗色模式自适应、Token 变量契约），避免从头手写复杂的基础组件。
- **替代方案**：
  - *纯手写双栏与虚拟列表*：开发维护成本极高，滚动交互与边界处理繁琐。

### 2. 结构化事件驱动 SSE 协议（Event-Driven Stream）

- **选择**：后端流式输出标准 SSE 事件：
  - `event: session`（回传当前会话 ID）
  - `event: thinking`（流式推送推理思维链）
  - `event: tool_call` / `event: tool_result`（推送工具调用生命周期与结果摘要）
  - `event: content`（正式 Markdown 正文）
  - `event: done`（结束信号与 Token 统计）
- **双轨推理捕获**：针对部分网关通过独立字段（`reasoning_content`）返回、部分模型通过正文 `<think>...</think>` 输出的差异，后端流式层做统一归一化适配，均转换为 `event: thinking` 分发给前端。
- **替代方案**：
  - *纯客户端正则表达式截取 `<think>`*：流式过程中标签未闭合时易引起文本跳动或错乱，且无法传递工具调用生命周期。

### 3. 会话与消息在 Neon PostgreSQL 持久化

- **选择**：新增 `ai_sessions`（会话元数据）与 `ai_messages`（消息历史、思考内容、工具调用 JSONB）。
- **原因**：WorkBuddy-D 全站以 PostgreSQL 为单一事实源，采用服务端持久化可确保桌面多 Webview 窗口（主窗口、悬浮伴侣等）通过既有 `useQuery` / WebSocket 保持实时同步，同时天然具备数据安全备份能力。
- **替代方案**：
  - *纯前端 localStorage / IndexedDB*：跨窗口通信复杂，清理缓存易丢失宝贵知识沉淀。

## Risks / Trade-offs

- **[高吞吐模型流式渲染掉帧]** → 缓解措施：前端引入双缓冲帧队列与 `requestAnimationFrame`，限制 React 状态最高更新频次为 30ms 一次，保证在 100+ tokens/s 下依然保持 60fps 丝滑渲染。
- **[长历史会话上下文超长]** → 缓解措施：发送给后端的对话历史默认限制为最近 10 轮消息，并自动携带关联 Skill 预设，避免超出模型上下文窗口。
- **[网络意外中断导致会话悬挂]** → 缓解措施：后端 `ai_messages` 在流式全部接收完毕后或客户端 CancelContext 触发时做优雅落库，保证已生成内容不丢失。

## Migration Plan

- 新增 Goose 迁移文件 `000006_add_ai_sessions_and_messages.sql`，后端服务启动时自动平滑应用。
- 兼容性：若前端请求未携带 `session_id`，后端自动生成并初始化新会话，老接口调用保持 100% 向后兼容。
