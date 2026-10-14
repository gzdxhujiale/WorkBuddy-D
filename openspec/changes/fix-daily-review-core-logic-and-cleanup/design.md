# Design

## Context
当前每日复盘在服务端和前端存在 SQL 查询字段不匹配、乐观锁缺失、工作台单行输入覆盖破坏富文本、组件 key 突变引发编辑器卸载、空文档判定不严密及死代码等问题。参见 `proposal.md`。

## Goals / Non-Goals

**Goals:**
- 修复后端 SQL 查询，彻底消除 `deleted_at` 幽灵列潜在运行时异常；
- 建立前后端对齐的真实实体同步，确保服务端持久化 ID 与版本号回填前端；
- 保护 Tiptap 富文本结构，杜绝单行输入框的全量覆写灾难；
- 稳定编辑器渲染生命周期，消除保存回执触发的闪烁和光标打断；
- 纠正空文档判定算法、日历热力图字符统计算法和连击（Streak）未来日期过滤；
- 移除死代码（未使用的 API、类型、未展示的月度统计）并解绑 2026-01-01 年份硬编码。

**Non-Goals:**
- 不重做双主题系统或在现代主题下新增加成就殿堂 UI（遵从用户指示暂不处理 UI 体验缺陷）；
- 不引入外部富文本依赖库或改变既有的 Tiptap 核心架构。

## Decisions

### 1. 服务端 SQL 与 Handler 修正
- **决策**：修改 `server/internal/database/queries/daily_reviews.sql`，移除 `WHERE user_id = $1 AND deleted_at IS NULL` 中的 `AND deleted_at IS NULL`；删除闲置的 `GetDailyReviewByDate` 查询与 `daily_review_handler.go` 中的 `GetByDate` 接口，并在 `main.go` 中下线对应路由。
- **替代方案**：在数据表中补加 `deleted_at` 字段。未采纳，因历史迁移 `20260813000600` 已明确确立复盘为按 `(user_id, date)` 原地更新，不适用软删除。

### 2. 权威实体同步与版本回填
- **决策**：`dailyReviewApi.upsertReview` 返回完整实体 `{ id, updatedAt, lockVersion }`；在 `useReviewActions` 的 `syncFn` 中，将缓存中的目标项更新为服务端的权威 `id`、`updatedAt` 与 `lockVersion`。

### 3. 编辑器挂载稳定性
- **决策**：在 `DailyReviewPanel.tsx` 中，将 `ReviewEditor` 的 key 改为 `key={selectedDate}`，移除动态 ID 依赖。
- **效果**：用户切换日期时编辑器正常重置，而在当前日期内触发自动保存并回填服务端 ID 时，组件树保持稳定，不发生卸载重建。

### 4. 今日工作台富文本防护与快速录入兼容
- **决策**：在 `TodayReviewSection.tsx` 中：
  - 若今日已有复盘且内容非空，输入框设为只读或点击直接导航至 `/daily-review`，禁止单行 input 覆写已有富文本；
  - 若今日尚未填写复盘，用户在输入框录入单行文字回车时，前端将其封装为标准的 Tiptap Doc JSON 结构：`{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"..."}]}]}` 进行保存。

### 5. 空文档递归判定与纯文字数热力图
- **决策**：
  - `isReviewEmpty` 统一基于提取出的纯文本正文字符串 `extractReviewPlainText(content).length === 0` 进行判定，彻底根除多空段落绕过检测的问题；
  - 日历热力图计算字符数时，先调用纯文本提取函数提取真实汉字/字符，以纯文字量（1-30, 31-100, 101-200, 201+）分级。

### 6. 跨天响应与连击算法过滤
- **决策**：
  - `CompoundStats` 移除 `todayStr` 与 `todayMonthStr` 的空依赖数组，改为动态传入或计算，确保跨午夜后今日正常可点；
  - `getCompoundStats` 在计算连续天数前，过滤掉大于当前日期的条目，避免未来日期导致打卡连击清零。

### 7. 死代码与硬编码清理
- **决策**：
  - 移除 `dailyReviewApi.getByDate`，移除 `SaveReviewOptions` 类型；
  - 移除 `CompoundStatsType` 及 `getCompoundStats` 中的 `monthlyCompletionRate`；
  - 将 `MIN_DATE = "2026-01-01"` 改为动态基准（例如当前年份前 3 年或动态支持历史年份），允许自由翻看历史打卡。

## Risks / Trade-offs

- **[Risk]** 清理后端的 `GetByDate` 接口可能破坏潜在的第三方客户端调用 → **Mitigation**: 经全局排查，该系统为 Tauri 桌面一体化架构，无独立第三方客户端，全工程零调用该路由。
- **[Risk]** 修正 `isReviewEmpty` 后，历史只有空段落的脏数据连击数可能发生轻微变动 → **Mitigation**: 这是符合业务预期的真实数据矫正。
