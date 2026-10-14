# Proposal: Cleanup Frontend Redundancies and Architecture Refinement

## Why

在完成 `bulletproof-frontend-architecture` 的核心特性切片迁移后，经过系统性探索审计，前端工程中仍存在历史过渡阶段留下的残留垫片、无入口的孤岛死代码、产品更名历史兼容键、无用外部依赖，以及未拆解的超大单体组件 `FocusAssistant.tsx`（2452 行）。

本变更旨在对前端代码库进行深度“瘦身”与架构纯净化：根除架构倒置垫片，清理死代码与无用包，统一多窗口与对话框原语封装，并对 `FocusAssistant` 执行模块化拆解，使代码库彻底契合 Bulletproof React 的高内聚、单向依赖与零冗余标准。

## What Changes

1. **清理架构层过渡兼容垫片 (`src/lib/auth.tsx`)**：
   - 彻底删除 `src/lib/auth.tsx` 转发垫片。
   - 将全仓 11 处直接从 `@/lib/auth` 导入的代码更新为规范的 `@/features/auth`，消除 `shared (lib) → features` 依赖倒置。
2. **物理移除孤岛死代码**：
   - 移除未注册路由且无界面入口的 3 个孤岛页面：`src/pages/PomodoroPage.tsx`、`src/pages/MissionPage.tsx`、`src/pages/WeeklyPlanningPage.tsx`。
   - 移除对应的占位视图组件：`src/features/focus/components/PomodoroView.tsx`、`src/features/time-management/components/MissionView.tsx`、`src/features/time-management/components/WeeklyPlanningView.tsx`。
3. **清理产品更名留存的兼容回退代码**：
   - 清理 `src/stores/uiStore.ts`、`src/lib/offlineSyncQueue.ts`、`src/lib/preferences.ts` 中残留的 `fishbuddy` localStorage 兼容读取逻辑，统一为 `workbuddy` 标准前缀。
4. **移除无用外部依赖**：
   - 从 `package.json` 中移除全仓零引用的 `react-day-picker` 并更新锁文件。
5. **收敛多窗口微型透传层**：
   - 简化 `src/app/windows/QuickEditWindow.tsx` 与 `src/app/windows/NotificationToastWindow.tsx`，消除不必要的双层包裹。
6. **清理类型定义冗余**：
   - 移除 `src/types/index.ts` 中重复导出的 `QuadrantType`。
7. **规范化确认对话框封装与命名**：
   - 规范 `src/components/ui/confirm-dialog.tsx` 与 `ConfirmDeleteDialog.tsx` 的文件命名与导出结构，统一为标准 kebab-case 规范组件。
8. **拆解巨石特性组件 `FocusAssistant.tsx`**：
   - 将 2452 行的 `FocusAssistant.tsx` 拆分为：
     - `FocusPetDisplay`（像素/向量宠物呈现与气泡）
     - `FocusTimerControls`（计时控制与主控栏）
     - `FocusTargetModal`（关联项目/任务/习惯选择器）
     - `FocusTimeModal`（专注/休息时长配置弹窗）
     - `FocusStyleMenu`（主题皮肤与宠物切换菜单）
     - `useFocusAssistantTimer`（计时器与状态管理 Hook）

## Capabilities

### New Capabilities
- None (本变更为纯工程整洁度与架构防腐重构，不增加新的产品级行为契约)。

### Modified Capabilities
- None (产品既有功能与业务逻辑保持不变；已在 `.openspec.yaml` 声明 `skip_specs: true`)。

## Impact

- **Affected Code**: `src/lib/`、`src/pages/`、`src/features/focus/`、`src/features/time-management/`、`src/components/ui/`、`package.json`。
- **Dependencies**: 移除 `react-day-picker`。
- **Desktop Host**: 多窗口构建和 Tauri 桌面运行保持 100% 兼容。
