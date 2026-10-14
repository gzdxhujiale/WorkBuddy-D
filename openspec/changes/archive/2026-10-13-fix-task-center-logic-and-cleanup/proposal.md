# Proposal: Fix Task Center Logic and Cleanup Redundancies

## Why

在任务中心（四象限与时间管理）模块中存在多个关键逻辑漏洞：卡片拖拽重排在后端因请求体验证失败而静默丢失、提醒在保存时被后端忽略或清空、已完成的历史任务被错误归入“一天内”分组、新建任务忽略了视图传递的指定日期、日视图硬编码工时导致非工时任务隐形，且“日视图”与现有的“当日待办 (TodayPage)”功能高度重叠。修复这些漏洞并移除冗余的日视图，可确保任务中心数据一致性、交互清晰度及视图职责单一。

## What Changes

- **后端任务重排与提醒持久化**：
  - 放宽后端 `PUT /api/v1/tasks/:id` 的 `title` 必填约束，允许局部字段更新或为重排提供明确支持；
  - 在 Go 后端 `TaskInput`、`CreateTask`、`UpdateTask` 中增加 `reminder` JSON 字段，实现提醒的完整持久化。
- **四象限分类与拖拽重排逻辑修复**：
  - 修复 `DailyQuadrants` 中已完成历史任务因 `diffDays <= 1` 被错归入“一天内”的计算漏洞；
  - 调整卡片拖拽微调顺序逻辑，保留被拖拽任务自身的时间戳，避免无差别继承目标卡片的时间。
- **快捷编辑窗与日期透传修复**：
  - 将日/周/月视图和侧边栏的 `initialDate` 正确传递给新建任务浮层与草稿；
  - 在 `TaskSchedulePicker` 时间段（Range）模式下补充提醒配置入口。
- **移除冗余视图与死代码清理**：
  - 移除任务中心（`TimeManagementPanel`）中的“日视图（DayView）”选项及死代码，专注于四象限（默认）与周/月时间跨度；日级微观规划由“当日待办（TodayPage）”承载；
  - 确认“周期任务概览侧边栏”仅在周/月日历视图显示，四象限视图保持纯净的全屏四网格；
  - 清理 `MonthView` 中未使用的 `onCreateTask` 死代码；
  - 移除 `saveRemoteTask` 中更新失败盲目退化为 POST 的遗留补丁，返回真实的错误提示。

## Capabilities

### New Capabilities
- `task-management-center`: 规范任务中心四象限分类展示、任务排序持久化、视图范围（仅四象限/周/月）及任务提醒生命周期。

### Modified Capabilities
- `task-quick-edit`: 支持视图透传的预选日期（`initialDate`）初始化新建任务，并在时间段（Range）模式下支持提醒配置。

## Impact

- **前端**：
  - `src/features/time-management/components/TimeManagementPanel.tsx` 移除日视图切换项及组件引用；
  - `src/features/time-management/components/DailyQuadrants.tsx` 修正已完成任务分组算法与拖拽时间戳继承；
  - `src/features/time-management/components/DayView.tsx` 移除；
  - `src/features/time-management/components/MonthView.tsx` 清理无用 props；
  - `src/features/time-management/components/quick-edit/TaskSchedulePicker.tsx` 补充时间段模式提醒入口；
  - `src/features/time-management/api/timeManagementService.ts` 与 `src/lib/taskApi.ts` 优化重排与更新请求；
- **后端**：
  - `server/internal/handler/task_handler.go` 增加 `reminder` 处理，优化 `UpdateTask` 验证规则。
