# Design

## Context

WorkBuddy-D 前端基于 React 19、Vite 7、Tailwind CSS 4 与 Tauri 2 构建，后端为 Go 独立服务。当前全仓的富文本交互均由 `src/components/ui/reactjs-tiptap-editor.tsx` 单文件驱动，其底层引入了 `reactjs-tiptap-editor`，导致依赖包臃肿（引入未使用的 Excalidraw、Mermaid、Docx 等）、Markdown 导入导出时频繁同步创建销毁无头 DOM Editor、按键全量序列化造成 GC 抖动，并且缺乏图片剪贴板粘贴、代码高亮、双向链接等核心能力。详见 `proposal.md`。

## Goals / Non-Goals

**Goals:**
- **架构解耦与依赖轻量化**：完全移除 `reactjs-tiptap-editor`，基于 `@tiptap/react` 组合式架构重构为模块化组件体系（`src/components/editor/`），统一切齐 `@tiptap/*: ^3.32.0`。
- **性能与单例转换**：构建单例解析引擎与 Tiptap 3 原生 Markdown 规则，消除 `new Editor` / `destroy` 开销与手写 AST 转换代码。
- **三级场景预设**：针对任务备注（`minimal`）、每日复盘与抽屉（`compact`）、知识库全功能（`full`）提供可按需组装的预设模型。
- **生产力特性集成**：原生支持剪贴板截图直贴、`lowlight` 语法高亮代码块、`[[` 笔记双链交互与字数统计。
- **设计系统与双主题收敛**：移除全局 `document.body` 污染与 CSS 穿透 Hack，浮动菜单局域受控，深度契合现代扁平主题与 Retro Pixel 复古像素模式。

**Non-Goals:**
- 不引入外部云端或 Yjs 实时协同同步服务器（保持现有的单机 + WebSocket 增量广播模型）。
- 不变更后端的数据库持久化契约（笔记依然持久化为标准 Tiptap JSON 格式，每日复盘依然兼容空文档检测）。

## Decisions

### 1. 目录架构重构：从巨石单文件拆分为可组合模块

将现存的单一文件拆分为高内聚的组件与扩展结构：

```
src/components/editor/
├── RichTextEditor.tsx          # 统一对外门面组件
├── presets/                    # 场景预设装配
│   ├── minimal.ts              # 任务备注模式（无工具栏、基础格式）
│   ├── compact.ts              # 每日复盘与侧边抽屉模式
│   └── full.ts                 # 知识库主编辑器模式（全功能）
├── extensions/                 # 自定义与扩展配置
│   ├── custom-callout.ts       # 规范化 Callout 节点（支持 parse/renderMarkdown）
│   ├── custom-details.ts       # 规范化折叠详情节点
│   ├── wikilink-suggestion.ts  # [[ 双链联想与导航节点
│   └── code-block-lowlight.ts  # 语法高亮集成
├── toolbars/                   # 受控工具栏
│   ├── FullToolbar.tsx
│   └── CompactToolbar.tsx
├── menus/                      # 局域浮动菜单与斜杠命令
│   ├── BubbleMenu.tsx
│   └── SlashCommandPalette.tsx
└── markdown/                   # 高性能 Markdown 序列化与转换单例
    ├── markdownService.ts      # 单例转换服务
    └── markdownParser.ts
```

*决策考量*：替代过去的单文件 700+ 行实现，确保按需导入，每个扩展与 UI 单元职责单一，便于单元测试与独立维护。

---

### 2. 状态同步与微防抖序列化（Anti-Lag Transaction Binding）

* **现状痛点**：`onUpdate` 中每次按键均全量执行 `JSON.stringify(currentEditor.getJSON())`，引发频繁的大对象分配；同时外部受控回传缺乏安全钳夹，偶发光标重置。
* **技术决策**：
  - 内部变更派发引入 150ms 微防抖（Micro-debounce），或优先派发轻量事务指纹（Transaction Document Size / Version），避免每按一键序列化整棵数。
  - 在受控 `content` 比对中，使用快速引用检测与 JSON Hash 比对，只有在确定外部内容由远端同步推送改变时才调用 `setContent(..., { emitUpdate: false })`。
  - 重置光标位置时，使用 `Math.min(from, editor.state.doc.content.size)` 与 `Math.min(to, editor.state.doc.content.size)` 做严格的越界安全保护，彻底阻断 ProseMirror 的 `Position out of range` 异常。

---

### 3. 高性能单例 Markdown 转换与原生扩展扩展声明

* **技术决策**：
  - 构建单例 `MarkdownService`：应用生命周期内保持复用单一初始化的 Headless Parser，避免每次导入或导出循环内重复 `new Editor`。
  - 自定义块（Callout, Details）全面接入 Tiptap 3 的 Markdown 协议声明：
    ```ts
    // custom-callout.ts
    addStorage() {
      return {
        markdown: {
          serialize(state, node) {
            state.write(`> [!${node.attrs.type || 'NOTE'}]\n`);
            state.renderInline(node);
          },
          parse: { /* GFM callout regex match */ }
        }
      }
    }
    ```
  - 彻底废除手写的 200 行 `renderMarkdownBlock` 递归 AST 逻辑，完全依托 Tiptap 核心的 Markdown 编解码管线。

---

### 4. 浮动层局部受限挂载（Scoped Floating Menus）

* **现状痛点**：旧组件将 Slash 菜单和 Bubble 菜单强制挂载到 `document.body`，与 `TaskQuickEdit` 窗口的层级和事件捕获冲突，需要靠类名前缀 `richtext-max-h-` 打补丁。
* **技术决策**：
  - 基于 Floating UI / Radix 机制，将浮动层挂载目标配置为编辑器宿主根容器（或通过 Portal 容器 prop 显式传入）。
  - 彻底清理 `src/index.css` 中的 `html.tqe-window body > div:has(...)` 及 `TaskQuickEdit.tsx` 中的 `isRichTextFloatingMenuTarget` Hack，由浮动菜单内部自主管理失焦与键盘事件。

---

### 5. 双向链接引用（Wikilinks）架构

* **技术决策**：
  - 注册自定义 Node `WikilinkNode`（inline、atomic、selectable）。
  - 结合 `@tiptap/suggestion`，当检测到键入 `[[` 时呼出悬浮搜索面板。
  - 搜索源接入 TanStack Query 的 `lists.all` 缓存中的知识库笔记列表（内存检索，毫秒级响应）。
  - 用户按下 Enter 或鼠标点击选择笔记后，插入 `<span data-type=\"wikilink\" data-note-id=\"...\">` 节点；点击时分发 `onNavigateNote(noteId)` 事件。

---

### 6. 双主题（Modern vs Retro Pixel）深度适配

* **技术决策**：
  - 采用统一的 Tailwind CSS 4 变量体系（`bg-card`、`text-foreground`、`border-border`、`bg-muted` 等）。
  - 在 `.theme-retro-pixel` 下：
    - 工具栏与浮动菜单采用像素黑边框（`border-2 border-amber-900/90 dark:border-amber-500 shadow-[2px_2px_0px_#000]`）。
    - 字体采用等宽与复古点阵字体（`font-mono`）。
    - 表格边框与代码块采用复古羊皮纸与琥珀色对比系。
    - 选区与高亮与像素调色盘完全对齐。

---

## Risks / Trade-offs

- **[Risk] 旧版笔记持久化 JSON AST 的向后兼容性**  
  → **Mitigation**：所有节点与标记命名严格对齐既有定义（`paragraph`、`heading`、`bulletList`、`orderedList`、`taskList`、`taskItem`、`codeBlock`、`blockquote`、`table`、`details`、`callout`），不做破坏性 schema 重命名，保证数据库中既有的历史笔记开箱即读。
- **[Risk] 依赖包变更可能影响构建流程**  
  → **Mitigation**：移除 `reactjs-tiptap-editor` 后，显式在 `package.json` 引入官方轻量包（如 `@tiptap/extension-image`、`@tiptap/extension-code-block-lowlight`、`lowlight`），并运行 `pnpm build` 与 `pnpm lint:boundaries` 进行严格验证。

## Migration Plan

1. **依赖升级与清理**：在 `package.json` 中移除 `reactjs-tiptap-editor`，添加缺失的官方轻量扩展。
2. **构建新组件模块**：在 `src/components/editor/` 下实现单例转换服务、核心扩展、工具栏及 `RichTextEditor`。
3. **向后兼容导出**：在 `src/components/ui/reactjs-tiptap-editor.tsx` 保留别名导出并代理到新实现，确保其他功能模块不受中断。
4. **消费场景逐级切流**：将 `TaskQuickEdit`（minimal）、`DailyReviewPanel`（compact）、`FullNoteEditor` / `NoteDrawer` / `NoteStandaloneEditor`（full）逐一切换并接入分级特性。
5. **清理冗余样式与 Hack**：清理 `src/index.css` 与 `TaskQuickEdit.tsx` 中针对旧包装器的特殊补丁代码。
