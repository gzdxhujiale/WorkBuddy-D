# Proposal: Refine AI Chat Experience, Inline Thinking UX and Card Input Box

## Why

在 WorkBuddy AI 工作台日常使用中，用户面临四个核心体验障碍：
1. 视觉冗余：默认展示双方圆形头像和昵称，垂直空间被挤占且层级不够聚焦；
2. 初始界面嘈杂：每次新建会话时强行弹出大段欢迎卡片与 3 个固定 Prompt 推荐按钮，干扰纯净专注的工作流；
3. 会话状态与消息误冲刷缺陷：前端在发送首条消息时，由于会话异步建立时序，导致本地消息被盲目清空回退为空态，流式增量全部失效；
4. 深度思考与输入框形态粗糙：思考过程缺乏 Antigravity / Claude Code 那样精致的内联折叠体验（思考时展开打字 `Thinking for Xs ˅`，完成后收缩为单行 `Thought for Xs ›`），且输入框仍采用生硬的分层工具条，缺乏一体化卡片的美感与操作效率。

本变更旨在全面重构 AI 对话视觉、内联思考折叠与悬浮卡片输入框，打造媲美现代顶尖 AI 客户端（Antigravity / Cursor）的极简、沉浸、实时打字体验。

## What Changes

- **修复消息生命周期与时序竞争缺陷**：重构会话同步 Effect，确立本地消息最高权威，流式期间绝对禁止重置 chats，保障首条消息发送即稳定呈现；
- **重构深度思考内联折叠（对齐图一与图二）**：
  - 思考中态（In-Progress）：内联展开，展示 `Thinking for {time}s ˅` 动态计时与浅灰打字流；
  - 思考完成态（Completed）：自动收缩为一行内联极简文字 `Thought for {totalTime}s ›`，点击可随时再次展开查看原文或复制；下方无缝挂载正文打字输出；
- **全包围一体化卡片式输入框（参考截图）**：
  - 左上角：`[✨]` 专项技能微徽标，点击呼出 Popover 切换复盘/拆解/规划/通用技能；
  - 中间区：自适应无边框输入域，支持 Enter 发送与 Shift+Enter 换行；
  - 底部左侧：极简加号 `＋` 与模型文字胶囊（如 `[Channel] Model ▾`），点击浮层切换渠道与模型；
  - 底部右侧：`⚡ MCP` 工具开关与纯蓝正圆形发送键 `➔`（生成中变为红色停止方块）；
- **用户消息圆角卡片化包裹与 AI 自然流排版**：用户消息采用 `rounded-2xl` 浅灰圆角卡片包裹，AI 消息纯流排版，彻底隐藏双方头像与昵称；
- **彻底移除初始化欢迎与提示词列表**：新建会话保持纯净空白。

## Capabilities

### New Capabilities
- `ai-assistant`: 涵盖 WorkBuddy AI 助手工作台的无头极简消息排版、内联深度思考打字折叠、全包围悬浮卡片输入框，以及本地优先的健壮会话流式状态流转。

### Modified Capabilities
*(无已归档能力规格变更)*

## Impact

- **前端**：`src/features/ai/components/AIWorkspace.tsx`、`src/features/ai/components/AIThinkingBlock.tsx`、`src/features/ai/api/aiApi.ts`；
- **后端**：`server/internal/handler/ai_handler.go`；
- **API 契约**：`/api/v1/ai/chat` 的 SSE 事件 `event: thinking` 格式更加健壮标准化。
