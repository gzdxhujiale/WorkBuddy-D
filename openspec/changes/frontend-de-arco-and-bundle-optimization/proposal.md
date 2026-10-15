# Proposal: Frontend De-Arcoization and Bundle Optimization

## Why

Currently, `@arco-design/web-react` is only imported in 3 UI wrapper files (`input-tag.tsx`, `modal.tsx`, `select.tsx`), yet it forces a 570KB CSS payload (`vendor-core.css`) and heavy JavaScript bundle across all webviews (including lightweight notification toasts). Completely replacing these 3 wrappers with lightweight Tailwind/Radix primitives allows removing `@arco-design/web-react`, reducing CSS by over 500KB and optimizing multi-webview chunking for instant startup.

## What Changes

- **Replace Arco Modal**: Re-implement `src/components/ui/modal.tsx` using native/Radix Dialog primitives with the project's Pixel and Modern theme styling, preserving existing `Modal.confirm`, `open`/`visible`, and callback signatures.
- **Replace Arco Select**: Re-implement `src/components/ui/select.tsx` using lightweight custom popover/listbox primitives, supporting options, custom triggers, and Pixel/Modern styling.
- **Replace Arco InputTag**: Re-implement `src/components/ui/input-tag.tsx` using pure Tailwind/React tag input logic, preserving tag adding, deleting, and change events.
- **Remove Arco Dependency**: Uninstall `@arco-design/web-react` from `package.json` and purge all `@arco-design/web-react/dist/css/arco.css` imports.
- **Optimize Vite Multi-Webview Chunking**: Update `vite.config.ts` so that lightweight webviews (`notificationToast`, `quickEdit`) do not pull in unnecessary main-window heavy chunks.
- **Fix CSS Property Warning**: Eliminate esbuild CSS warning regarding unsupported `[file:line]` class selector.

## Capabilities

### New Capabilities
None. (This is a pure frontend refactor, bundle size reduction, and build optimization change.)

### Modified Capabilities
None.

## Impact

- **Dependencies**: Uninstalls `@arco-design/web-react` from `package.json`.
- **Affected Files**:
  - `src/components/ui/input-tag.tsx`
  - `src/components/ui/modal.tsx`
  - `src/components/ui/select.tsx`
  - `vite.config.ts`
  - `package.json` / `pnpm-lock.yaml`
- **Bundle Metrics**:
  - Drops ~570KB CSS (`vendor-core.css`).
  - Drops ~200KB JS from `vendor-core.js`.
  - Dramatically speeds up build transform time and cuts notification toast memory usage.
- **Runtime Compatibility**: Fully preserves visual appearance and interaction behaviors for existing consumers in projects, tasks, daily review, and knowledge features.
