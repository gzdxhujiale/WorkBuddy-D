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

## Information hierarchy and surfaces

| Surface | Intended role | Existing evidence |
| --- | --- | --- |
| Desktop chrome | Window controls and persistent tool navigation | `src/components/layout/AppLayout.tsx` |
| Route canvas | Active task, habit, knowledge, or review work | `src/router.tsx`, `src/pages/` |
| Cards and panels | Group related information and actions | `src/components/ui/card.tsx`, feature panels |
| Dialogs and drawers | Focused editing, settings, and confirmation | `src/components/ui/dialog.tsx`, `drawer.tsx`, `confirm-dialog.tsx` |
| Secondary webviews | Quick task editing and focus assistance | `quick-edit.html`, `focus-assistant.html` |

## Interaction and accessibility expectations

- Use semantic controls where available. Existing UI uses native buttons plus `aria-label`, `aria-checked`, `aria-expanded`, dialogs, alerts, navigation labels, and polite live regions.
- Preserve keyboard focus and accessible labels when composing or replacing an existing dialog, toolbar, switch, listbox, or navigation control.
- Reuse the Lucide icon system already used by the shell; an icon-only control needs a text label for assistive technology.
- Do not claim a formal accessibility conformance level: none is configured or audited in this repository.

## Visual consistency limits

The token source is `src/index.css`, but parts of the current shell and feature UI still use hard-coded Slate colors. The repository-root `配色方案.md` identifies this as a proposed consistency refactor, not an accepted implementation contract. Until it is completed, prefer semantic tokens for new shared UI and avoid spreading additional ad-hoc page-surface colors.

## Related material

- Frontend implementation: [FRONTEND.md](FRONTEND.md)
- Product trade-offs: [PRODUCT_SENSE.md](PRODUCT_SENSE.md)
- Detailed design decisions: [design-docs/](design-docs/index.md)
- Shared Tailwind changes: `.agents/skills/tailwind-design-system/SKILL.md`
