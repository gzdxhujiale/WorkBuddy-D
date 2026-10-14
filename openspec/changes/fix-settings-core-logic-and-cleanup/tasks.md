# Tasks: 实施设置模块核心逻辑修复与规范化

- [x] 1. 修复核心逻辑漏洞
  - [x] 1.1 在 `src/features/focus/hooks/useFocusTimer.ts` 接入 `workbuddy:notification-options-change` 事件监听，动态同步通知选项
  - [x] 1.2 修复任务到期音频回音 Bug：在 `useFocusTimer.ts` 收到提醒时移除重复的 `playTaskReminderSound` 调用
  - [x] 1.3 规范化 `src/lib/preferences.ts` 中 `NotificationDisplayOptions` 类型与注释，统一指代清晰
  - [x] 1.4 在 `SettingsDialog.tsx` 增加 `isTauriEnv()` 守卫，优化自启动非桌面环境下的安全降级
  - [x] 1.5 完善登出逻辑：在 `SettingsDialog.tsx` 执行退出后自动调用 `onClose()` 并重置状态
  - [x] 1.6 优化 Esc 键全局事件监听，增加 `event.defaultPrevented` 判断
- [x] 2. 移除兼容代码与历史包袱
  - [x] 2.1 移除 `SettingsDialog.tsx` 中对 Supabase 遗存的 `user_metadata` 回退代码
  - [x] 2.2 规范化主题类名与像素风格视觉 Token
- [x] 3. 冗余代码与死代码清理
  - [x] 3.1 清理 `SettingsDialog.tsx` 未使用的多余图标导入
  - [x] 3.2 优化模板 Tab 的空分支指引与提示
- [x] 4. 增加设置修改即时反馈
  - [x] 4.1 引入 `toast` 组件，为主题切换、通知偏好、开机自启、悬浮助手启动等操作添加轻量 Toast 提示
- [x] 5. 验证与回归
  - [x] 5.1 运行 `pnpm build` 确认前端类型与构建零错误
  - [x] 5.2 运行 `cargo check` 确认 Tauri 桌面端检查零错误
