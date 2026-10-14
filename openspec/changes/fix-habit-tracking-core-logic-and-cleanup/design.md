# Design

## Context

习惯追踪模块涉及 Go + Gin + SQLC 后端与 React + TanStack Query 前端。当前系统中，虽然数据库表结构已经包含 `habits` 和 `habit_checkins`，但后端 Handler 与路由仅暴露了最基础的列表、创建与打卡提交，遗漏了更新与删除接口，也未提供打卡历史记录的批量查询。前端组件层面存在大量重复的日历计算与 Streak 算法，且在刷新后丢失打卡记录。

## Goals / Non-Goals

**Goals:**
- 建立前后端对等的习惯与打卡 RESTful API（GET / PUT / DELETE / CHECKIN）。
- 确保打卡记录随习惯列表一同加载并缓存在 TanStack Query 状态树中。
- 封装高复用、类型安全的 `habitSelectors.ts`，统一日历过滤、Streak 计算与月历热力图数据准备。
- 为 `CalendarHeatmapComponent` 赋予交互打卡能力。
- 清理前端死代码、假 OCC 字段及组件中段重复 `import`。

**Non-Goals:**
- 不在此次变更中引入“每天打卡多次（计数型打卡）”的数据库迁移变更（保持布尔型完成状态，并在 UI 侧收敛虚假选项）。
- 不引入外部复杂时钟依赖，使用标准 JavaScript Date 原生安全方法。

## Decisions

### 1. 后端打卡批量查询接口设计
- **决策**：新增 `GET /api/v1/habits/checkins`，支持按当前 `user_id` 查询所有未删除打卡记录（支持可选的时间范围过滤或默认返回全量未软删除打卡），并在 Handler 中转换返回。
- **替代方案**：在 `GET /api/v1/habits` 中嵌套打卡记录。
  - *否决理由*：习惯与打卡记录是一对多关系，嵌套会导致负载过重且违背关系模型规范，打卡记录更适合作为独立的集合。

### 2. 习惯与打卡软删除级联
- **决策**：在 `SoftDeleteHabit` 执行时，使用事务同时软删除对应 `habit_id` 的所有 `habit_checkins`（`UPDATE habit_checkins SET deleted_at = now()`），保持统计数据干净。

### 3. 抽取 `habitSelectors.ts` 集中管理领域逻辑
- **决策**：在 `src/features/habit/utils/habitSelectors.ts` 导出以下纯函数：
  - `getHabitsForDate(habits, dateStr)`
  - `getCheckInStatus(checkIns, habitId, dateStr)`
  - `getHabitStreak(checkIns, habitId)`
  - `getHabitStats(checkIns, habitId, dateStr)`
- **改进点**：Streak 算法使用 `date.setDate(date.getDate() - 1)` 逐日递减，支持从今天或昨天顺延，移除 365 天上限。

### 4. 月历热力图交互增强
- **决策**：为 `CalendarHeatmapComponent` 传入 `onToggleCheckIn` 与 `onSelectDate` 回调，用户点击某一日历格子时，既切换高亮日期，又反转该日期的打卡状态。

## Risks / Trade-offs

- **[数据量增长]** 打卡记录随年份增加可能变大 → 现阶段按用户索引查询毫秒级，后续可在后端追加月份分页或 `WHERE date >= now() - interval '1 year'`。
- **[OCC 冲突]** 用户多端更新习惯发生 409 → 前端抛出提示并自动触发重新拉取。
