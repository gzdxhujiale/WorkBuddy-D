# 全局背景配色与视觉层级规范

**状态：** Accepted

## 决策摘要

WorkBuddy-D 采用统一的 **5 级色彩深度架构 (5-Level Elevation)** 来规范桌面端全应用及各核心功能模块（`today`、`time-management`、`habit`、`lists`、`daily-review`）的视觉层次。通过建立“窗口外壳 -> 视图画布 -> 表面容器 -> 嵌套项 -> 浮层弹窗”的明确层次，杜绝硬编码与非标透明度混用，保证深浅色模式下一致的沉浸感与边界清晰度。

---

## 5 级色彩深度架构 (5-Level Elevation)

全局统一采用 5 级色彩深度架构，确保深浅色模式下具备一致的视沉浸感与层次区分：

| 视觉层级 | 层级名称 | 浅色模式 (Light Mode) | 暗色模式 (Dark Mode) | 适用组件 / 区域 |
| :--- | :--- | :--- | :--- | :--- |
| **Level 0 (L0)** | **应用窗口外壳 (Chrome Shell)** | `#f3f4f6` (Slate-100/80) | `#0f172a` (Slate-900) | 侧边栏 Toolbar、顶部 MenuBar 统一基底 |
| **Level 1 (L1)** | **主视图画布 (Viewport Canvas)** | `#f8fafc` (Slate-50) | `#020617` (Slate-950) | `<main>` 主内容容器底色 |
| **Level 2 (L2)** | **卡片/容器表面 (Surface Card)** | `#ffffff` (Pure White) | `#0f172a` (Slate-900) | 任务卡片、统计面板、四象限区块、笔记列表卡片 |
| **Level 3 (L3)** | **嵌套子组件/高亮块 (Sub-Card)** | `#f1f5f9` (Slate-100) | `#1e293b` (Slate-800) | 卡片内部项、悬浮态 (Hover)、已完成项背景 |
| **Level 4 (L4)** | **浮层弹窗/下拉菜单 (Popover)** | `#ffffff` (Pure White) | `#1e293b` (Slate-800) | 下拉菜单、快捷编辑框、Tooltip、对话框 |

---

## 表面映射与组件规范

### 应用框架与视口基座 (L0 / L1)
- **外壳 (Toolbar & MenuBar)**: 统一 `bg-[#f3f4f6] dark:bg-slate-900`
- **主内容容器 (`<main>`)**: 
  - 画布底色：`bg-slate-50 dark:bg-slate-950`
  - 视口内切圆角：`rounded-tl-xl` (12px)
  - 边框定义：`border-t border-l border-slate-200/80 dark:border-slate-800/80`

### 业务模块表面规范 (L2)
- **当日待办 (`today`)**: 主容器继承 L1 画布，任务卡片统一使用 `bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs rounded-xl`，进度条使用 `bg-slate-100 dark:bg-slate-800`。
- **任务中心 (`time-management`)**: 顶部次级 Header 使用 `bg-white/90 dark:bg-slate-900/90 border-b border-slate-200/80 dark:border-slate-800`，四象限网格区块统一使用 `bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800`。
- **习惯追踪 (`habit`)**: 数据卡片统一为 `bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800`，打卡热力图/表格头部使用 `bg-slate-100/80 dark:bg-slate-800/60`。
- **知识库与笔记 (`lists`)**: 树状导航栏使用 `bg-white dark:bg-slate-900/90 border-r border-slate-200/80 dark:border-slate-800`，笔记卡片统一为 `bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800`。
- **每日复盘 (`daily-review`)**: 复盘卡片统一使用 `bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs`。

---

## 样式与 Token 约束

为保证后续开发维持视觉一致性，遵循以下规范约定：

1. **主背景规范**: 统一使用 `bg-slate-50 dark:bg-slate-950` 作为页面级画布背景。
2. **卡片背景规范**: 统一使用 `bg-white dark:bg-slate-900` 作为卡片级背景。
3. **边框规范**: 统一使用 `border-slate-200/80 dark:border-slate-800`。
4. **悬浮与交互背景**: 统一使用 `hover:bg-slate-100 dark:hover:bg-slate-800/70`。
5. **禁用透明度散乱规则**: 禁止在根容器或核心画布使用随意透明度修饰（如 `bg-slate-50/70` 或 `dark:bg-slate-950/80`），确保颜色纯正无混浊感，防止暗色模式下对比度倒挂。
