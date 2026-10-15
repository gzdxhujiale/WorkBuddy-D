# Tasks

## 1. 后端 SQL 查询与代码生成 (Backend Queries)
- [x] 1.1 在 `server/internal/database/queries/habits.sql` 中新增 `ListAllHabitCheckins` 查询，支持获取用户所有未软删除的打卡记录
- [x] 1.2 在 `habits.sql` 中新增 `SoftDeleteHabitCheckins` 查询，支持根据 habit_id 级联软删除关联的打卡记录
- [x] 1.3 运行 `sqlc generate` 重新生成 Go 数据库访问代码并确认无错误

## 2. 后端 Handler 与路由实现 (Backend Handlers & OCC)
- [x] 2.1 在 `server/internal/handler/habit_handler.go` 中实现 `UpdateHabit` 方法，绑定 `:id` 并强制校验 `lock_version`，支持并发安全与冲突检测
- [x] 2.2 在 `habit_handler.go` 中实现 `DeleteHabit` 方法，使用数据库事务级联软删除习惯及其所有历史打卡记录，并通过 WebSocket 广播删除事件
- [x] 2.3 在 `habit_handler.go` 中实现 `ListCheckins` 方法，返回用户的完整打卡记录
- [x] 2.4 在 `server/cmd/server/main.go` 中注册 `PUT /api/v1/habits/:id`、`DELETE /api/v1/habits/:id` 和 `GET /api/v1/habits/checkins`

## 3. 前端 API 层与数据水合 (Frontend API & Hydration)
- [x] 3.1 在 `src/features/habit/api/habitService.ts` 中改造 `loadAll`，同时拉取 `/api/v1/habits` 与 `/api/v1/habits/checkins`，格式化并返回权威的 `checkIns` 实体
- [x] 3.2 优化 `updateHabit` 与 `deleteHabit` 调用，确保准确携带 `lock_version`，并清理过时的 `baseUpdatedAt` 与 `isNew` 假 OCC 逻辑
- [x] 3.3 在 `types/index.ts` 中规范 `Habit` 与 `HabitCheckIn` 类型，统一 `reminder` 字段语义

## 4. 统一领域选择器与算法收敛 (Domain Selectors & Streak)
- [x] 4.1 新建 `src/features/habit/utils/habitSelectors.ts`，实现健壮的标准日历递减连续天数算法 `getHabitStreak`，移除 365 天截断限制并杜绝夏令时偏差
- [x] 4.2 在 `habitSelectors.ts` 中实现统一的 `getHabitsForDate`、`getCheckInStatus` 与 `getHabitStats`，补充对周频次（`weekly_days`）的合法判定
- [x] 4.3 在 `TodayHabitsSection.tsx` 中移除重复手写的算法与选择器，统一导入 `habitSelectors.ts`

## 5. 组件体验增强与代码净化 (UX Enhancements & Cleanup)
- [x] 5.1 为 `HabitPanel.tsx` 中的 `CalendarHeatmapComponent` 接入点击交互，允许点击日历单元格进行日期切换和快速打卡/补打卡
- [x] 5.2 净化 `CreateEditModal` 弹窗：移除未实现的特定次数选项，收敛目标为清晰的每日完成打卡
- [x] 5.3 清理 `HabitPanel.tsx` 文件中部的二次重复 `import`，移至文件顶部统一导入
- [x] 5.4 统一使用 `habitSelectors.ts` 替换 `HabitPanel.tsx` 中的内联统计与过滤函数

## 6. 全链路编译与交付验证 (Verification)
- [x] 6.1 在 `server/` 运行 `go build ./...`，确保 Go 后端无语法和编译错误
- [x] 6.2 在项目根目录运行 `pnpm build`，确保 TypeScript 类型检查和 Vite 打包通过
- [x] 6.3 运行 `openspec validate fix-habit-tracking-core-logic-and-cleanup --json` 确认所有工件完备闭环
