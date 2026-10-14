# Proposal: 修复设置模块核心逻辑漏洞与清理优化

## Why

设置模块（Settings & Preferences）是 WorkBuddy-D 桌面应用的基础底座，承载了全局界面主题、任务通知与多屏呈现、开机自启动及账号安全等关键系统偏好。然而深度排查发现当前实现存在严重的功能与架构缺陷：
1. **多 Webview 通知配置事件属于“失效孤岛”**：`preferences.ts` 发射了 `workbuddy:notification-options-change`，但全仓零监听，常驻后台窗口（如悬浮助手、通知窗口）无法实时感知设置变化；
2. **任务提醒音效双重播报（刺耳回音）**：调度器与悬浮助手同时播放合成音频，造成严重的重叠破音体验；
3. **通知选项命名与职责混淆**：`systemTray` 属性实际唤起的是全屏幕多屏 Webview 窗口，与系统原生托盘通知混为一谈；
4. **开机自启动缺乏运行环境探测防御**：在非 Tauri（如 Web 或测试）环境下无条件调用插件导致报错或组件永久 loading；
5. **账号登出仅清除 LocalStorage**：未断开长连接、未清理 Query 缓存且未关闭设置弹窗，存在数据脏读隐患；
6. **Esc 快捷键无条件全局捕获**：在打开子模态框时按下 Esc 会把底层整个设置大弹窗粗暴关闭；
7. **历史包袱与冗余代码**：残留 Supabase `user_metadata` 冗余查找、散落的硬编码颜色、冗余图标及模板 Tab 孤岛式死占位；
8. **操作缺乏即时反馈**：设置变更静默保存，缺乏直观明确的轻量反馈。

本变更旨在全面修复上述 6 项逻辑漏洞、清除 2 项历史包袱与 2 项冗余代码，并增加设置即时反馈提示。

## What Changes

1. **核心逻辑漏洞修复**：
   - 在 `src/lib/preferences.ts` 规范化通知选项类型及跨 Webview 事件广播；
   - 在 `src/features/focus/hooks/useFocusTimer.ts` 等常驻窗口增加对 `workbuddy:notification-options-change` 的实时监听；
   - 确立任务提醒音频的唯一发声归属，在 `useFocusTimer.ts` 收到提醒时去除重复播放的 `playTaskReminderSound`，彻底消除回音重音；
   - 规范化 `systemTray` 命名与注释，并保留向后兼容；
   - 在 `SettingsDialog.tsx` 针对开机自启动增加 `isTauriEnv()` 守卫及降级展示；
   - 在登出时增加 `onClose()` 调用与全局连接清理处理；
   - 优化全局 Escape 键监听，增加 `event.defaultPrevented` 校验。
2. **移除兼容代码与历史包袱**：
   - 移除 `SettingsDialog.tsx` 中的 Supabase `user_metadata` 回退代码，统一使用简洁标准的用户信息提取；
   - 清理硬编码颜色样式魔法值，统一使用主题 Token。
3. **冗余代码与死代码清理**：
   - 清理 `SettingsDialog.tsx` 中未使用的冗余图标导入；
   - 优化模板 Tab 占位与指引，提供友好的操作提示与导航。
4. **即时交互反馈增强**：
   - 在主题切换、通知偏好变更、开机自启开关时，通过 `toast.success` 提供即时操作反馈；自启动切换异常时展示清晰的 `toast.error`。

## Capabilities

### New Capabilities
- `settings-preferences`: 统一管理应用视觉风格、多端通知呈现形式、开机自启动、后台常驻伴侣召唤与账号生命周期，具备跨 Webview 事件同步与环境适配韧性。

### Modified Capabilities
<!-- 无需修改其他已批准 spec -->

## Impact

- **前端核心**：`src/features/settings/components/SettingsDialog.tsx`、`src/lib/preferences.ts`、`src/features/focus/hooks/useFocusTimer.ts`、`src/lib/notifications/notificationService.ts`。
- **构建与测试**：保证 `pnpm build` 与 `go build ./...` 100% 通过。
