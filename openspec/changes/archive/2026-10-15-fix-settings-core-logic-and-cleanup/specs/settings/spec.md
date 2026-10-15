# Capability: Settings & Preferences

## ADDED Requirements

### Requirement: Theme Style Switching
The system SHALL allow users to freely switch between the modern minimalist style (`default`) and the retro pixel style (`retro-pixel`), and immediately synchronize this across all open Webview windows.

#### Scenario: User switches theme style
- **WHEN** 用户点击复古像素风卡片
- **THEN** 系统更新 `workbuddy.appThemeStyle`
- **AND** 给 `document.documentElement` 挂载 `theme-retro-pixel` 类名与 `dataset.themeStyle`
- **AND** 广播 `workbuddy:theme-style-change` 事件
- **AND** 弹出即时 Toast 提示已成功切换主题风格

### Requirement: Notification Display Options
The system SHALL provide flexible configuration of desktop notification formats (center HUD card, desktop companion bubble, multi-monitor bottom-right toast).

#### Scenario: User updates notification preference
- **WHEN** 用户勾选或取消勾选任意一项通知传讯形式
- **THEN** 系统写入持久化存储
- **AND** 广播 `workbuddy:notification-options-change`
- **AND** 常驻悬浮助手等 Webview 接收事件并动态更新响应策略
- **AND** 弹出 Toast 提示配置已更新

### Requirement: Autostart Graceful Degradation
The system SHALL enable or disable autostart in desktop environments and gracefully degrade in non-desktop environments.

#### Scenario: Running in non-Tauri environment
- **GIVEN** 应用运行在普通浏览器端
- **WHEN** 打开通用设置面板
- **THEN** 自启动开关处于禁用状态
- **AND** 展示“仅桌面客户端支持”提示
- **AND** 控制台不抛出任何未捕获的 IPC 异常

### Requirement: Safe Sign Out Lifecycle
The system SHALL safely clear local auth state, reset connections, and close the dialog upon signing out.

#### Scenario: User signs out
- **WHEN** 用户点击确认解除契约（退出登录）
- **THEN** 系统清除认证持久化存储
- **AND** 触发登出事件
- **AND** 设置弹窗自动关闭
