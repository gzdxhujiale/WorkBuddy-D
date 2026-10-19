# Proposal

## Why

WorkBuddy-D 作为面向知识工作者的个人效能工作台，富文本编辑处于核心交互链路（任务备注、每日复盘、知识库文档）。现有的富文本编辑器高度依赖第三方重型二次封装包（`reactjs-tiptap-editor`），导致应用打包体积严重虚增（引入未使用的 Excalidraw、Mermaid、Docx 等重型依赖），并在运行期频繁创建/销毁无头编辑器实例进行 Markdown 转换，造成 CPU 与内存抖动。同时，编辑器缺乏剪贴板截图、代码块高亮、双链引用、场景分级预设及像素主题深度融合等关键生产力特性。通过彻底解耦第三方包装、全面拥抱 Tiptap 3 官方组合式架构，构建轻量、高性能、多场景分级与高定制性的原生富文本中枢，能够从根本上提升系统性能与书写体验。

## What Changes

- **解耦第三方包装包并瘦身依赖**：移除 `reactjs-tiptap-editor` 及其传递依赖，基于 `@tiptap/react` 组合式 API 自建受控的 Toolbar、BubbleMenu 与 SlashCommand，对齐项目统一的 `@tiptap/*: ^3.32.0` 版本基线。
- **单例与无 DOM Markdown 转换引擎**：消除高频 `new Editor` / `destroy` 开销，采用解析器单例与 Tiptap 3 规范扩展声明（`parseMarkdown` / `renderMarkdown`），废除脆弱的手写 AST 字符串拼接。
- **优化按键全量序列化与光标竞态同步**：对编辑事务分发与 JSON 序列化实施精准微防抖，增加光标安全越界保护与受控双向状态同步。
- **局部受控浮动层消解全局 Hack**：自研浮动工具条与斜杠命令弹层，支持受限 Portal 容器绑定，彻底移除针对全局 `body` 的选择器 Hack。
- **剪贴板截图直贴与图片拖拽**：注册并配置 `@tiptap/extension-image`，支持剪贴板截图直接粘贴、拖拽放入及响应式预览。
- **代码块语法高亮**：集成 `@tiptap/extension-code-block-lowlight` 与轻量语法集（JS/TS、Go、SQL、Rust、Python、Shell），呈现清晰的代码排版。
- **双向链接引用（Wikilinks `[[...]]`）**：基于 `@tiptap/suggestion` 提供笔记检索与插入能力，点击直接联动导航至目标笔记。
- **场景分级预设模式（Tiered Presets）**：
  - `minimal`（任务快速备注）：轻量纯文本与基础格式，禁用复杂表格与大工具栏。
  - `compact`（每日复盘、侧边抽屉）：精简工具栏，支持复盘常用块与气泡菜单。
  - `full`（知识库主视图、独立窗口）：全功能工具栏、大纲目录、代码高亮、图片与高级排版。
- **现代/像素双主题深度适配**：为默认现代扁平主题与 Retro Pixel 复古主题分别提供深度定制的视觉与触觉反馈（像素硬边框、点阵字体、羊皮纸对比色）。

### Non-goals（非目标）
- 不在此变更中引入协同编辑网络协议服务（Hocuspocus / Yjs 云端协同），仍保持既有的本地与基于单调递增序列的 WebSocket 增量同步模型。
- 不替换底层 PostgreSQL/Go 端的存储契约，持久化载荷依然保持规范的 Tiptap JSON 文档格式。

## Capabilities

### New Capabilities
- `rich-text-editor`: 定义应用内富文本编辑器的核心交互规范、三级场景预设模型（minimal, compact, full）、快捷键交互、双链联动、图片渲染及现代/像素双主题渲染契约。

### Modified Capabilities
- `knowledge-base`: 扩展富文本知识库文档能力，包含图片嵌入、语法高亮代码块、双向链接导航及基于官方扩展规范的高保真 Markdown 导入导出。

## Impact

- **前端依赖**：移除 `package.json` 中的 `reactjs-tiptap-editor`；增添必要的官方轻量扩展（如 `@tiptap/extension-image`、`@tiptap/extension-code-block-lowlight`、`lowlight`、`@tiptap/extension-character-count`）；大幅削减打包产物体积。
- **消费组件**：重构 `src/components/ui/reactjs-tiptap-editor.tsx` 为模块化 `src/components/editor/` 架构；更新 `FullNoteEditor.tsx`、`NoteDrawer`、`NoteStandaloneEditor.tsx`、`DailyReviewPanel.tsx` 与 `TaskQuickEdit.tsx` 的调用参数（接入预设模式）。
- **全局样式**：清理 `src/index.css` 中针对 `reactjs-tiptap-editor` 的全局穿透 Hack 类，收敛为标准设计系统 Token。
