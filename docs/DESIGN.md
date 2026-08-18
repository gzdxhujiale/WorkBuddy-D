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

### Dual Visual Themes (现代矢量风 vs 复古像素风)

WorkBuddy-D 支持在「设置 - 通用设置」中全局切换视觉风格体系（`app_theme_style`）：
- **现代矢量风（Modern Vector）**：现代极简圆角（`rounded-xl` / `rounded-2xl`）、柔和阴影、低对比度线条与生动平滑矢量图标。
- **复古像素风（Retro Pixel 8-Bit）**：8-Bit 像素直角外壳（`rounded-xs` / `border-2 border-border`）、硬边纯黑下落阴影（`shadow-[2px_2px_0px_#000]` / `shadow-[4px_4px_0px_rgba(0,0,0,0.12)]`）、经典等宽像素代码字体（`ui-monospace, "Cascadia Code"`）、按键下压回弹动效（`active:translate(1px,1px)`）与点阵金黄进度条。
- **全窗口无缝协同**：风格切换通过 Tauri 全局 IPC 事件广播（`workbuddy:theme-style-change`）同步至主窗口、快捷任务编辑浮层（`quick-edit.html`）与悬浮专注助手（`focus-assistant.html`）。

## Information hierarchy and surfaces

| Surface | Intended role | Existing evidence |
| --- | --- | --- |
| Desktop chrome | Window controls and persistent tool navigation | `src/components/layout/AppLayout.tsx` |
| Route canvas | Active task, habit, knowledge, or review work | `src/router.tsx`, `src/pages/` |
| Today Panel | 2-tier daily workspace: Top (Tasks + Habits & Review) and Bottom (Full-width Project Gantt Timeline with default all-projects view, single-line stage names, and active window date range filtering) | `src/components/today/TodayPanel.tsx`, `ProjectTimeline.tsx` |
| Task Center | 4 Quadrants (`🔥 紧急讨伐`, `🌿 核心修炼`, `⚡ 突发委托`, `💧 支线见闻`) and period grouping | `src/components/time-management/DailyQuadrants.tsx`, `TimeManagementPanel.tsx` |
| Project Center | Priority- and progress-sorted projects list, vertical stage quadrant cards with schedule grouping, and full quick-edit integration | `src/pages/ProjectsPage.tsx`, `ProjectStageBoard.tsx` |
| Cards and panels | Group related information and actions | `src/components/ui/card.tsx`, feature panels |
| Dialogs, modals, and drawers | Focused editing, settings, and standard dialogs | `src/components/ui/modal.tsx` (Arco Modal), `dialog.tsx`, `popconfirm.tsx` |
| Floating menus and toasts | Transient actions and global feedback | `src/components/ui/dropdown-menu.tsx`, `src/components/ui/toast.tsx` |
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

