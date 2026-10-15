# Design

## Context

知识库模块包含两处操作下拉触发点：笔记列表卡片（`NoteItem`）与笔记抽屉顶部栏（`NoteDrawerContent`），以及主工具栏的“更多操作”（含新建分组、批量导入/导出 MD）。当前存在两大技术瓶颈：
1. `DropdownMenuContent` 采用内联绝对定位（`absolute top-full`），直接嵌套在卡片或抽屉容器内。当位于具有 `overflow-y-auto` 或 `transition-all` 悬浮偏移的卡片中时，容易被滚动容器截断或因悬停位移产生回弹；同时 `retro-pixel` 像素主题下 Ghost 按钮在悬停时动态增加 1px 边框，造成盒模型突增 2px，诱发鼠标指针反复丢失/重获 Hover 状态的死循环高频抖动。
2. Markdown 导入链路严重降级：`convertMarkdownToTipTapJson` 只是朴素地以换行符拆分文本塞入 `<p>` 段落；批量导入通过单项 `addNote` 逐一写入客户端缓存并启动独立的延时防抖保存。当第一项保存完成后触发 WebSocket 回流时，TanStack Query 重新拉取远端目录笔记，直接把本地尚未提交完成的其余批量笔记全部从内存中覆盖抹除，导致严重的数据丢失。

## Goals / Non-Goals

**Goals:**
- 将 `DropdownMenuContent` 重构为基于 `createPortal` 的顶层浮层组件，支持视口边缘自适应与滚动联动，彻底消除下拉菜单被截断与随卡片微动产生晃动的问题。
- 修复 `retro-pixel` 主题下 Ghost 按钮的盒模型不变量，消除悬浮边框引起的闪烁循环。
- 利用 `@tiptap/markdown` 实现标准 Markdown 文档的 AST 转换，保真保留 H1-H6、列表、代码块、引用等富文本语法。
- 加固 TanStack Query 知识库目录缓存更新逻辑，保护本地尚未持久化的 `isNew` 笔记，防止批量导入与后台同步并发竞态下的数据丢失。
- 修复文件选择框在取消选择时的 Promise 挂起问题，单篇导入时联动更新笔记标题。

**Non-Goals:**
- 不修改后端 Go 独立服务的数据库架构、迁移脚本或 WebSocket 广播格式。
- 不引入重型外部浮层定位库（如 `@floating-ui/react`），保持零新增依赖，复用类似 `Popconfirm` 的轻量原生坐标计算方案。

## Decisions

### 1. 采用 `createPortal` 与视口感知坐标重构 `DropdownMenuContent`

* **方案选择**：将 `DropdownMenuContent` 渲染到 `document.body`，并通过 Trigger 元素的 `getBoundingClientRect()` 动态计算屏幕绝对坐标（`fixed` 定位）。
* **替代方案对比**：
  - *方案 A（内联 absolute 定位）*：受制于祖先节点的 `overflow: hidden`、`overflow: auto` 与 `transform` 隔离上下文，在列表末尾或抽屉内极易产生滚动条抖动与布局形变。
  - *方案 B（引入 floating-ui）*：功能完善但会引入新依赖，且需重写整体 API。
  - *选择方案 C（原生 Portal + 几何计算）*：与项目中已成熟验证的 `Popconfirm` 模式保持一致，完全隔绝 DOM 层级限制，支持 `align="end"` 与 `align="start"`，并在窗口 `resize` 和捕获阶段 `scroll` 时自动校准或关闭。

### 2. 预设透明边框消除像素主题按钮抖动

* **方案选择**：在 `src/components/ui/button.tsx` 的像素主题分支中，针对 `variant === "ghost"` 默认赋予 `border border-transparent`（或通过 `box-shadow` 代替实体边框）。悬停时仅切换为 `hover:border-border`。
* **效果**：常态与悬停态的盒模型边框尺寸恒定为 1px，鼠标划过按钮边缘时绝不引起几何尺寸变化，从根本上终结 Hover 闪烁死循环。

### 3. 基于 `@tiptap/markdown` 的双向文档序列化

* **方案选择**：在 `src/components/ui/reactjs-tiptap-editor.tsx` 中，利用项目已内置的 `@tiptap/markdown` 与 TipTap 模式，将 Markdown 解析为标准的 TipTap 节点树 JSON。
* **容错回退**：若传入字符串已是合法 JSON，直接返回原 JSON；若是纯文本或非标准格式，再安全降级为段落包裹。
* **标题识别**：导入单篇笔记时，检测 Markdown 首个 `# 一级标题`；若存在则提取为标题，否则截取去除扩展名的文件名作为笔记标题。

### 4. TanStack Query 缓存对未持久化新笔记（`isNew`）的排他性保留

* **方案选择**：在 `useKnowledgeFolderContents` 监听远端查询返回并调用 `setData` 时，不能直接用 `query.data.notes` 粗暴替换整个文件夹下的笔记。必须计算：
  ```ts
  const pendingNewNotes = current.notes.filter(
    n => n.folderId === folderId && n.isNew && !query.data.notes.some(remote => remote.id === n.id)
  );
  notes: [
    ...current.notes.filter(n => n.folderId !== folderId),
    ...hydratedRemoteNotes,
    ...pendingNewNotes,
  ]
  ```
* **效果**：无论远端拉取何时返回，本地正在排队落盘或网络传输中的 `isNew` 笔记绝不会被意外清空，直到其自身完成落盘并将 `isNew` 设为 `false`。

### 5. 原生文件选择器 `oncancel` 与批量交互反馈

* **方案选择**：
  - 在 `pickMarkdownFile` 与 `pickMultipleMarkdownFiles` 中，给动态生成的 `<input type="file">` 注册 `input.oncancel = () => resolve(null / [])`，以及窗口重新获得焦点时的定时兜底检测。
  - 在 `handleBatchImport` 中，当返回文件数组为空时直接静默返回，不再弹出“成功导入 0 篇”；当导入文件数量较多时显示批量导入中反馈。

## Risks / Trade-offs

- **[Risk] Portal 定位在页面极速滚动时可能略微脱节**
  → *Mitigation*：在 `window` 监听捕获阶段的 `scroll` 事件，页面滚动时自动平滑校准位置或主动安全关闭浮层，避免悬空。
- **[Risk] Markdown 包含复杂的 HTML 标签或第三方非标准语法**
  → *Mitigation*：TipTap Markdown 解析器遵循 GFM 规范，未识别的标签会被安全转换为纯文本或标准 HTML 节点，不引发解析崩溃。
