# Technical Design: Upgrade Tiptap & Reactjs-Tiptap-Editor with Collapsible Details Blocks

## Context

WorkBuddy-D 的富文本编辑器通过 `src/components/ui/reactjs-tiptap-editor.tsx` 封装，供个人知识库（`KnowledgePanel`）、每日复盘（`DailyReviewPanel`）与任务快捷编辑（`TaskQuickEdit`）共享使用。

当前依赖版本与动机详见 [proposal.md](proposal.md)。本次技术设计聚焦于如何在不破坏既有数据持久化、写后缓冲同步（`NoteBufferManager`）与多窗口样式隔离的前提下，平滑升级核心依赖并接入折叠块（Details）能力。

## Goals / Non-Goals

**Goals:**
- 将 `@tiptap/*` 依赖全量升级到 `3.32.0`，修复已公开安全漏洞（XSS 与原型污染），并引入 `@tiptap/extension-details@3.32.0`。
- 将 `reactjs-tiptap-editor` 升级至 `1.0.46`，获取工具栏解耦与代码块增量渲染性能优化。
- 引入折叠块扩展（`Details`、`RichTextDetails`），在编辑器工具栏与 Slash 浮层提供无缝交互，支持暗色模式与 Retro Pixel 视觉规范。
- 扩充 Markdown 双向序列化工具函数（`convertTipTapJsonToMarkdown`），对 `details` 节点生成标准 `<details><summary>...</summary>...</details>` GFM 语法。

**Non-Goals:**
- 不修改 PostgreSQL 底层表结构与 `NoteBufferManager` 缓冲协议（基于标准 ProseMirror JSON 节点）。
- 不引入外部云端协作或外部第三方 AI API 配置。

## Decisions

### 1. 采用 `reactjs-tiptap-editor/details` 统一封装而非裸写 ProseMirror 节点

- **选择**：直接使用 `reactjs-tiptap-editor/details` 导出的 `Details` 扩展与 `RichTextDetails` 工具栏组件，并在 `package.json` 对齐声明 `@tiptap/extension-details: "^3.32.0"`。
- **理由**：
  1. `reactjs-tiptap-editor` 的 `Details` 节点已经预先整合了 `details`、`detailsSummary` 与 `detailsContent` 的 schema、键盘快捷键与展开/收起切换行为；
  2. `RichTextDetails` 按钮天然继承了编辑器现有的 Shadcn/UI 工具栏图标与 Tooltip 交互；
  3. 与项目现有的 `reactjs-tiptap-editor` 体系风格 100% 保持一致。
- **替代方案**：使用底层 `@tiptap/extension-details` 自行从零编写 React NodeView 与工具栏按钮。成本高且难以与既有主题和快捷键体系平滑融合。

### 2. 维持原子锁定的精确版本管理策略

- **选择**：所有 `@tiptap/*` 扩展模块在 `package.json` 中保持统一版本号 `3.32.0`，避免不同子模块依赖版本飘移导致 ProseMirror 内部单例冲突。
- **理由**：ProseMirror 对 `Schema`、`Plugin` 和 `Node` 的对象引用敏感，多个微版本并存容易造成 `Duplicate plugin key` 或拖拽选择异常。

### 3. 折叠块样式的局部 Tailwind 与全局穿透设计

- **选择**：在 `src/components/ui/reactjs-tiptap-editor.tsx` 的 `EditorContent` 容器中通过针对 `[&_.ProseMirror_details]` 的 Tailwind 规则注入基础边框、圆角、背景和间距；在 `src/index.css` 补充折叠块在暗色模式与 `.theme-retro-pixel` 下的三角指示器和聚焦边框。
- **理由**：
  1. 保证知识库面板与独立悬浮快捷编辑窗口在不同主题下均具备统一质感；
  2. 保持折叠内容在只读（`editable={false}`）或阅读模式下仍能正常展开浏览。

### 4. GFM 兼容的双向 Markdown 序列化

- **选择**：在 `convertTipTapJsonToMarkdown` 中对 `block.type === "details"` 序列化为符合 CommonMark/GFM 规范的 HTML 标签：
  ```html
  <details>
  <summary>折叠标题</summary>
  折叠正文内容
  </details>
  ```
- **理由**：确保笔记导出为 Markdown 或在纯文本视图下查看时内容不丢失，且外部工具（GitHub、Obsidian 等）能无缝呈现折叠效果。

## Risks / Trade-offs

- **[Risk] 依赖升级后样式类名微调导致局部溢出** →
  - **Mitigation**: 运行 `pnpm build` 进行严格类型校验，并在 KnowledgePanel 与 TaskQuickEdit 中对折叠块展开、工具栏按钮及 Slash 菜单定位进行直接渲染回归。
- **[Risk] 快捷编辑弹窗（TaskQuickEdit）穿透判定失效** →
  - **Mitigation**: 保留并验证 `isRichTextFloatingMenuTarget` 与 `html.tqe-window body > div:has(> [class*="richtext-max-h-"])`，确保折叠块相关弹层在快捷弹窗之上（`z-index: 1080`）。

## Migration Plan

1. 在 `package.json` 中更新依赖版本并补充 `@tiptap/extension-details`；
2. 执行 `pnpm install` 刷新 `pnpm-lock.yaml`；
3. 更新 `src/components/ui/reactjs-tiptap-editor.tsx` 注册 `Details` 扩展、工具栏 `RichTextDetails` 与 Markdown 序列化；
4. 在 `src/index.css` 添加折叠块主题样式；
5. 执行针对性前端验证：`pnpm build` 与 `pnpm lint:boundaries`。
