# Design: 设置模块核心逻辑修复与规范化

## Context

WorkBuddy-D 作为多 Webview 架构应用，主窗口、专注助手悬浮窗（`focus-assistant`）以及通知悬浮窗（`notification-toast`）共享 LocalStorage，但各自处于独立的 Webview 运行上下文中。配置的变更需要通过可靠的 IPC 事件广播和响应式机制驱动各窗口的实时响应。

## Architecture & Decisions

### 1. 跨 Webview 通知选项事件同步
- **设计**：在 `src/lib/preferences.ts` 中维护 `NotificationDisplayOptions` 的 LocalStorage 读写；在写入时派发 `window.dispatchEvent` 并通过 Tauri `emit("workbuddy:notification-options-change", next)` 广播至所有窗口。
- **监听端**：在 `useFocusTimer.ts` 等常驻悬浮伴侣 Hook 中，通过 Tauri `listen` 监听该事件，动态同步内部 `assistantBubble` 等通知配置，无需依赖被动轮询。

### 2. 任务到期提醒音效单点归属
- **现状分析**：`taskReminderScheduler.ts` 在触发任务提醒时先调用 `playTaskReminderSound()`，紧接着发射 `workbuddy:task-reminder` 事件给悬浮助手；悬浮助手在处理该事件时又再次调用 `playTaskReminderSound()`。两个 Webview 在同一微秒内发声，导致刺耳回音。
- **决策**：由调度核心 `taskReminderScheduler.ts` 统一拥有播放任务提醒音效的单一职责；悬浮助手专注处理伴侣动作（发光、敲击）与趣味对话气泡，移除重复的播放调用。

### 3. 开机自启动安全降级
- **设计**：通过 `isTauriEnv()` 进行运行时环境探测。在非桌面 Webview（例如浏览器端开发或测试）环境中：
  - `autostartLoading` 直接结束；
  - `autostartEnabled` 置为 `false`；
  - 界面显示提示文案：“仅桌面客户端支持开机自启”，开关处于禁用状态；
  - 阻止任何向 Tauri autostart 插件的非法 IPC 调用。

### 4. 账号登出闭环
- **设计**：
  - `signOut()` 执行 `authService.logout()`；
  - 登出后立即调用 `onClose()` 关闭设置对话框；
  - 派发系统级登出事件，确保任何长连接与临时缓存得到妥善重置。

### 5. Esc 键安全冒泡
- **设计**：在全局键盘事件中增加 `if (event.defaultPrevented) return;` 保护，并在关闭前阻止冒泡，避免与内层弹窗产生冲突。

### 6. 即时交互反馈
- **设计**：引入统一的轻量级 `toast` 通知（`toast.success` / `toast.error`），当用户切换主题风格、变更通知选项或切换开关时，给出即时的视觉反馈。
