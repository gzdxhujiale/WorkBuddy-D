# Tasks: Upgrade Tiptap & Reactjs-Tiptap-Editor with Collapsible Details Blocks

## 1. 依赖版本升级与基线对齐

- [x] 1.1 在 `package.json` 中将 `@tiptap/*` 依赖版本统一更新至 `3.32.0`，添加 `@tiptap/extension-details@3.32.0`，将 `reactjs-tiptap-editor` 更新至 `1.0.46`，执行 `pnpm install` 验证依赖解析与锁文件完整性

## 2. 富文本底座扩展接入与功能改造

- [x] 2.1 在 `src/components/ui/reactjs-tiptap-editor.tsx` 中注册 `Details` 节点扩展，并在 `EditorToolbar` 工具栏中引入 `RichTextDetails` 按钮与 Slash 命令列表项
- [x] 2.2 在 `src/components/ui/reactjs-tiptap-editor.tsx` 中完善 `convertTipTapJsonToMarkdown` 与反序列化处理，保证 `details` 节点双向序列化与 GFM 兼容
- [x] 2.3 在 `src/index.css` 与 `src/components/ui/reactjs-tiptap-editor.tsx` 中补充折叠块卡片、三角形指示器、暗色主题与 Retro Pixel 主题样式，确保阅读态与编辑态显示一致

## 3. 针对性验证与构建回归

- [x] 3.1 运行 `pnpm build` 和 `pnpm lint:boundaries`，验证 TypeScript 零类型错误与前端边界规范
- [x] 3.2 验证知识库面板（`KnowledgePanel`）与快捷编辑浮层（`TaskQuickEdit`）中的折叠块插入、展开折叠交互与自动保存持久化保真
