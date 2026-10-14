# Proposal

## Why

习惯追踪（Habit Tracking）是 WorkBuddy-D 个人效能与自律管理的核心支柱，与「今日工作台」微观聚焦台及「专注助手」桌面伴侣紧密联动。然而当前实现存在重大逻辑断裂与系统脆弱性：
1. 后端路由与 Handler 完全缺失习惯的更新（`UpdateHabit`）与删除（`DeleteHabit`）接口，前端触发时直接陷入 404 错误，修改与删除均无法持久化；
2. 前端初始加载与刷新时硬编码 `checkIns: []`，且后端缺乏打卡记录批量查询接口，导致用户每次刷新页面打卡状态和连续天数全部归零；
3. 习惯删除未对打卡记录进行级联软删除，残留脏数据；
4. 连续打卡天数（Streak）算法在多个组件内分裂重复且存在时间戳/夏令时计算隐患；
5. 右侧月历热力图（CalendarHeatmapComponent）仅为纯只读展示，不支持点击交互与补打卡；新建习惯弹窗中存在无实际功能的虚假选项（如特定次数）。

本变更旨在全链路打通习惯与打卡记录的增删改查闭环，统一打卡统计与过滤算法，清理历史包袱与冗余代码，并补全月历交互体验。

## What Changes

1. **后端完整接口与业务闭环**：
   - 在 `server/internal/database/queries/habits.sql` 完善习惯与打卡查询，新增批量打卡查询 `ListAllHabitCheckins` 及软删除打卡级联 `SoftDeleteHabitCheckins`。
   - 在 `server/internal/handler/habit_handler.go` 实现 `UpdateHabit`、`DeleteHabit` 与 `ListCheckins`。
   - 在 `server/cmd/server/main.go` 注册 `PUT /api/v1/habits/:id`、`DELETE /api/v1/habits/:id`、`GET /api/v1/habits/checkins`。
   - 习惯更新严格校验 `lock_version`，支持乐观并发控制（OCC）。
2. **打卡记录加载与离线韧性**：
   - 改造前端 `src/features/habit/api/habitService.ts` 中的 `loadAll`，同时请求 `/api/v1/habits` 与 `/api/v1/habits/checkins`，完整水合打卡记录，彻底解决刷新归零问题。
   - 优化 `toggleCheckIn` 的状态一致性，防止连续快速点击导致的竞态覆盖。
3. **算法统一与领域选择器抽取**：
   - 新建 `src/features/habit/utils/habitSelectors.ts`，统一收敛 `getHabitsForDate`、`getCheckInStatus`、`getHabitStats` 与 `getHabitStreak`。
   - 修复 Streak 算法中的日期递减逻辑（使用标准日历计算，避免夏令时/闰秒偏差），移除 365 天硬编码限制。
   - 修复 `getHabitsForDate` 对周频次习惯（`weekly_days`）的合法性支持。
4. **月历热力图交互增强与功能净化**：
   - 增强 `CalendarHeatmapComponent`：支持点击日历单元格直接切换当前选中日期并执行快速打卡/补打卡。
   - 净化创建习惯弹窗：移除未实现的虚假选项，规范目标与频次选项。
5. **清理历史包袱与代码异味**：
   - 清理 `HabitPanel.tsx` 文件中段违背规范的二次 `import`。
   - 消除 `reminder` 与 `checkInTime` 字段的混淆映射，清理假 OCC 字段（`baseUpdatedAt`、`isNew`）。
   - 消除多处组件双份冗余逻辑。

## Capabilities

### New Capabilities
- `habit-tracking`: 习惯追踪与打卡管理，包括习惯的生命周期管理（CRUD）、打卡状态记录、连续天数与达成率统计、月历热力图交互及今日看板联动。

### Modified Capabilities
<!-- 无需修改现有已有 spec -->

## Impact

- **后端代码**：`server/internal/database/queries/habits.sql`、`sqlc/` 数据库代码、`server/internal/handler/habit_handler.go`、`server/cmd/server/main.go`。
- **前端代码**：`src/features/habit/api/habitService.ts`、`src/features/habit/hooks/useHabits.ts`、`src/features/habit/components/HabitPanel.tsx`、`src/features/habit/components/TodayHabitsSection.tsx`、`src/features/habit/types/index.ts`、新建 `src/features/habit/utils/habitSelectors.ts`。
- **依赖与协议**：无破坏性变更，保持现有的 REST API 格式与 WebSocket 广播协议兼容。
