# Tasks

## 1. 消除视觉闪烁与重构 DropdownMenu 浮层定位

- [x] 1.1 修复 `src/components/ui/button.tsx` 中 `retro-pixel` 下 ghost 变体的 hover 边框尺寸突增，预设 1px 透明边框以稳定盒模型，验证 hover 时不再产生几何尺寸抖动
- [x] 1.2 将 `src/components/ui/dropdown-menu.tsx` 中的 `DropdownMenuContent` 改造为通过 `createPortal` 挂载至 `document.body`，依据触发元素的 `getBoundingClientRect()` 进行动态视口锚定，验证菜单不受父容器平移或 `overflow-y-auto` 滚动条裁切
- [x] 1.3 为 `DropdownMenuTrigger` 增加 `onMouseDown` 冒泡阻止，消除与 `document.onmousedown` 外部关闭监听的时序竞争，验证多次连续点击触发器时平滑开关

## 2. Markdown 保真解析与单篇导入增强

- [x] 2.1 在 `src/components/ui/reactjs-tiptap-editor.tsx` 中使用 `@tiptap/markdown` 与 TipTap 模式重构 `convertMarkdownToTipTapJson`，验证 Markdown 标题（H1-H6）、列表、代码块、引用等能保真生成 TipTap 结构化 AST
- [x] 2.2 在 `src/features/knowledge/api/markdownIo.ts` 中为 `pickMarkdownFile` 增加 `input.oncancel` 取消处理，并从文件名或 Markdown 首个 H1 标头提取标题，验证取消时安全返回 `null`
- [x] 2.3 在 `src/features/knowledge/components/KnowledgePanel.tsx` 的 `handleImport` 中同步更新笔记正文与笔记标题，验证导入单篇 Markdown 时标题与内容一并刷新

## 3. 批量导入与 TanStack Query 缓存竞态加固

- [x] 3.1 在 `src/features/knowledge/api/markdownIo.ts` 中为 `pickMultipleMarkdownFiles` 增加 `input.oncancel` 取消处理与空文件数组安全处理，验证取消时不产生悬挂 Promise
- [x] 3.2 在 `src/features/knowledge/hooks/useKnowledgeQuery.ts` 的 `useKnowledgeFolderContents` 中修改 `setData` 逻辑，在接收到远端刷新数据时保留本地处于 `isNew: true` 状态的待持久化新笔记，防止被远端空隙覆盖
- [x] 3.3 优化 `src/features/knowledge/components/KnowledgePanel.tsx` 的 `handleBatchImport` 流程，空选择时直接安全退出，避免误报“导入 0 篇”，并批量生成解析完整的独立笔记

## 4. 全量构建与架构边界校验

- [x] 4.1 运行 `pnpm build` 执行类型检查与前端生产构建，验证无任何 TypeScript 或打包报错
- [x] 4.2 运行 `pnpm lint:boundaries` 执行架构边界校验，验证遵循分层设计
