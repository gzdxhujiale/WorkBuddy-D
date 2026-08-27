## Why

在全站任务体系中，独立待办与项目任务在底层共用同一数据表结构，但此前的全局快捷编辑浮层 `TaskQuickEdit` 缺少项目与阶段的选择入口。这导致用户在今日工作台或时间管理界面编辑或快速创建任务时，无法直接指定或变更所属项目与阶段，破坏了「统一任务入口」的工作流。

## What Changes

- 在 `TaskQuickEditPopover` 顶栏新增项目/阶段选择器按钮，位置固定在象限/优先级旗标选择器的左侧。
- 点击该按钮弹出层级下拉菜单，支持快速选择「无项目 (独立待办)」或特定项目，并在选定项目后可选具体阶段（Stage）。
- 升级 Tauri IPC 通信载荷（`tqe:init`、`tqe:commit`、`tqe:create`），通过主窗口将活跃项目与阶段数据同步注入独立弹窗，并可靠回传 `projectId` 与 `projectStageId`。
- 保证新选择器在「现代极简」与「复古像素 8-Bit」双主题下的视觉一致性与键盘可访问性（Escape 退出、Enter 提交）。

## Capabilities

### New Capabilities
- `task-quick-edit`: 全局任务快捷编辑能力，支持就地配置任务标题、富文本描述、排期/提醒、所属象限优先级以及所属项目与阶段关联。

### Modified Capabilities
<!-- 无现有主规约需求变更 -->

## Impact

- 受影响组件：[src/components/time-management/TaskQuickEdit.tsx](file:///c:/Users/Admin/Documents/WorkBuddy-D/src/components/time-management/TaskQuickEdit.tsx)
- 受影响服务：[src/services/quickEditWindow.ts](file:///c:/Users/Admin/Documents/WorkBuddy-D/src/services/quickEditWindow.ts)
- 调用方协同：`TodayPanel.tsx`、`TimeManagementPanel.tsx`、`ProjectTimeline.tsx` 等调用 `openTaskQuickEdit` 的业务组件。
- 零破坏性变更，保持对已有任务数据 100% 向后兼容。
