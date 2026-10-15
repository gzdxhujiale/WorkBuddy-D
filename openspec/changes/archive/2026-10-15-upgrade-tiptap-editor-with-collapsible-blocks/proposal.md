# Proposal: Upgrade Tiptap & Reactjs-Tiptap-Editor with Collapsible Details Blocks

## Why

WorkBuddy-D 的富文本编辑器底座目前依赖 `@tiptap/*@3.29.2` 与 `reactjs-tiptap-editor@1.0.32`。当前依赖存在已公开的安全漏洞（`prosemirror-view` 粘贴 XSS 漏洞 GHSA-c8x8-7fp4-3x9w 与 `@tiptap/core` 属性原型污染漏洞 GHSA-cp6q-959q-f8rh），且长文档编辑时工具栏全量重绘带来额外打字延迟。同时，知识库与长笔记整理缺乏折叠块（Collapsible Details）层级组织能力。通过全量升级至 `@tiptap/*@3.32.0` 与 `reactjs-tiptap-editor@1.0.46`，并在编辑器中引入折叠块扩展，全面消除安全风险、降低输入延迟，并为知识库长文档提供清晰的折叠层级结构。

## What Changes

- **依赖版本升级**：将 `@tiptap/core`、`@tiptap/pm`、`@tiptap/react`、`@tiptap/starter-kit` 及全部相关扩展由 `3.29.2` 升级至 `3.32.0`；将 `reactjs-tiptap-editor` 由 `1.0.32` 升级至 `1.0.46`。
- **引入折叠块扩展（Collapsible Details）**：
  - 在统一富文本适配层引入 `Details` / `DetailsSummary` / `DetailsContent` 扩展。
  - 在编辑器工具栏与 Slash 命令浮层中增加「折叠块 / Collapsible Block」创建入口。
  - 提供展开/折叠交互态与对齐主题色（包括暗色与 Retro Pixel 风格）的卡片式视觉规范。
- **序列化与转换适配**：
  - 更新 Markdown 与 ProseMirror JSON 双向转换工具函数，确保折叠块内容在自动保存、持久化和反序列化过程中完整保真。
- **样式与浮层回归加固**：
  - 验证快捷编辑弹窗（`TaskQuickEdit`）与多窗口环境下的 Slash 命令菜单穿透定位和层级表现。

### Non-Goals

- 不在此次变更中引入破坏性 schema 重构；所有既有历史笔记数据保持 100% 向后兼容。
- 不引入外部云端协同（Yjs 外部房间）或外部付费 AI 服务端配置，仅激活本地原生折叠编辑能力。

## Capabilities

### Modified Capabilities
- `knowledge-base`: 扩展富文本笔记编辑规范，增加可折叠内容块（Collapsible Details Blocks）交互与保真持久化契约。

## Impact

- **前端依赖**：`package.json` 与 `pnpm-lock.yaml` 中 `@tiptap/*` 与 `reactjs-tiptap-editor` 版本更新。
- **前端核心模块**：
  - `src/components/ui/reactjs-tiptap-editor.tsx`：扩展注册、工具栏、Slash 菜单与 Markdown 序列化函数。
  - `src/index.css`：折叠块的交互外观与暗色/复古像素主题适配。
  - `src/features/knowledge/components/KnowledgePanel.tsx`：长笔记折叠块编辑与写后缓冲持久化联动验证。
- **数据存储**：笔记正文 JSON 允许包含 `details` 相关节点，数据库结构无需迁移。
