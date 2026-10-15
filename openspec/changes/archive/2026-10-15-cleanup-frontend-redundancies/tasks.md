# Tasks: Cleanup Frontend Redundancies and Architecture Refinement

## 1. 认证依赖流纠偏与垫片清理

- [x] 1.1 将全仓 11 处 `@/lib/auth` 引用统一重构为直接导入 `@/features/auth`，确保符合单向依赖流
- [x] 1.2 物理删除 `src/lib/auth.tsx` 过渡转发垫片文件，验证 `pnpm build` 确认无断裂引用

## 2. 孤岛死代码与历史回退代码物理清除

- [x] 2.1 物理删除未在路由注册且无界面入口的孤岛文件（`src/pages/PomodoroPage.tsx`、`MissionPage.tsx`、`WeeklyPlanningPage.tsx`）及对应占位组件（`PomodoroView.tsx`、`MissionView.tsx`、`WeeklyPlanningView.tsx`）
- [x] 2.2 清理 `src/stores/uiStore.ts`、`src/lib/offlineSyncQueue.ts`、`src/lib/preferences.ts` 中残留的历史更名 `fishbuddy` 兼容读取逻辑，统一规范为 `workbuddy` 标准前缀

## 3. 依赖、类型与组件原语清理

- [x] 3.1 从 `package.json` 卸载全仓零引用的外部依赖 `react-day-picker`，执行 `pnpm install` 更新锁文件
- [x] 3.2 清理 `src/types/index.ts` 中重复的 `export type { QuadrantType }`，验证全局类型推导无误
- [x] 3.3 规范化确认对话框原语：将 `ConfirmDeleteDialog.tsx` 整合入 `src/components/ui/confirm-dialog.tsx`，统一导出 `ConfirmDialog` 与 `useConfirmDialog`，移除旧文件并更新调用方
- [x] 3.4 简化收敛多窗口透传组件 `src/app/windows/QuickEditWindow.tsx` 与 `NotificationToastWindow.tsx`

## 4. 巨石特性组件 FocusAssistant.tsx 关注点分离拆解

- [x] 4.1 提取计时器状态、通知与音效 Hook 至 `src/features/focus/hooks/useFocusTimer.ts`
- [x] 4.2 提取宠物展示组件至 `src/features/focus/components/assistant/FocusPetDisplay.tsx`
- [x] 4.3 提取计时与主状态控制条至 `src/features/focus/components/assistant/FocusTimerControls.tsx`
- [x] 4.4 提取目标选择器模态窗至 `src/features/focus/components/assistant/FocusTargetModal.tsx`
- [x] 4.5 提取时长配置弹窗至 `src/features/focus/components/assistant/FocusTimeModal.tsx`
- [x] 4.6 提取外观皮肤与风格菜单至 `src/features/focus/components/assistant/FocusStyleMenu.tsx`
- [x] 4.7 重构 `src/features/focus/components/FocusAssistant.tsx` 为精简装配容器（控制在 300 行以内），保留原有窗口几何逻辑与事件通道

## 5. 端到端门禁验证与规范检查

- [x] 5.1 运行 `pnpm lint:boundaries` 确认架构单向依赖与特性隔离 100% 合规
- [x] 5.2 运行 `pnpm build` 确认 4 个桌面 Webview 窗口产物打包成功，TypeScript 零错误
- [x] 5.3 运行 `ai-harness validate --json` 验证全部受管文档一致性
