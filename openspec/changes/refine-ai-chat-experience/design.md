# Design: Refine AI Chat Experience, Inline Thinking & Card Input Box

## Context

见 `proposal.md`。当前 AI 模块使用 Semi Design 的 `Chat` 组件作为右侧对话主界面，Go 独立后端通过 SSE（`text/event-stream`）输出模型生成块。
在此前的使用中暴露出 3 个关键设计与交互问题：
1. **状态竞争与消息清空缺陷**：在新建会话发出首条消息时，`useEffect` 中的 `if (!currentSessionId) setChats([])` 误清空了本地 `newChats`，导致视区变为空白且流式中断；
2. **思考组件过于厚重**：带有蓝色边框与折叠卡片，未能达到 Antigravity / Claude Code 那样纯净轻量的内联打字美学（思考中 `Thinking for Xs ˅`，完成后收缩为 `Thought for Xs ›`）；
3. **输入框形态陈旧**：分层工具栏增加视窗冗余，需重构为现代一体化全包围悬浮卡片。

## Goals / Non-Goals

**Goals:**
- 实现本地优先的健壮状态机，彻底消除消息发送即消失的 Bug；
- 重构 `AIThinkingBlock`，实现图一（无框内联打字 + 计时）与图二（单行极简折叠）的完全复刻；
- 升级输入框为现代化一体化悬浮卡片（左上模式徽标、中间无边框自适应输入域、底部模型胶囊 + 正圆发送键）；
- 保证前后端全栈编译、构建与规范校验 100% 全绿。

**Non-Goals:**
- 不修改数据库实体表结构；
- 不破坏现有 WebSocket 增量同步逻辑。

## Decisions

### 1. 本地优先与会话 Effect 状态守护
- **决策**：
  - 维护 `activeSessionIdRef` 记录当前屏幕所展示的会话 ID；
  - 只要 `isStreaming` 为 true 或本地 `chats.length > 0` 且处于当前会话流转中，Effect 绝对禁止重置或覆盖 `chats`；
  - 仅当用户在侧边栏主动点击切换到另外一个 `sessionId` 时，才执行服务端历史消息映射。

### 2. 深度思考内联折叠组件设计（`AIThinkingBlock`）
- **决策**：
  - 抛弃外层卡片与边框，采用极简内联排版：
    - **Header**：微灰小字按钮（`text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 flex items-center gap-1`）；
      - 思考中：文案为 `Thinking for {time}s`，图标为下箭头 `˅`；
      - 思考完成：文案为 `Thought for {totalTime}s`，图标为向右小箭头 `›`；
    - **Body**：当展开时，以浅灰单倍行距呈现 Markdown/纯文本流（`text-xs leading-relaxed text-gray-500 dark:text-gray-400 pl-1`）；
    - **自动化过渡**：生成中默认展开并动态计时，正文到达时平滑收起为单行，用户点击可随时重新展开并支持复制。

### 3. 一体化全包围卡片式输入框（`renderInputArea`）
- **决策**：
  - 容器：大圆角（`rounded-2xl`）、细腻微边框（`border border-gray-200 dark:border-gray-800`）、柔和投影与聚焦光晕；
  - 布局：
    - **Top**：左上角放置 `size-7 rounded-lg` 的模式微徽标 `[✨]`，点击弹出技能选择浮层；
    - **Middle**：自适应高度无边框 TextArea，背景透明，支持 Enter 发送与 Shift+Enter 换行；
    - **Bottom**：
      - 左侧：极简 `＋` 上下文按钮与 `[Channel] Model ▾` 幽灵文字胶囊，点击轻量 Dropdown 切换模型；
      - 右侧：`⚡ MCP` 工具开关与 `size-8 rounded-full` 纯蓝正圆发送键 `➔`（生成中为红色中断方块）。

## Risks / Trade-offs

- **[输入法合成阶段回车误触]** → TextArea 监听 `onCompositionStart` 与 `onCompositionEnd`，确保中文输入法选词回车不触发提交流程。
- **[短时间内连续切换会话]** → 切换前中止正在进行的 AbortController，并同步重置流式状态，杜绝交叉污染。
