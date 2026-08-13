# Frontend

React 19 + TypeScript + Vite + Tailwind + TanStack Query/Router + Zustand. Pages compose features; services map domain models to Supabase. Query keys in `src/lib/syncEngine.ts` define refresh scope. Use the narrowest valid query key for external invalidations.

## 编辑器与乐观缓存

笔记使用 Tiptap JSON，并以本地 state + 防抖写入的方式保存。编辑器上报、自动保存及 `updateNote` 都必须先对内容做 no-op 去重；外部内容同步仅在真实变化时用 `emitUpdate: false` 写回编辑器。自动保存的卸载 cleanup 不能依赖随 Query cache 更新而重建的回调；用 ref 持有最新回调，避免形成 React `Maximum update depth exceeded` 循环。完整约束见[同步、版本与编辑器一致性](design-docs/sync-and-editor-consistency.md)。
