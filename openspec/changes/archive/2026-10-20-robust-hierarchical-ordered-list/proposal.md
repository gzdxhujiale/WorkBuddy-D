# Proposal

## Why

在多级有序列表（例如 `1.` / `1.1` / `1.2` / `2.`）的日常编辑中，当用户删除或退格中间子节点（如 `1.2`）时，原生 ProseMirror 的节点解构机制极易将父级列表劈成两个独立的新列表，导致后半段的父级序号断崖式归零（例如原本的 `2.xxx` 变回 `1.xxx`），且手动输入的层级数字无法自动重排。参考飞书、钉钉和 Typora 的工业级实践，本方案在 Tiptap 3 体系内引入三层健壮性防御，彻底根除列表横向撕裂与序号错乱问题，为桌面端个人复盘与知识库写作提供坚如磐石的列表体验。

## What Changes

- **交互层（退格守卫）**：在行首退格与段落边界处建立智能守卫，禁止非空子列表直接解散为普通段落；非空项执行前向文本平级合并（Join Backward），空项按单级安全提升（Lift/Outdent），防止跨层撕裂父列表。
- **事务层（邻近列表自动缝合与延续）**：实现 `ConsecutiveListJoinPlugin` 插件，在 ProseMirror 事务提交阶段（`appendTransaction`）毫秒级自动缝合被意外断开的兄弟 `<ol>` 节点，并自动维护 `start` 计数器属性，保证列表在任何删除/切分后结构物理自愈。
- **展现层（CSS 多级大纲计数器）**：接管有序列表序号展现，采用现代 CSS `counters(list-counter, ".")` 级联生成 `1.`、`1.1`、`1.2`、`1.2.1`，使多级编号无需用户手动输入，删除中间项时同级与子级序号自动响应式重排，同时完美适配现代极简与 Retro Pixel 双主题。

### Non-goals
- 不推翻当前 Tiptap/ProseMirror 底层树状模型改写为完整的扁平块（BlockSuite）编辑器架构。
- 不影响无序列表（`bulletList`）与待办任务列表（`taskList`）原有的勾选和树形缩进逻辑。

## Capabilities

### Modified Capabilities
- `rich-text-editor`: 增加多级有序列表退格守卫机制、断裂列表自动缝合事务插件以及 CSS 级联计数大纲序号规范。

## Impact

- 受影响模块：
  - 前端编辑器扩展：`src/components/editor/extensions/CustomKeymapExtensions.ts`（增补智能退格拦截与安全合并）。
  - 新增扩展：`src/components/editor/extensions/ConsecutiveListJoinPlugin.ts`（相邻同类列表自动合并与序号延续）。
  - 样式规范：`src/index.css`（多级 `<ol>` 的 CSS 级联计数器与双主题缩进适配）。
  - 预设配置：`src/components/editor/presets/full.ts`、`src/components/editor/presets/compact.ts` 等注册新扩展。
- 零后端破坏，零 API 契约变更。
