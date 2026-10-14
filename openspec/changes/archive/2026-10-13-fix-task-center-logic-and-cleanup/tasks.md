# Tasks

## 1. 后端任务更新模型与提醒持久化修复

- [x] 1.1 修改 `server/internal/handler/task_handler.go`：移除 `TaskInput.Title` 的 `binding:"required"`，在更新时若 title 为空则保留已有原标题，并补充 `Reminder` 字段入参绑定与序列化传递给 sqlc，运行 `go test ./...` 或构建验证
- [x] 1.2 优化 `src/lib/taskApi.ts`：移除 `saveRemoteTask` 中更新失败盲目 fallback 到 POST 的旧逻辑，直接向上抛出明确错误

## 2. 任务排序持久化与重排逻辑优化

- [x] 2.1 优化 `src/features/time-management/api/timeManagementService.ts` 中的 `reorderTasks`：确保向后端发送的 PUT 更新包含必要字段，验证拖拽重排请求后端返回 200 而非 400
- [x] 2.2 修复 `src/features/time-management/components/DailyQuadrants.tsx` 中的 `handleDropOnTask`：在象限内微调上下顺序时保留被拖拽任务自身原有的时间戳（`scheduledStartAt`/`scheduledEndAt`），避免被目标任务强行覆盖

## 3. 四象限已完成任务归组算法修复

- [x] 3.1 修复 `src/features/time-management/components/DailyQuadrants.tsx` 中的已完成历史任务分组逻辑，确保负数 `diffDays` 的已完成任务不会被误归入“一天内（24H迫近）”分组

## 4. 快捷编辑浮层日期透传与时间段提醒补齐

- [x] 4.1 修复 `TimeManagementPanel.tsx` 中的 `handleOpenTaskEditor`：将视图传入的 `initialDate` 贯穿传递给快捷编辑窗口
- [x] 4.2 增强 `src/features/time-management/components/quick-edit/TaskSchedulePicker.tsx`：为时间段（Range）模式提供统一的提醒设置入口

## 5. 移除日视图与清理冗余代码

- [x] 5.1 从 `src/features/time-management/components/TimeManagementPanel.tsx` 移除日视图（DayView）选项与状态，确认侧边栏不在四象限视图展示，仅在周/月视图展示
- [x] 5.2 删除冗余的 `src/features/time-management/components/DayView.tsx` 文件，并清理 `MonthView.tsx` 中未使用的死代码 prop
- [x] 5.3 运行 `pnpm build` 确保前端构建无类型错误，验证整个任务中心编译正常
