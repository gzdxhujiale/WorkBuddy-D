# Design: 专注助手逻辑加固与架构治理

## Context

桌面悬浮伴侣属于长周期运行、且频繁在屏幕顶层与后台之间切换的轻量 Webview 窗口。它需要高度依赖准确的物理时钟，并与主窗口（Main Webview）及通知悬浮窗保持精准的松耦合 IPC 通信。

## Key Architectural Decisions

### 1. 绝对时间锚点（Absolute Wall-clock Calibration）
- **问题**：`setInterval` 每次递减 1 秒，电脑休眠 20 分钟后定时器仅走了几秒。
- **方案**：维护 `targetEndTime = Date.now() + remainingSec * 1000`。
  - 倒计时循环中：`remaining = Math.max(0, Math.round((targetEndTime - Date.now()) / 1000))`；
  - 暂停时：记录剩余时长并清空 `targetEndTime`；
  - 恢复时：重新锚定 `targetEndTime = Date.now() + remaining * 1000`；
  - 监听 `visibilitychange` 与 `window.focus`，恢复可见时立即触发一次同步校准。

### 2. 全局通知卡片交互事件监听归宿
- **问题**：原监听器注册在四象限组件中，导致切出四象限时丢失桌面卡片的点击操作。
- **方案**：将 `workbuddy:complete-task-action` 与 `workbuddy:navigate-to-task` 的监听迁移至主应用全局上下文（`AppLayout.tsx` 或根路由）。
  - 当收到完成任务事件：调用统一的 `taskApi.updateTask(id, { completed: true })` 并通知 TanStack Query 刷新数据与缓存；
  - 当收到查看任务事件：激活主窗口并聚焦对应任务。

### 3. 专注统计净值化
- **方案**：在 `focusAssistantApi.getFocusStats` 遍历会话时，严格校验 `session.type === "focus"`，排除 `rest` 休息与异常废弃数据。

### 4. 侧边栏常驻入口
- **方案**：在 `AppLayout.tsx` 侧边栏底部，将“专注助手”按钮布局在“刷新数据”按钮上方，统一样式与 Tooltip，实现全局随手召唤。
