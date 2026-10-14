# Design: Cleanup Frontend Redundancies and Architecture Refinement

## Context

在 `bulletproof-frontend-architecture` 完成后，代码库已具备清晰的垂直 Feature 结构和 ESLint 边界守卫。但在探查（Explore）中发现，工程中仍存在历史遗留的过渡转发垫片、无路由孤岛视图、双重对话框命名不一致、已废弃外部依赖、更名前的历史本地存储兼容代码，以及全仓唯一未拆解的千行巨石组件 `FocusAssistant.tsx`。

详见 `proposal.md`。

## Goals / Non-Goals

**Goals:**
- **消除依赖倒置**：删除 `src/lib/auth.tsx`，统一使用 `@/features/auth`，确保 `shared → features → app` 单向流向。
- **清除死代码与死依赖**：物理删除未在路由和界面接入的 3 个孤岛页面及占位组件；从 `package.json` 卸载零引用的 `react-day-picker`。
- **净化历史兼容**：清理对 `fishbuddy` 的兼容逻辑，统一使用 `workbuddy` 标准前缀。
- **规范 UI 原语**：规范确认对话框文件命名与导出，收敛多窗口微透传。
- **拆解巨石特性单体**：将 2452 行的 `FocusAssistant.tsx` 拆解为容器层、子组件与专属 Hook，单文件规模降至合理可维护区间。

**Non-Goals:**
- 不修改专注助手现有的宠物逻辑、计时器逻辑、音效反馈或 Tauri 窗口拖拽行为。
- 不修改数据库架构、RPC 或已有已发布产品契约。

## Decisions

### 1. 认证依赖流纠偏（Auth Flow Direction）
- **决策**：删除 `src/lib/auth.tsx`，将全仓 11 个引用文件批量迁移至 `@/features/auth`。
- **理由**：`src/lib/` 是共享底层，不应反向引用上层 `src/features/auth`；直接使用 `@/features/auth` 完全符合 Bulletproof React 规范，且 `auth` 作为基础特性在全局 `App.tsx` 和领域 Hook 中直接使用完全合规。

### 2. 物理清除孤岛视图（Dead Views Removal）
- **决策**：物理删除 `src/pages/PomodoroPage.tsx`、`MissionPage.tsx`、`WeeklyPlanningPage.tsx` 以及对应的 3 个 View 组件。
- **理由**：这 3 组页面属于历史早期的静态占位稿，未在 TanStack Router 中注册路由，导航栏与应用内均无入口。物理移除可减少无效打包体积与概念干扰。若未来需要重做番茄钟或周计划，将在明确需求后按规范重新建立。

### 3. 本地存储前缀归一（LocalStorage Key Normalization）
- **决策**：在 `uiStore.ts`、`offlineSyncQueue.ts`、`preferences.ts` 中移除对 `fishbuddy` 的读取回退，仅保留 `workbuddy` 标准 key。
- **理由**：产品更名阶段已结束，保留过时回退增加分支复杂度与潜在脏数据风险。

### 4. 依赖与类型定义净化
- **决策**：
  - 从 `package.json` 卸载 `react-day-picker`。
  - 修复 `src/types/index.ts` 中重复的 `export type { QuadrantType }`。

### 5. 对话框原语规范化与多窗口微透传收敛
- **决策**：
  - 将 `src/components/ui/ConfirmDeleteDialog.tsx` 合并入 `src/components/ui/confirm-dialog.tsx`，统一导出 `ConfirmDialog` 与 `useConfirmDialog`，遵循 kebab-case 规范，并更新相关引用。
  - 简化 `src/app/windows/QuickEditWindow.tsx` 与 `NotificationToastWindow.tsx`。

### 6. 巨石组件 `FocusAssistant.tsx` 模块化拆解
- **架构拆分方案**：
  - `src/features/focus/hooks/useFocusTimer.ts`：封装倒计时状态机、开始/暂停/恢复、音效反馈、后台完成通知与 Tauri 交互。
  - `src/features/focus/components/assistant/FocusPetDisplay.tsx`：封装像素小狗、像素小猫、柴犬等宠物形象渲染、对白气泡及抚摸触发。
  - `src/features/focus/components/assistant/FocusTimerControls.tsx`：封装精简模式/卡片模式下的主计时面板与播放/暂停控制按钮。
  - `src/features/focus/components/assistant/FocusTargetModal.tsx`：封装关联项目/任务/习惯的弹出选择面板。
  - `src/features/focus/components/assistant/FocusTimeModal.tsx`：封装专注时长与休息时长的修改弹窗。
  - `src/features/focus/components/assistant/FocusStyleMenu.tsx`：封装皮肤风格、纯净模式与常规菜单。
  - `src/features/focus/components/FocusAssistant.tsx`：作为纯装配容器，管理窗口定位与子组件状态联动，行数控制在 250 行以内。

## Risks / Trade-offs

- **[Risk 1: `useAuth` 路径批量替换遗漏导致编译报错]**
  → *缓解措施*：全局检索并统一替换为 `@/features/auth`，执行 `pnpm build` 与 `pnpm lint:boundaries` 验证。
- **[Risk 2: `FocusAssistant` 拆分导致计时器或窗口拖拽状态断裂]**
  → *缓解措施*：保持原有的 `useRef` 同步机制与 Tauri 窗口拖拽逻辑完整迁移至 Hook 与展示组件，严格验证编译产物。
- **[Risk 3: `ConfirmDeleteDialog` 重构影响使用点]**
  → *缓解措施*：`ProjectsPage` 与 `ProjectTemplateManager` 等消费端平滑切换至新导出路径。

## Migration Plan

1. **Step 1**: 认证依赖流纠偏（删除 `src/lib/auth.tsx`，更新全部 11 处引用）。
2. **Step 2**: 清除孤岛死代码与历史回退代码（删除 6 个死代码文件，清理 3 个文件中的 `fishbuddy` 回退）。
3. **Step 3**: 清理无用依赖与类型冗余（卸载 `react-day-picker`，精简 `src/types/index.ts`）。
4. **Step 4**: 规范确认对话框与多窗口透传。
5. **Step 5**: 模块化拆解 `FocusAssistant.tsx`。
6. **Step 6**: 端到端全量门禁检查（`pnpm build`、`pnpm lint:boundaries`、`ai-harness validate`）。
