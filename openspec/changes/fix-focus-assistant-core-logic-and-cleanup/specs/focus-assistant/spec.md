# Capability: Focus Assistant Companion

## ADDED Requirements

### Requirement: Wall-Clock Timer Accuracy
The system SHALL calculate remaining focus and rest time based on absolute timestamps rather than uncalibrated interval decrements.

#### Scenario: System sleep or background throttling
- **GIVEN** 用户正在运行 25 分钟番茄钟
- **WHEN** 电脑休眠或窗口处于后台被节流 10 分钟后恢复
- **THEN** 倒计时秒数 SHALL 立即校准减少 10 分钟
- **AND** 若休眠时长已超过剩余时长，系统 SHALL 自动触发完成流

### Requirement: Global Task Notification Actions
The system SHALL process notification card actions globally regardless of the currently active route in the main window.

#### Scenario: User completes task from notification card
- **GIVEN** 主窗口当前处于「今日看板」或「知识库」页面
- **WHEN** 用户在桌面通知卡片中点击「完成任务」
- **THEN** 主窗口全局接收并持久化将该任务标记为已完成
- **AND** 刷新相关视图缓存

### Requirement: Accurate Focus Statistics
The system SHALL count only focus sessions in daily and weekly statistics, excluding rest sessions.

#### Scenario: User queries focus stats
- **WHEN** 用户查看今日与本周专注时长
- **THEN** 系统仅统计 `type === "focus"` 的有效秒数并换算为分钟
- **AND** 休息会话不计入专注统计

### Requirement: Theme Style Consistency
The system SHALL apply pixel border and retro styling to pixel-dog variants.

#### Scenario: User selects pixel dog theme
- **WHEN** 用户将专注助手切换为「像素小狗」或「像素小狗纯宠物」
- **THEN** 系统正确应用复古像素羊皮纸边框和阴影样式
- **AND** 不降级为现代白色扁平样式

### Requirement: Persistent Sidebar Assistant Entry
The system SHALL provide a persistent summon/hide button for the focus assistant right above the refresh button in the sidebar.

#### Scenario: User clicks sidebar assistant button
- **WHEN** 用户在侧边栏点击专注助手快捷按钮
- **THEN** 系统切换显示或隐藏桌面悬浮专注助手
