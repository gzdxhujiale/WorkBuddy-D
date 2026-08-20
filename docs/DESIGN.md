# Design

## Purpose

This document records durable interaction and visual principles for the desktop workspace. It is not a component API or a feature mock-up; implementation rules are in [FRONTEND.md](FRONTEND.md), and feature-specific decisions belong in `design-docs/`.

## Design model

The authenticated workspace uses a compact desktop chrome: a persistent tool rail, a top window bar, and a focused route canvas. Current navigation exposes daily tasks, task management, habits, knowledge, daily review, and settings. Secondary windows are reserved for quick task editing and focus assistance.

The interface should support fast personal planning without hiding consequential state. It is primarily a desktop Tauri experience; no repository evidence defines a mobile or tablet product strategy.

## Principles

### Make the current workspace obvious

Use the existing navigation, page title/context, selected states, and route structure to show where the user is. Do not create competing global navigation patterns for a feature.

### Keep action hierarchy local

Primary actions belong close to the list, task, note, or review they affect. Secondary and destructive actions should not visually compete with normal progress actions. Reuse the existing dialog and confirmation primitives when explicit intent is needed.

### Represent asynchronous state in the surface that initiated it

Existing routes show loading fallbacks, while components use local messages, toasts, and error text in selected flows. New asynchronous UI must have an intentional loading, empty, error, success, or disabled state rather than relying on console output.

### Preserve editing continuity

The knowledge editor keeps local draft state and debounced persistence. Do not reset editor content on cache noise, re-emit equivalent updates, or make closing a relevant editing surface lose a pending draft. See [sync-and-editor consistency](design-docs/sync-and-editor-consistency.md).

### Use semantic visual roles

`src/index.css` defines semantic background, foreground, card, popover, border, sidebar, primary, destructive, radius, animation, and quadrant tokens for light and dark themes. Use those roles or an established component pattern when they express the required meaning.

### Dual Visual Themes (现代简洁风 vs 复古像素风)

WorkBuddy-D 默认采用「复古像素风」，并支持在「设置 - 通用设置」中全局切换视觉风格体系（`app_theme_style`）：
- **现代简洁风（Modern Clean）**：现代极简圆角（`rounded-xl` / `rounded-2xl`）、柔和高斯模糊阴影、低对比度线条与生动平滑矢量图标。
- **复古像素风（Retro Pixel 8-Bit，系统默认）**：8-Bit 像素直角外壳（`rounded-xs` / `border-2 border-border`）、硬边纯黑下落阴影（`shadow-[2px_2px_0px_#000]` / `shadow-[3px_3px_0px_#000]` / `shadow-[4px_4px_0px_#000]`）、经典等宽像素代码字体（`ui-monospace, "Cascadia Code"`）、按键下压回弹动效（`active:translate(1.5px,1.5px)` 与 `active:shadow-none`）与点阵金黄进度条。
- **像素交互与全屏转场系统（P0/P1/P2）**：
  - **一级主导航游标（Selection Cursor `▶`）**：在当前激活项左侧展示经典 8-bit 微型光标 `▶`，配合 `steps(2)` 定格两帧水平跳跃（`animate-pixel-hop`），完美垂直居中；
  - **二级侧边栏逐帧步进展开/折叠**：知识库与项目侧边栏在像素模式下采用 `steps(4, jump-none)` 阶梯式动画，文件夹折叠采用 `steps(2, jump-none)`，再现复古掌机逐帧渲染的质感；
  - **列表项选中刻印**：知识库清单、项目中心列表、习惯打卡列表在选中时统一在左侧呈现精准居中的 `▶` 游标与加深边框投影；
  - **主舞台 8-Bit 翻页微步进转场（Route Step-In）**：切页时触发 100ms 的 8-bit 日志翻页阶梯淡入（`animate-pixel-page-in` 搭配 `steps(3, jump-none)`），极速流畅。
- **底层 UI 组件库自适应与浮层层级规范**：
  - 全站基础组件（`Dialog`, `Modal`, `Drawer`, `DatePicker`, `DateRangePicker`, `Popconfirm`, `Toast`, `Button`, `Input`, `Badge`, `Card`, `Item`, `Select`, `DropdownMenu`, `InputTag`, `Switch`）内置 `useAppThemeStyle` 驱动，在双风格间自动切换设计 Token；
  - **全局浮层与弹窗层级**：所有 Arco 浮层（`.arco-trigger`、`.arco-select-popup`、`.arco-picker-popup`、`.arco-dropdown`）统一定义为 `z-index: 1100 !important`，置于 Modal 弹窗容器（`1001`）之上；`Modal` 内部显式配置 `getChildrenPopupContainer={() => document.body}`，确保弹窗内所有下拉选择器突破内容区边界正常展开。
- **全窗口无缝协同**：风格切换通过 Tauri 全局 IPC 事件广播（`workbuddy:theme-style-change`）同步至主窗口、快捷任务编辑浮层（`quick-edit.html`）与悬浮专注助手（`focus-assistant.html`）。

## Information hierarchy and surfaces

| Surface | Intended role | Existing evidence |
| --- | --- | --- |
| Desktop chrome | Window controls and persistent tool navigation with retro pixel cursor and physical press feedback | `src/components/layout/AppLayout.tsx` |
| Route canvas | Active task, habit, knowledge, or review work with 8-bit step-in page transitions | `src/router.tsx`, `src/pages/`, `src/components/layout/AppLayout.tsx` |
| Today Panel | 2-tier daily workspace: Top (Compact Focus Hub: Action Stream `[🕒 时间流/🗂️ 象限]` + Filter Pills `[全部/仅项目/仅独立]` + Habit Streaks + In-situ Review Wrap-up) and Bottom (Full-width Project Gantt Timeline with bidirectional hover glow linkage and unified scroll engine) | `src/components/today/TodayPanel.tsx`, `ProjectTimeline.tsx` |
| Task Center | 4 Quadrants (`🔥 紧急讨伐`, `🌿 核心修炼`, `⚡ 突发委托`, `💧 支线见闻`) and period grouping | `src/components/time-management/DailyQuadrants.tsx`, `TimeManagementPanel.tsx` |
| Project Center | Priority- and progress-sorted projects list with left selection cursor, smart status badge, compact 2x2 properties bar, Linear-style view bar, stage cards, and Arco Modal pixel project creation dialog (`发起冒险项目`) | `src/pages/ProjectsPage.tsx`, `ProjectStageBoard.tsx`, `ProjectTemplateManager.tsx` |
| Knowledge Base | 3-pane knowledge workspace: Sidebar with `steps(4)` collapse transition & list selection cursor, Note List, and Resizable Rich-Text Drawer (`ReactjsTiptapEditor`) | `src/pages/KnowledgePage.tsx`, `KnowledgePanel.tsx` |
| Cards and panels | Group related information and actions with dual-theme tokens | `src/components/ui/card.tsx`, `src/components/ui/item.tsx`, feature panels |
| Dialogs, modals, and drawers | Focused editing, settings, and standard dialogs with dual-theme border/shadow tokens and `document.body` popup container escape | `src/components/ui/dialog.tsx`, `src/components/ui/modal.tsx` (Arco Modal), `src/components/ui/drawer.tsx`, `popconfirm.tsx` |
| Floating menus and toasts | Transient actions, date picker popovers, high z-index (1100) selects, and global feedback | `src/components/ui/dropdown-menu.tsx`, `src/components/ui/select.tsx`, `src/components/ui/date-picker.tsx`, `src/components/ui/toast.tsx` |
| Secondary webviews | Quick task editing (with priority flag switcher) and focus assistant companions (with 3-tab target binding & tree picker) | `quick-edit.html`, `focus-assistant.html` |

## Interaction and accessibility expectations

- Use semantic controls where available. Existing UI uses native buttons plus `aria-label`, `aria-checked`, `aria-expanded`, dialogs, alerts, navigation labels, and polite live regions.
- **Task item action switching & height stability**:
  - The right action slot is statically dimensioned at `24×24px` (`size-6`);
  - When a task has description content, the detail indicator (`AlignLeft`) is displayed statically; when hovering, it smoothly transitions into the destructive delete button (`X`);
  - When a task has no description content, an invisible `size-6` placeholder element occupies the slot, ensuring row height remains rock-solid without layout jitter on hover.
- **Priority Flag Switcher**: In the Task Quick Edit window, clicking the top-right flag icon opens a dropdown to switch among the 4 priority quadrants (`urgent`/`high`/`medium`/`low`), immediately updating both quadrant and priority.
- Preserve keyboard focus and accessible labels when composing or replacing an existing dialog, toolbar, switch, listbox, or navigation control.
- Reuse the Lucide icon system already used by the shell or the dedicated `PixelIcons` system in pixel mode; an icon-only control needs a text label for assistive technology.
- Do not claim a formal accessibility conformance level: none is configured or audited in this repository.

## Visual consistency limits

The token source is `src/index.css`, but parts of the current shell and feature UI still use hard-coded Slate colors. [全局背景配色与视觉层级规范](design-docs/color-scheme.md) defines the authoritative 5-level elevation architecture and surface tokens across modules. Prefer semantic tokens and the 5-level elevation system for new UI and avoid spreading additional ad-hoc page-surface colors.

## Related material

- Frontend implementation: [FRONTEND.md](FRONTEND.md)
- Color scheme & elevation specification: [design-docs/color-scheme.md](design-docs/color-scheme.md)
- Focus Assistant & Pets specification: [product-specs/focus.md](product-specs/focus.md)
- Product trade-offs: [PRODUCT_SENSE.md](PRODUCT_SENSE.md)
- Detailed design decisions: [design-docs/](design-docs/index.md)
- Visual design & aesthetic direction: `.agents/skills/frontend-design/SKILL.md`
- Shared Tailwind changes: `.agents/skills/tailwind-design-system/SKILL.md`

