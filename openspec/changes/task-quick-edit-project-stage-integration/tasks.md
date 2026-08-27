# Tasks: 全局 TaskQuickEdit 项目与阶段选择器集成

## 1. IPC 通信与数据载荷升级

- [x] 1.1 在 `src/services/quickEditWindow.ts` 中升级 `QuickEditWindowOptions` 与 `tqe:init` 载荷类型，支持自动注入当前活跃的 `projects` 与 `stages` 列表。
- [x] 1.2 在 `src/components/time-management/TaskQuickEdit.tsx` 中更新 `TaskQuickEditWindow` 与 `TaskQuickEditPopoverProps`，接收并传递 `projects` 与 `stages`。

## 2. 项目与阶段选择器 UI 及交互开发

- [x] 2.1 在 `TaskQuickEditPopover` 顶栏增加项目/阶段触发按钮，放置在象限/优先级旗标按钮的左侧，支持展示已关联项目及阶段信息。
- [x] 2.2 实现项目与阶段级联下拉浮层，支持选择「不关联项目 (独立待办)」、切换所属项目并强制指定特定项目阶段。
- [x] 2.3 适配双主题（现代极简与复古像素 8-Bit）风格，支持点击外部及 Escape 键自动关闭子浮层。

## 3. 提交持久化与调用方协同

- [x] 3.1 确保在 `handleClose` / `onCommit` / `onCreate` 中将最新的 `projectId` 与 `projectStageId` 作为变更载荷准确回传。
- [x] 3.2 检查全站调用点（`TodayPanel.tsx`、`TimeManagementPanel.tsx`、`ProjectTimeline.tsx` 等），确保传入必要的项目快照。

## 4. 全量验证与构建验收

- [x] 4.1 运行 `pnpm build` 确认 TypeScript 类型检查零错误且前端打包成功。
- [x] 4.2 验证在 TaskQuickEdit 中修改项目/阶段能即时生效并持久化至 Supabase。
