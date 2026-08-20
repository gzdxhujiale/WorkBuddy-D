# Frontend engineering

## Overview

The frontend is React 19 + TypeScript + Vite + Tailwind CSS. TanStack Router provides the main route tree, TanStack Query owns remote state, and Zustand holds UI-only state. `pnpm build` runs strict TypeScript checking and the Vite production build.

The application has three HTML/webview entry points:

| Entry point | Role |
| --- | --- |
| `src/main.tsx` | Main authenticated application and router. |
| `src/quick-edit-window.tsx` | Lightweight task quick-edit webview. |
| `src/focus-assistant-window.tsx` | Authenticated focus-assistant webview with Query support. |

## Structure and routing

- `src/router.tsx` defines `/today`, `/four-quadrants`, `/habit`, `/lists`, and `/daily-review`; route components are lazily imported.
- `src/components/layout/AppLayout.tsx` supplies the desktop shell and route fallback.
- `src/pages/` composes the route-level feature panels.
- `src/components/` contains feature UI, layout, focus UI, and reusable primitives in `components/ui/`.
- `src/types/` is the frontend type boundary; `@/*` resolves to `src/*`.

The root app resolves the Supabase session before rendering an authenticated route. On auth changes it clears query state and UI user state so a previous account’s cache cannot render for the next account. Secondary windows use `WindowSessionGate`; they must not assume the main app has already supplied React context.

## State and data model

| State kind | Owner | Use it for |
| --- | --- | --- |
| Server/cache state | TanStack Query | User-scoped records, refetching, invalidation, and optimistic cache updates. |
| UI-only shared state | Zustand in `src/stores/` (`useUiStore.ts`) | Selection, drawer/modal state, per-user UI preferences, transient timeline hover linkage (`hoveredStageId`), and cross-route active project selection (`activeProjectId`). |
| Local component state | React hooks | Drafts, transient interaction state, and surface-local feedback. |
| Database access | `src/services/` and feature hooks | Mapping Supabase rows, RPC calls, reads, and domain mutations. |

Query keys are defined in `src/lib/syncEngine.ts`. Use the narrowest matching key for an invalidation. Do not add a second global store for data already owned by Query.

## Reads, writes, and synchronization

Domain hooks compose Query with services. Services perform Supabase reads and RPC writes; `useTimeManagement.ts` is an existing hook-level read exception. Follow the closest established domain pattern instead of calling Supabase from new presentation components.

Optimistic writes are immediate and may be debounced by `useDebouncedMutation` or `useOptimisticSync`. `useOptimisticSync` owns one pending token and one latest dirty payload for each SyncKey, so high-frequency edits serialize as `idle -> pending -> syncing -> idle` without leaving a query permanently pending. Writes for the list, task, habit, and daily-review domains use `runOrQueue` where their service supports offline replay. A queued operation replaces an older pending operation for the same entity key; non-network errors are not silently queued.

The main window’s private Broadcast listener invalidates matching Query keys. It does not merge Broadcast payloads into authoritative records. Note writes keep the affected knowledge scope pending until their serialized RPC chain settles, so a writer does not refetch its own Broadcast hint mid-save.

## Rich-text editor boundary

WorkBuddy-D's application editor is **`reactjs-tiptap-editor`**, not a direct Tiptap integration. Tiptap packages are its underlying editor engine and extension API; business surfaces must reuse `src/components/ui/reactjs-tiptap-editor.tsx` rather than creating another `useEditor` composition. See the [reactjs-tiptap-editor integration reference](references/reactjs-tiptap-editor.md) for supported props, extensions, and usage by surface.

The knowledge module first loads its shell, then the selected list’s contents, note body, and templates on demand. Rich-text content is serialized JSON. Editor changes must be deduplicated, debounced, and written back with `emitUpdate: false` only when external content actually changed. Preserve the unmount-save and optimistic-version rules in [sync-and-editor consistency](design-docs/sync-and-editor-consistency.md).

Task descriptions use the same serialized Tiptap-document format while remaining a database `text` column. The task editor must accept legacy plain text, but compact task lists must render extracted plain text rather than the serialized JSON.

## Styling and accessibility

Tailwind 4 is configured through `src/index.css`; it is the application's Tailwind CSS-first entry point, not a second styling system. That file owns semantic light/dark tokens, radius, shared animation definitions, and narrowly scoped global rules. `src/components/ui/` provides standard primitives; compose them before creating another parallel primitive.

Key reusable primitives in `src/components/ui/` (all integrated with `useAppThemeStyle` for dual-theme token support):
- `dialog.tsx` — accessible modal dialogs with dual-theme border, shadow, and title tokens.
- `modal.tsx` — bridges the official `@arco-design/web-react` Modal component with theme style penetration and `getChildrenPopupContainer={() => document.body}` escape to guarantee child dropdowns and date pickers are not clipped by modal boundaries.
- `drawer.tsx` — slide-over panels for knowledge details and focus sessions with theme tokens.
- `date-picker.tsx` — standalone (`DatePicker`) and range (`DateRangePicker`) picker with dual-month grid, time modes, and theme tokens.
- `select.tsx` — bridges the official `@arco-design/web-react` Select dropdown component with `getPopupContainer={() => document.body}`, `triggerProps.zIndex: 1100`, and pixel theme tokens.
- `input-tag.tsx` — bridges the official `@arco-design/web-react` InputTag component with theme-aware tag rendering.
- `dropdown-menu.tsx` — accessible floating dropdown menu with 3px solid black shadow in pixel mode.
- `toast.tsx` — application-wide toast notification system with dual-theme badge styling.
- `popconfirm.tsx` — inline confirmation popovers for destructive and critical actions with dual-theme tokens.
- `button.tsx` — foundation button primitive with dual-theme variants, active press translation (`active:translate(1.5px, 1.5px)`), and shadow tokens.
- `input.tsx` — foundation single-line text input with dual-theme border, focus glow, and shadow tokens.
- `badge.tsx` — status and priority badges with theme-aware border and monospace tokens.
- `card.tsx` & `item.tsx` — universal card and list-item containers with dual-theme background, border, active selection cursor indicators, and shadow tokens.
- `switch.tsx` — accessible switch toggle primitive with dual-theme track, border, and precision thumb positioning preventing misalignment/overflow in pixel mode.

### Route transitions and animations

- **Main Route Canvas Transition**: In `src/components/layout/AppLayout.tsx`, the route canvas `<Outlet />` is wrapped in a dynamic container keyed by `useLocation().pathname`. Route switching triggers:
  - **Pixel mode**: `animate-pixel-page-in` (`100ms steps(3, jump-none)` 8-bit logbook page step-in fade);
  - **Modern mode**: `animate-fade-in` (`100ms ease-out` smooth subtle fade).
- **Navigation and Item Cursor Hop**: Selection cursors (`▶`) use `animate-pixel-hop` (`0.8s steps(2) infinite` horizontal step hop), centered vertically via an absolute flex container.
- **Secondary Sidebar Transition**: Knowledge base sidebar collapsing/expanding in pixel mode applies `[transition-timing-function:steps(4,jump-none)]`.

### Theme style system and multi-window IPC synchronization

The application supports dual design systems: `default` (现代简洁风 / Modern Clean) and `retro-pixel` (复古像素风 / Retro Pixel 8-Bit，系统默认), coordinated through:
- **Hook & Preferences API**: `useAppThemeStyle()` in `src/hooks/useAppThemeStyle.ts` and `getAppThemeStyle()`, `setAppThemeStyle()`, `applyAppThemeStyle()` in `src/lib/preferences.ts` (defaults to `"retro-pixel"` when unconfigured).
- **Tauri IPC Global Broadcast**: Setting the theme emits `emit("workbuddy:theme-style-change", { style })`. All independent Webviews (`main`, `task-quick-edit`, `focus-assistant`) listen to this event and call `applyAppThemeStyle(style)` to synchronously toggle `.theme-retro-pixel` on `document.documentElement`.
- **Pixel Icons System**: `src/components/pixel/PixelIcons.tsx` provides hand-crafted 8-bit SVG icons (`PixelSword`, `PixelScroll`, `PixelSparkle`, `PixelCalendar`, `PixelFlame`, `PixelLeaf`, `PixelBolt`, `PixelDrop`, `PixelBadge`, etc.) for rich retro game aesthetics.

### Drag and drop coordination

Drag and drop across the application (including knowledge-base sidebar ordering, note sorting/moving across knowledge folders and groups in `src/components/knowledge/KnowledgePanel.tsx`, and project task boards) is centrally coordinated via `@dnd-kit`. Do not implement custom HTML5 drag listeners or parallel drag libraries.

### Tailwind and CSS boundary

| Need | Preferred location | Rationale |
| --- | --- | --- |
| A screen- or component-local layout, spacing, color, state, or responsive rule | Tailwind utility classes in the TSX component | Keeps visual intent next to the rendered element and uses semantic theme tokens. |
| A reusable primitive's variants or internal styling | The owning component in `src/components/ui/` | Prevents page-level copies of the same component contract. |
| Semantic tokens, dark-theme values, global base styles, shared keyframes, or Tauri window-root styling | `src/index.css` | These rules intentionally apply outside one component and are Tailwind v4 configuration. |
| A third-party element mounted outside React's component tree, such as a portal directly under `body` | A narrowly scoped rule in `src/index.css`, with a comment explaining the external DOM contract | Utility classes cannot reach an element the application does not render. |

Do not add broad element selectors or unscoped `!important` rules for normal component styling. The `/` command menu rule is an intentional exception: `reactjs-tiptap-editor` mounts it directly under `body`, while the Tauri task quick-edit layers use fixed z-indexes. The selector is scoped to `html.tqe-window` and raises only that third-party floating menu above those layers.

Use semantic HTML and the existing accessibility conventions: labelled icon buttons, real dialog semantics, stateful ARIA attributes, labelled navigation, and local alerts/live regions. Accessibility is implemented in many components but has no configured automated audit.

For visual design direction, aesthetic choices, typography pairing, and anti-template UI design when creating or reshaping screens, read `.agents/skills/frontend-design/SKILL.md`. For shared token, theme, reusable-component, or cross-screen visual work, read `.agents/skills/tailwind-design-system/SKILL.md`. Do not load that workflow for an isolated utility-class edit.

## Errors, loading, and performance

The Query client disables automatic retry/reconnect/mount refetching to avoid request bursts during Supabase incidents. Failures must be surfaced by the relevant feature; `logSilent` is diagnostic only. `AppErrorBoundary` protects the main webview from render-time blank screens, and persistence/export actions show a Toast after logging their failure and reconciling stale optimistic state. Routes are lazy-loaded and the app shell provides a Suspense fallback. No repository-owned error-monitoring, metrics, tracing, or performance budget is configured.

## Verification

There is no configured frontend test, lint, or formatter script. Run `pnpm build` for frontend changes and manually exercise the affected authenticated route or secondary window. For Tiptap work use the `tiptap` skill; for substantial React implementation, refactoring, review, or performance work use `vercel-react-best-practices`; for distinctive visual design and aesthetic direction use `frontend-design`.
