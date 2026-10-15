# Tasks

## 1. Backend SQL & Handler Cleanup

- [x] 1.1 修复 `daily_reviews.sql`，移除 `deleted_at IS NULL` 幽灵列，清理 `GetDailyReviewByDate` 死查询，并重新生成/更新 `daily_reviews.sql.go`；通过编译验证
- [x] 1.2 改造 `daily_review_handler.go`，下线 `GetByDate` 接口，在 `UpsertReview` 中完整返回持久化实体的权威数据（包含 ID、updated_at、lock_version）；清理 `main.go` 中的死路由并通过 Go 编译验证

## 2. Frontend API & Hook Synchronization

- [x] 2.1 改造 `dailyReviewService.ts`：移除死接口 `getByDate`，更新 `saveRemote` 与 `upsertReview`，完整回传服务端权威实体（`id`, `updatedAt`, `lockVersion`）
- [x] 2.2 改造 `useDailyReview.ts`：清理死类型引用，在 `useReviewActions.syncFn` 中正确同步更新缓存中目标项的权威 `id`、`updatedAt` 和 `lockVersion`
- [x] 2.3 清理 `src/features/daily-review/types/index.ts` 中未使用的 `SaveReviewOptions` 和 `monthlyCompletionRate` 死类型
- [x] 2.4 修复服务端 `models.DailyReview.Content` 导致的 Base64 序列化 Bug（改为 `json.RawMessage`），并在前端 `readReviewContent` 增加 Base64 自动解包与历史脏数据自愈支持

## 3. Editor Lifecycle & Rich Text Protection

- [x] 3.1 改造 `DailyReviewPanel.tsx` 中 `ReviewEditor` 的 key：由 `${selectedDate}-${currentReview?.id || "new"}` 改为稳定的 `selectedDate`，避免保存回执导致组件销毁重载
- [x] 3.2 优化 `DailyReviewPanel.tsx` 中的防抖和状态反馈，消除双重防抖造成的虚假已保存问题
- [x] 3.3 改造 `TodayReviewSection.tsx`：当今日已有复盘时设为只读并提供直达复盘通道，严禁单行 input 覆写富文本结构；首次新建时将单行输入封装为标准 Tiptap Doc JSON 结构

## 4. Statistics Calibration & Calendar Cross-day Fix

- [x] 4.1 重构 `isReviewEmpty`：采用纯文本内容递归解析，确保包含多个空段落或空标题的文档准确识别为空白，不计入打卡
- [x] 4.2 修正日历热力图字符数计算：基于提取的纯文字长度划分热力等级，排除 Tiptap JSON 语法标签干扰
- [x] 4.3 修正 `CompoundStats` 跨天冻结问题：移除 `todayStr` 空数组死依赖，使其支持跨天自适应，并在连击天数计算中过滤未来日期
- [x] 4.4 解除 `DailyReviewPanel.tsx` 中 `MIN_DATE = "2026-01-01"` 及日历翻页的年份硬编码限制

## 5. Verification & OpenSpec Validation

- [x] 5.1 运行 Go 后端编译检查与前端 `pnpm build`，确保无类型错误与破坏性变更
- [x] 5.2 运行 `openspec validate` 验证工件契约完整性
