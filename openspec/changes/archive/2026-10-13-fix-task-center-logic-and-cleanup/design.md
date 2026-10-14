# Design: Fix Task Center Logic and Cleanup Redundancies

## Context

任务中心（`FourQuadrantsPage` / `TimeManagementPanel`）与 Go 后端、Tauri Webview 快捷编辑窗之间交互复杂。当前系统已完成由 Supabase 向 Go+Neon 后端的迁移，但 Go 层的 `task_handler.go` 针对 `PUT` 请求设定了严格的 `Title binding:"required"`，且遗漏了 `reminder` 的绑定与持久化。同时，前端四象限列表由于过去任务计算中的负数边界问题，导致历史已完成任务归组异常。

## Goals / Non-Goals

**Goals:**
- 将后端 `task_handler.go` 中的 `TaskInput` 解除针对 Partial Update 的强制 required 限制，支持局部字段保存，并完整承载 `reminder` JSON。
- 保证拖拽重排（`reorderTasks`）请求能够成功在后端更新 `sort_order` 与 `quadrant`。
- 修复四象限列表已完成任务的到期分组判断逻辑，消除负数 `diffDays <= 1` 将历史完成任务错放进“一天内”的 BUG。
- 保持卡片重排时自身时间戳不变，避免无差别复制目标卡片的起止时间。
- 移除任务中心日视图（DayView）及相关未使用的死代码，确保仅保留四象限、周视图、月视图；四象限视图不显示周期侧边栏。
- 将创建任务时的 `initialDate` 贯穿传递至 `openQuickEditWindow`，并在时间段模式下提供提醒支持。

**Non-Goals:**
- 不重写或替换底层 TanStack Query 乐观同步引擎 (`useOptimisticSync`)。
- 不修改“当日待办（TodayPage）”的微观时间轴逻辑。

## Decisions

### 1. 后端 UpdateTask 参数模型与提醒支持
- **决定**：将 `TaskInput.Title` 移除 `binding:"required"`，或者在 `UpdateTask` 中区分创建与更新：更新时若未提供 `Title` 则保留现有数据库中的 `title`（通过 `COALESCE` 或 Go 逻辑按需合并，或者提供专用批量排序接口）；并在 `TaskInput` 中增加 `Reminder *string`（或 `any` / raw JSON），调用 sqlc 时序列化为 `[]byte` 存入 `time_management_tasks.reminder`。
- **替代方案考虑**：单独提供 `/api/v1/tasks/reorder` 接口。选用通用更新 + 支持局部属性更符合现有前端 `PUT /api/v1/tasks/:id` 模式。

### 2. 四象限已完成任务分组算法修正
- **决定**：在 `DailyQuadrants.tsx` 中，对已完成的任务单独进行过滤或沉底分组，或者仅对 `!t.completed` 的任务执行迫近分组（一天内/三天内/一周内/一周外）；已完成任务不进入迫近讨伐分组，只按完成状态显示在底部或各自象限的已完成集合中。
- **替代方案考虑**：完全隐藏已完成任务。不可取，因为用户可切换“全部任务”过滤器查看已完成任务。

### 3. 日视图下线与视图切换器简化
- **决定**：从 `TimeManagementPanel` 中移除 `activeView === "day"` 的逻辑与按钮，并删除 `DayView.tsx`；视图切换器仅保留“四象限”、“周视图”、“月视图”。四象限模式下全屏展示四网格，不展示右侧周期侧边栏；周视图和月视图继续保留右侧周期任务概览。

### 4. 快捷编辑浮层（TaskSchedulePicker）时间段提醒补齐
- **决定**：将 `TaskSchedulePicker` 中的提醒入口抽离为公共条目，无论处于 `scheduleMode === "point"` 还是 `scheduleMode === "range"`，均显示提醒设置按钮与已设置提醒标签，提醒基准时间以结束时间（`rangeEndDate` / `rangeEndTime`）为准。

## Risks / Trade-offs

- **[Risk]** 后端 `UpdateTask` 如果仅更新局部字段，需确保未传递的字段不会覆盖已有值。
  → **Mitigation**: 在 `task_handler.go` 的 `UpdateTask` 中，先查询当前现有任务 (`GetTaskByID`)，将更新请求中的非零/非空字段与旧数据合并，再执行 `UpdateTask`。
- **[Risk]** 移除 `DayView` 后若有通过 URL 或外部状态指定 `view=day` 的情况可能异常。
  → **Mitigation**: 默认 fallback 到 `"quadrant"`，清理路由和外部调用中对 day 视图的依赖。
