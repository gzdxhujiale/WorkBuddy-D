# Proposal

## Why

每日复盘（Daily Review）模块是用户建立成长飞轮和复利习惯的核心功能。当前系统存在重大隐患：后端 SQL 引用了数据表中不存在的幽灵列 `deleted_at` 导致查询存在潜在崩溃风险；乐观并发控制（OCC）在后端被忽略导致旧写无条件覆盖；今日工作台的快速输入框会彻底覆盖并销毁用户精心排版的 Tiptap 富文本结构；新建复盘时动态 key 导致富文本编辑器在保存后被强制卸载重建；此外还存在跨天日历冻结、双重防抖虚假已保存反馈、空文档判定漏洞、历史包袱与死代码残留等问题。亟需通过本次变更彻底修复核心逻辑缺陷并清理历史技术债务。

## What Changes

1. **后端 SQL 与数据查询修复**：移除 `daily_reviews.sql` 与生成代码中不存在的 `deleted_at IS NULL` 幽灵列，使查询完全匹配数据库实际 Schema；移除闲置的 `GetByDate` 死路由与死查询。
2. **乐观锁（OCC）与版本控制生效**：后端 `UpsertReview` 正式校验/递增 `lock_version`，并将更新后的权威数据（包含真实 `id`、`updated_at`、`lock_version`）完整返回，前端同步更新缓存。
3. **工作台富文本防护**：改造今日工作台中的复盘交互，严禁单行输入框直接全量覆写 Tiptap 富文本结构；若已有富文本内容，避免破坏性覆写。
4. **编辑器生命周期与稳定 Key**：`ReviewEditor` 的 key 绑定为稳定的 `selectedDate`，移除动态拼接的 `id`，防止后台保存成功回填 UUID 时导致编辑器被强制销毁与输入打断。
5. **统一防抖与真实保存状态**：统一编辑器的保存触发机制与底层乐观同步防抖，消除双重防抖，确保状态栏“已保存”反馈真实对应写入行为。
6. **空文档判定与热力图算法修正**：`isReviewEmpty` 采用递归检查，避免多空段落被误判为有效打卡；打卡日历热力图基于纯文本字符数计算，杜绝 JSON 语法字符干扰。
7. **打卡日历跨天响应与连击算法过滤**：解除 `CompoundStats` 中 `todayStr` 的死依赖，支持跨天响应；连续天数计算中过滤未来日期，避免时区偏差导致连续打卡归零。
8. **清理历史包袱与死代码**：
   - 移除前端死接口 `dailyReviewApi.getByDate` 与未使用的 `SaveReviewOptions` 类型；
   - 移除 `getCompoundStats` 中未展示的死计算 `monthlyCompletionRate`；
   - 移除 `MIN_DATE = "2026-01-01"` 硬编码年份下限，支持灵活的历史回顾。

## Capabilities

### New Capabilities
- `daily-review`: 提供稳定可靠的每日复盘全流程能力，涵盖数据持久化与真实乐观锁控制、Tiptap 富文本安全编辑与防抖自动保存、严谨的打卡连续性（Streak）与字数热力图统计，以及与今日工作台的安全状态协同。

### Modified Capabilities
<!-- 无现有规格需要修改 -->

## Impact
- **后端代码**：
  - `server/internal/database/queries/daily_reviews.sql`
  - `server/internal/database/sqlc/daily_reviews.sql.go`
  - `server/internal/handler/daily_review_handler.go`
  - `server/cmd/server/main.go`
- **前端代码**：
  - `src/features/daily-review/types/index.ts`
  - `src/features/daily-review/api/dailyReviewService.ts`
  - `src/features/daily-review/hooks/useDailyReview.ts`
  - `src/features/daily-review/components/DailyReviewPanel.tsx`
  - `src/features/daily-review/components/TodayReviewSection.tsx`
