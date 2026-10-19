# Tasks

## 1. 依赖重组与单例转换引擎 (Dependencies & Singleton Conversion Engine)

- [x] 1.1 安装官方轻量扩展并移除第三方包：在 `package.json` 中添加 `@tiptap/extension-image`、`@tiptap/extension-code-block-lowlight`、`lowlight`、`@tiptap/extension-character-count`，移除 `reactjs-tiptap-editor`，执行 `pnpm install` 验证依赖解析与版本一致性
- [x] 1.2 实现 `MarkdownService` 单例转换引擎：在 `src/components/editor/markdown/markdownService.ts` 中构建复用无头解析器，废除每次转换同步 `new Editor` / `destroy` 的开销，提供高保真 Markdown 与 Tiptap JSON 相互转换 API

## 2. 节点扩展与场景分级预设 (Extensions & Tiered Presets)

- [x] 2.1 规范化自定义节点扩展：在 `src/components/editor/extensions/` 实现具备原生 Markdown 序列化能力的 `CustomCallout`、`CustomDetails`、支持截图粘贴的 `ImageExtension` 与语法高亮 `CodeBlockLowlight`
- [x] 2.2 实现双向链接（Wikilinks）建议机制：基于 `@tiptap/suggestion` 构建 `WikilinkExtension`，支持在键入 `[[` 时呼出知识库笔记搜索面板，并在选中后生成可点击导航的语义节点
- [x] 2.3 组装三级场景预设模型：在 `src/components/editor/presets/` 建立 `minimal`（任务快速备注）、`compact`（每日复盘/侧边抽屉）与 `full`（知识库主视图/独立窗口）三套独立扩展组合

## 3. 受控 UI 组件与双主题集成 (Controlled UI & Theming)

- [x] 3.1 实现局域受限浮动菜单与斜杠命令面板：在 `src/components/editor/menus/` 构建受限于宿主容器的 `BubbleMenu` 与 `SlashCommandPalette`，杜绝将 DOM 浮动层直接逃逸挂载至 `document.body`
- [x] 3.2 实现分级工具栏与双主题样式系统：在 `src/components/editor/toolbars/` 实现 `CompactToolbar` 与 `FullToolbar`，全面适配 Modern 扁平主题与 Retro Pixel 复古像素模式（硬黑边框、点阵字体、羊皮纸色调与触觉交互）
- [x] 3.3 构建统一门面组件 `RichTextEditor`：在 `src/components/editor/RichTextEditor.tsx` 实现微防抖序列化（150ms）、光标越界钳夹保护与受控双向同步，并在 `src/components/ui/reactjs-tiptap-editor.tsx` 提供向后兼容别名导出

## 4. 消费场景切流与全局清理 (Consumer Migration & Cleanup)

- [x] 4.1 任务快速编辑切流与 Hack 清理：将 `TaskQuickEdit.tsx` 切换为 `minimal` 预设，移除组件内 `isRichTextFloatingMenuTarget` 及类名匹配 Hack，验证快速编辑弹出层的失焦与快捷键交互正常
- [x] 4.2 每日复盘面板切流：将 `DailyReviewPanel.tsx` 切换为 `compact` 预设，验证复盘常用块插入、快捷命令及空文档检测与后端判定对齐
- [x] 4.3 知识库编辑链路切流：将 `FullNoteEditor.tsx`、`NoteDrawer`（`KnowledgePanel.tsx`）与 `NoteStandaloneEditor.tsx` 切换为 `full` 预设，验证剪贴板截图粘贴、代码语法高亮、双链跳转及跨窗口编辑同步
- [x] 4.4 样式收敛与构建全绿回归：清理 `src/index.css` 中针对旧包装器的穿透补丁类，执行 `pnpm build` 与 `pnpm lint:boundaries` 确认类型检查与架构边界校验完全通过
