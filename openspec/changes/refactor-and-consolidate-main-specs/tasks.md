# Tasks

## 1. 规范基石与文档归位 (Foundations and Document Alignment)

- [x] 1.1 校验 `AGENTS.md` 中固化的规格治理不变量，运行 `ai-harness validate AGENTS.md --json` 验证退出码为 0 且无格式警告
- [x] 1.2 将 `openspec/specs/client-navigation-and-prefetching/` 中的路由预加载与并发调度工程约束归位至 `docs/FRONTEND.md`，运行 `ai-harness validate docs/FRONTEND.md --json` 验证通过
- [x] 1.3 移除已退役的 `openspec/specs/client-navigation-and-prefetching/` 目录并验证该路径已被清理

## 2. 核心业务能力规格整合与正向化重构 (Core Business Capabilities Consolidation)

- [x] 2.1 整合 `task-management-center`、`task-quick-edit` 与 `today-workbench` 为单一 `openspec/specs/task-management/spec.md`，彻底移除 UI 像素绝对定位与 IPC 频道名称，将负向禁令转换为正向不变量，运行 `openspec validate --specs` 验证通过
- [x] 2.2 重构 `project-management-center` 为 `openspec/specs/project-management/spec.md`，规范化软删除级联与阶段顺序分配正向契约，运行 `openspec validate --specs` 验证通过
- [x] 2.3 整合 `knowledge-base` 与 `knowledge-search-and-buffer` 为单一 `openspec/specs/knowledge-base/spec.md`，剔除“严禁覆写为空字符串/防截胡”等粉红大象用语与 Tiptap 库名，建立无损 Patching 与防抖持久化契约，运行 `openspec validate --specs` 验证通过
- [x] 2.4 整合 `daily-review` 与 `daily-review-intelligence` 为单一 `openspec/specs/daily-review/spec.md`，剔除“不得使用 deleted_at”历史疤痕与富文本库名词，正向界定结构化文档保护与连击统计，运行 `openspec validate --specs` 验证通过

## 3. 伴侣、习惯与支撑能力规格精炼 (Companion, Habit, and Sync Protocol Refinement)

- [x] 3.1 精炼 `openspec/specs/habit-tracking/spec.md`，剔除“右侧月历”方位限定与“杜绝夏令时”负向措辞，正向表述日历日连续回溯算法，运行 `openspec validate --specs` 验证通过
- [x] 3.2 重构 `focus-assistant` 为 `openspec/specs/focus-companion/spec.md`，移除 CSS 像素阴影边框与具体侧边栏按钮位置，确立挂钟绝对时间倒计时与全局通知卡片处理契约，运行 `openspec validate --specs` 验证通过
- [x] 3.3 整合 `settings`、`backend-data-sync` 与 `ordered-sync-protocol` 为 `openspec/specs/client-preferences-sync/spec.md`，剔除 DOM dataset、pgxpool、TanStack Query 词汇，定义双主题广播、单调序号数据同步与乐观并发控制契约，运行 `openspec validate --specs` 验证通过

## 4. 清理旧工件与全局规格校验 (Legacy Pruning and Global Verification)

- [x] 4.1 清理已被合并或退役的旧规格目录（`daily-review-intelligence`、`knowledge-search-and-buffer`、`ordered-sync-protocol`、`backend-data-sync`、`settings`、`task-management-center`、`task-quick-edit`、`today-workbench`、`project-management-center`、`focus-assistant`），确认仅保留 7 个标准业务规格目录
- [x] 4.2 运行全局 `openspec validate --specs`，确认 7 个主规格全部通过校验且无结构警告
- [x] 4.3 运行 `ai-harness validate` 确认全量受管文档（AGENTS.md, ARCHITECTURE.md, docs/BACKEND.md, docs/FRONTEND.md）全绿无错误
