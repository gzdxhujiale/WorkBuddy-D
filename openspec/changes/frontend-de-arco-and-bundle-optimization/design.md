# Design: Frontend De-Arcoization and Bundle Optimization

## Context

`@arco-design/web-react` is used exclusively in three wrapper components under `src/components/ui/`:
1. `modal.tsx` (consumed by 4 files: `HabitPanel.tsx`, `KnowledgePanel.tsx`, `KnowledgeTemplateDialog.tsx`, `ProjectCreateModal.tsx`)
2. `select.tsx` (consumed by 3 files: `HabitPanel.tsx`, `KnowledgePanel.tsx`, `ProjectCreateModal.tsx`)
3. `input-tag.tsx` (consumed by 2 files: `ProjectCreateModal.tsx`, `ProjectHeaderToolbar.tsx`)

Because all 3 wrappers import `@arco-design/web-react/dist/css/arco.css`, Vite bundles 570KB of CSS and a heavy JavaScript runtime into `vendor-core`. The project already has established lightweight UI primitives in `src/components/ui/dialog.tsx`, `src/components/ui/confirm-dialog.tsx`, and `src/components/ui/button.tsx`.

## Goals / Non-Goals

**Goals:**
- Replace `modal.tsx`, `select.tsx`, and `input-tag.tsx` with self-contained, lightweight Tailwind CSS implementations supporting both Retro Pixel and Modern themes.
- Preserve identical component APIs (props, callbacks, subcomponents like `Select.Option`) so call sites in `features/` require zero or minimal non-breaking refactoring.
- Completely remove `@arco-design/web-react` from `package.json` and delete all Arco CSS imports.
- Reconfigure `vite.config.ts` manualChunks to eliminate Arco and optimize chunk splitting for secondary Webview windows (e.g. `notification-toast.html`).
- Ensure `pnpm build` succeeds with a major drop in total CSS/JS bundle sizes.

**Non-Goals:**
- Modifying business feature logic in `projects`, `knowledge`, or `habits`.
- Redesigning the visual look-and-feel (the replacement components will faithfully render the current pixel/modern aesthetic).

## Decisions

### 1. Re-implement `Modal` on top of `src/components/ui/dialog.tsx`
- **Choice**: Adapt `modal.tsx` to use React Portals, backdrop overlay, title/footer layout, and standard action buttons (`onOk`, `onCancel`, `confirmLoading`, `okDisabled`).
- **Static Methods**: Provide `Modal.confirm` leveraging the existing `confirm-dialog.tsx` imperative/stateful confirmation pattern.
- **Alternative considered**: Keeping Arco Modal behind a lazy-load chunk. (Rejected: still incurs CSS bleed and large dependencies).

### 2. Re-implement `Select` as a lightweight accessible dropdown
- **Choice**: Implement a custom dropdown trigger with popover menu supporting `value`, `defaultValue`, `onChange`, `placeholder`, and `<Select.Option value={...}>{label}</Select.Option>` composition. Supports click-outside closing and keyboard navigation.
- **Alternative considered**: Native `<select>` tag. (Rejected: cannot easily achieve the retro pixel shadow and dropdown menu aesthetics).

### 3. Re-implement `InputTag` with native state and badge pills
- **Choice**: Implement a flex-wrap container rendering badge pills with delete buttons (`X` icon) and an inline input for typing new tags (triggered on Enter or comma).
- **Alternative considered**: Third-party tag library. (Rejected: unnecessary overhead for ~50 lines of React/Tailwind logic).

### 4. Optimize `vite.config.ts` Multi-Webview Bundling
- **Choice**: Remove `@arco-design` from `vendor-core` chunk configuration. Split vendor into `vendor-react` (`react`, `react-dom`), `vendor-tanstack` (`@tanstack/react-query`, `@tanstack/react-router`), and `tiptap-vendor`.
- **Result**: Small windows like `notification-toast.html` only load the tiny `vendor-react` chunk without pulling TanStack Router or large UI dependencies.

## Risks / Trade-offs

- **[Risk] Missing prop edge cases in `Modal` or `Select`** → **Mitigation**: Audit all props passed by callers (`visible`, `open`, `onOk`, `onCancel`, `confirmLoading`, `width`, `title`, `footer`, `onChange`, `allowClear`, `triggerProps`). Guarantee all are supported with identical types or safe fallbacks.
- **[Risk] Focus trap or click-outside bubbling in `Select` popover** → **Mitigation**: Use standard document click listener with target node containment check (`ref.current.contains(event.target)`).
- **[Risk] CSS regressions after removing `arco.css`** → **Mitigation**: Inspect classes to ensure replacement components apply explicit Tailwind styles, border colors, and pixel theme shadows without relying on inherited Arco styles.
