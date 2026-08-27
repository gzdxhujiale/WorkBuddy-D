# Design: 全局 TaskQuickEdit 项目与阶段选择器集成

## Context

详见 `proposal.md`。当前 `TaskQuickEditPopover` 顶部仅有「日期与提醒」和「象限/优先级旗标」，缺少项目和阶段选择入口。此外，由于 `TaskQuickEditWindow` 运行在独立的 Tauri 透明子窗口中，需要确保主窗口的数据状态高效且无缝地同步给子窗口。

## Goals / Non-Goals

**Goals:**
- 在 `TaskQuickEditPopover` 顶栏新增项目/阶段选择器触发按钮，位于象限/优先级旗标按钮的左侧；
- 点击后展开支持项目与阶段级联选择的下拉菜单；
- **强制阶段关联**：如果用户选择关联项目，则必须指定该项目下的具体阶段（Stage）。点击具体阶段项后，自动绑定 `projectId` 与 `projectStageId` 并关闭菜单；
- 若切换为「不关联项目 (独立待办)」，则自动清空 `projectId` 与 `projectStageId`；
- 在 `quickEditWindow.ts` 中通过 `tqe:init` 将主窗口已缓存的项目与阶段列表传输至子窗口；
- 提交时回传 `projectId` 与 `projectStageId` 字段，确保数据在主窗口与数据库正确持久化；
- 双主题（现代极简与复古像素 8-Bit）无缝适配。

**Non-Goals:**
- 不在此变更中修改后端的数据库表或 RPC 存储过程；
- 不在快捷编辑弹窗内提供创建新项目或新建阶段的功能（应引导至项目中心进行全面管理）。

## Decisions

### 1. 顶栏按钮布局与视觉层级
- **位置**：在 `TaskQuickEditPopover` 的顶栏中，排列顺序为：
  `[日期与提醒 (flex-1)]` -> `[项目/阶段选择器 (shrink-0)]` -> `[象限旗标选择器 (shrink-0)]` -> `[关闭按钮 (shrink-0)]`。
- **按钮形态**：
  - 未关联项目时：展示灰度项目图标 `FolderKanban`，Hover 提示「关联项目/阶段」；
  - 已关联项目时：展示高亮图标与项目阶段完整名称（如 `📁 网站重构 · 开发`），背景带有浅色胶囊态。

### 2. 下拉菜单交互设计（强制选阶段）
- 下拉菜单使用浮动菜单或 Popover，内部分为：
  1. **不关联项目 (独立待办)** 选项：点击立即清除关联并关闭菜单；
  2. **项目列表**：每个项目作为分组展开其所属的阶段列表；
  3. **阶段选择**：点击特定阶段即完成项目与阶段的同时选择（`projectId = p.id`, `projectStageId = stage.id`），并自动收起下拉菜单；不提供空阶段选项。

### 3. 主窗口与子窗口 IPC 数据传输
- 在 `openQuickEditWindow(opts)` 时，如果 `opts` 未显式传入 `projects`，则自动从 `queryClient.getQueryData(queryKeys.projects(userId))` 中提取当前活跃的项目和阶段列表；
- 在 `tqe:init` 载荷中增加 `projects` 与 `stages` 数组；
- `TaskQuickEditWindow` 接收到 `tqe:init` 后传递给 `TaskQuickEditPopover`，实现 0 额外网络开销的即时渲染。

## Risks / Trade-offs

- **[子窗口项目列表过时]** → 每次触发 `openQuickEditWindow` 都会携带主窗口 Query 缓存中的最新项目与阶段快照，保证每次打开弹窗看到的都是最新数据。
- **[项目暂无阶段]** → 若用户在项目中心新建了项目但尚未创建阶段，点击该项目时提示或默认绑定该项目；当项目存在阶段时，必须点击具体阶段完成绑定。
