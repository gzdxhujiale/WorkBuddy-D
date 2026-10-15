# Proposal: Refactor and Consolidate Main Specs

## Why

目前 `openspec/specs/` 目录累积了 14 个主规格工件，经过全面审计，存在以下三重架构与工程债务：
1. **职责边界越界（Leakage）**：部分规格充当了“代码实现指令”，违规侵入前端（如 Tiptap、TanStack Query 缓存更新、React 19 并发过渡）、后端驱动（pgxpool、JWT 传输）与 UI/UX 样式（像素狗边框阴影、绝对位置按钮、DOM dataset 绑定）。根据工程不变量，技术与交互约束已有固定的 `docs/FRONTEND.md`、`docs/BACKEND.md` 与 `docs/DESIGN.md` 约束。
2. **“不要想象粉红的大象”负向约束（Negative Framing & AI Hallucination）**：多处规格采用“严禁将未传字段覆写为空字符串”、“不得在查询条件中使用未定义的字段（如 deleted_at）”、“杜绝静默覆盖”等防御性否定词。这类负向禁令不仅属于过往修复 Bug 遗留的“代码伤疤”，而且在 LLM 驱动研发时极易反向刺激模型的注意力矩阵，诱发注意力中毒与幻觉。
3. **能力粒度碎片化（Fragmentation）**：由于历史单次增量变更归档，导致多个兄弟能力割裂（如 `daily-review` 与 `daily-review-intelligence`，`knowledge-base` 与 `knowledge-search-and-buffer`，`backend-data-sync` 与 `ordered-sync-protocol`，以及任务中心的三个分散规格）。

本变更旨在对 `openspec/specs/` 进行全景治理，将 14 个零散工件精简收敛为 7 个高内聚标准业务能力规格，剔除技术实现细节，全面重构为“正向行动化不变量（Affirmative & Actionable Invariants）”，并在 `AGENTS.md` 中固化此项规约。

## What Changes

1. **固化规格治理工程不变量**：
   - 在 `AGENTS.md` 的 `Operating Invariants` 中确立“规格纯粹与正向表达”准则，明确 Specs 只关注可观察的系统行为契约（WHAT），排除框架库名与技术选型，并通过 `ai-harness validate` 校验。
2. **能力目录拓扑收敛（14 → 7）**：
   - **整合任务能力**：合并 `task-management-center`、`task-quick-edit`、`today-workbench` 为单一的 `task-management` 规格。
   - **整合项目能力**：重构并精炼 `project-management-center` 为 `project-management` 规格。
   - **整合知识库能力**：合并 `knowledge-base` 与 `knowledge-search-and-buffer` 为单一的 `knowledge-base` 规格。
   - **整合每日复盘能力**：合并 `daily-review` 与 `daily-review-intelligence` 为单一的 `daily-review` 规格。
   - **精炼习惯追踪能力**：优化 `habit-tracking` 规格，清理 UI 方位限定与负向用词。
   - **精炼桌面伴侣能力**：优化 `focus-assistant` 为 `focus-companion`，剔除 CSS 边框样式与具体侧边栏相对位置，保留挂钟倒计时与全局通知契约。
   - **整合偏好与同步协议**：合并 `settings`、`backend-data-sync` 与 `ordered-sync-protocol` 中通用的数据协议，提炼为 `data-sync-protocol` 与 `client-preferences`。
   - **下沉前端路由预加载**：将纯前端并发调度与 Hover 延迟规格 `client-navigation-and-prefetching` 归位至 `docs/FRONTEND.md`，从业务规约中注销。
3. **全面正向化去毒改造**：
   - 清除所有“严禁/不得/杜绝/避免”等粉红大象式负向表述；
   - 转换为“在特定输入/前置条件下，系统 SHALL 维持确定状态/默认回退/单调递增/无损保留”的正向行动表达；
   - 彻底剔除 Tiptap、pgxpool、TanStack Query、`dataset.themeStyle`、`tqe:init` 等实现细节词汇。

## Capabilities

### New Capabilities
- None (本变更为纯净的规格体系治理与重组，未增加新的未定义业务能力)。

### Modified Capabilities
- None (本变更使用 `skip_specs: true`，治理任务直接作用于 `openspec/specs/` 主规格资产的拓扑收敛与表达清洗，不作为增量行为变更触发二次 delta 合并)。

## Impact

- **受影响工件**：
  - `openspec/specs/` 目录下的 14 个文件收敛重组为 7 个标准业务能力规格。
  - `AGENTS.md` 补充规格治理不变量并通过 `ai-harness` 校验。
  - `docs/FRONTEND.md` 承接原 `client-navigation-and-prefetching` 中的路由预加载与并发调度工程约束。
- **运行时代码影响**：零运行时代码变更（Zero runtime code disruption），所有线上业务行为与数据库契约保持 100% 兼容。
