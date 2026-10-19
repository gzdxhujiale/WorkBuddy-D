# Tasks: Refine AI Chat Experience, Inline Thinking & Card Input Box

## 1. Session State Fix & Lifecycle Guard

- [x] 1.1 修复 `AIWorkspace.tsx` 中的会话同步 Effect，移除误杀本地消息的 `if (!currentSessionId) setChats([])`，确立本地优先状态保护
- [x] 1.2 增强 `activeSessionIdRef` 隔离，仅在主动切换不同历史会话时重载 messages，杜绝流式期间聊天列表归零

## 2. Inline Thinking UX Overhaul (Match Image 1 & 2)

- [x] 2.1 重构 `AIThinkingBlock.tsx` 为无边框内联折叠流，支持思考中态 `Thinking for {time}s ˅` 并实时打出浅灰文本
- [x] 2.2 实现思考完成态自动平滑收缩为单行 `Thought for {time}s ›`，支持随时点击重开查看与复制，无缝挂载正文渲染

## 3. All-in-One Floating Card Input Box

- [x] 3.1 在卡片左上角实现 `[✨]` 模式/技能微徽标，支持轻量 Dropdown 快捷选择专属 Skill
- [x] 3.2 替换自适应无边框输入域，支持中文输入法合成保护与 Enter 发送 / Shift+Enter 换行
- [x] 3.3 构建底部左侧模型文字胶囊（`[Channel] Model ▾`）与右侧 `⚡ MCP` 开关、纯蓝正圆发送键 `➔`（生成中切为中断方块）

## 4. Verification & Polish

- [x] 4.1 执行前端 `pnpm build` 与 `pnpm lint:boundaries`，确保编译构建全绿
- [x] 4.2 运行全流程真实验证：发送首条消息即时回显、思考实时计时展开、完成后收缩单行正文流出
