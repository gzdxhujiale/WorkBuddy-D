# Design

## Context

编辑器当前基于 Tiptap 3 / React 19，有序列表通过 `@tiptap/starter-kit` 默认装配。原生 ProseMirror 采用严格树状嵌套（`orderedList > listItem > (paragraph | orderedList)`）。当在嵌套子列表项行首按退格（Backspace）或删光内容时，默认命令会将 `listItem` 解构提升，一旦产生非 `<li>` 直接子节点，ProseMirror 会强制将父 `<ol>` 劈为两个独立的 `<ol>`，后半段序号归零重置为 `1.`。详见 `proposal.md`。

## Goals / Non-Goals

**Goals:**
- 实现行首智能退格守卫（Smart Backspace Guard），确保非空列表项不发生结构解散，空列表项仅逐级安全提升。
- 实现 ProseMirror 事务级自动相邻列表缝合扩展（`ConsecutiveListJoinPlugin`），在任何操作切断列表后毫秒级自愈缝合兄弟 `<ol>` 节点。
- 实现 CSS 级联计数器（`counters(tiptap-ol, ".")`），使 `1.`、`1.1`、`1.2` 级联表现全自动计算，中间项删除后后续子项自动响应式重排。
- 双主题（现代极简与 Retro Pixel）纯净自然缩进排版，移除竖向引导虚线，提升沉浸感。

**Non-Goals:**
- 不重构编辑器底层 AST 为扁平块模型（BlockSuite/Flat Tree）。
- 不破坏现有无序列表（`bulletList`）和待办任务（`taskList`）的行为。

## Decisions

### 决策 1：在 `CustomKeymap` 中实现阶梯式智能退格守卫
- **设计选择**：在 `CustomKeymapExtensions.ts` 的 `addKeyboardShortcuts()` 中拦截 `Backspace`：
  - 判断光标选区是否为 Collapsed 且位于 `listItem` 内部首个段落 offset 0 处；
  - 若处于嵌套子列表（depth > 1）：按 Backspace 优先触发 `liftListItem('listItem')` 单步减少缩进提升层级（Outdent），变回父级兄弟项，符合桌面写作习惯，绝不粗暴拼接到上一行文本末尾；
  - 若处于根级列表（depth === 1）：空行按 Backspace 退出列表变回段落，非空行行首退格尝试与前一文档块执行安全合并。
- **替代方案考虑**：非空项无脑执行 `joinBackward`（会导致用户在子项行首按退格时文字被强制粘连到上一行）。

### 决策 2：编写 `ConsecutiveListJoinPlugin` 插件在 `appendTransaction` 自动缝合
- **设计选择**：创建独立的 Tiptap Extension，在 `appendTransaction(transactions, oldState, newState)` 中扫描文档。
  - 寻找同深度且紧邻的兄弟节点：若 `node.type === orderedList` 且 `prevNode.type === orderedList`，计算交界坐标 `pos`，通过 `tr.join(pos)` 将其原子性融合成一个 `<ol>`。
  - 缝合过程对用户完全透明，无论因为何种复杂删除、拖拽或剪贴导致列表断裂，均能在同一事务周期内瞬间闭合，彻底杜绝父级 `2.xxx` 变 `1.xxx`。
- **替代方案考虑**：仅在 UI 渲染层伪造序号（无法解决复制导出或 Markdown 序列化时的断裂问题），在 ProseMirror 事务层缝合保持了真实 AST 的绝对正确。

### 决策 3：通过符合 W3C 规范的原生 `::marker` 接管大纲序号渲染
- **设计选择**：在 `src/index.css` 中直接赋能原生 Marker 盒，废弃脱离文档流的 `::before` 绝对定位方案：
  ```css
  .ProseMirror ol {
    counter-reset: tiptap-ol;
    padding-left: 1.6rem;
    margin: 0.35rem 0;
  }
  .ProseMirror ol > li {
    counter-increment: tiptap-ol;
    margin: 0.2rem 0;
    line-height: 1.6;
  }
  .ProseMirror ol > li::marker {
    content: counters(tiptap-ol, ".") ". ";
    font-variant-numeric: tabular-nums;
    font-weight: 500;
    color: var(--color-muted-foreground, #6b7280);
  }
  ```
  - **优势**：直接接管原生标记盒，绝不产生脱离文档流、与圆点 marker 叠加或剪贴板丢失序号的问题，且彻底拔除 JSX 层的 Tailwind arbitrary 覆盖。
- **替代方案考虑**：使用 `list-style: none` 搭配 `::before` 绝对定位（已被验证为反模式，存在幽灵圆点且复制丢失序号）。

## Risks / Trade-offs

- **[Risk]** 在列表项首按 Backspace 时，如果前一项包含子列表，简单合并可能把文字拼到子列表最后一项之后。
  → **Mitigation**: 在 Backspace 拦截器中精细判断前一节点的结构，若前一节点有嵌套子列表，安全落入子列表末尾段落，保证层级稳定。
- **[Risk]** CSS 计数器接管后，从其他软件复制粘贴的带 `start="N"` 的独立列表可能受影响。
  → **Mitigation**: CSS 计数器尊重 `ol[start]` 属性，若有 `start` 属性则动态设定 `counter-reset: tiptap-ol calc(var(--start, 1) - 1)`。
