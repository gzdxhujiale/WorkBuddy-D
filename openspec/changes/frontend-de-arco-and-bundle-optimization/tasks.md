# Tasks: Frontend De-Arcoization and Bundle Optimization

## 1. Replace Arco Wrappers with Lightweight Primitives

- [x] 1.1 Re-implement `src/components/ui/modal.tsx` using native React Portals, Dialog layout, and `confirm-dialog` integration, preserving `open`/`visible`, `onOk`, `onCancel`, `confirmLoading`, `width`, and `Modal.confirm` without any Arco imports, verifying type checks pass.
- [x] 1.2 Re-implement `src/components/ui/select.tsx` using a lightweight custom popover and `Select.Option` composition with click-outside detection and theme styling, verifying type checks pass.
- [x] 1.3 Re-implement `src/components/ui/input-tag.tsx` using pure React tag state, keyboard navigation (Enter/Backspace), and badge styling, verifying type checks pass.

## 2. Dependency Removal & Import Cleanup

- [x] 2.1 Remove `@arco-design/web-react` from `package.json` and run `pnpm install` to update `pnpm-lock.yaml`.
- [x] 2.2 Scan `src/` to verify zero remaining references to `@arco-design/web-react` or `arco.css`.

## 3. Build & Multi-Webview Optimization Verification

- [x] 3.1 Refine `vite.config.ts` manualChunks strategy to remove `@arco-design` and cleanly partition React vendor and feature chunks.
- [ ] 3.2 Run `pnpm build` and verify that the 570KB `vendor-core.css` is eliminated and total bundle sizes decrease significantly.
