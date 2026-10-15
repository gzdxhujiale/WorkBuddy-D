# Proposal

## Why

个人知识库（Knowledge Base）是用户沉淀长效知识、笔记与复盘记录的核心工作台。目前用户在知识库操作中面临两大阻碍：
1. 在点击笔记卡片或抽屉顶栏的“更多”按钮时，由于复古像素主题（retro-pixel）下 Ghost 按钮在 Hover 状态突增边框引发盒模型抖动、卡片平移动画以及绝对定位下拉菜单缺乏 Portal 挂载，菜单在屏幕上高频“一闪一闪”，导致交互不稳定且难以命中操作项。
2. 单篇 Markdown 导入与批量 Markdown 导入存在功能失效与数据覆灭缺陷：当前导入算法仅简单按行包裹为纯文本段落（`<p>`），完全破坏了标题、列表、代码块与强调等 Markdown 富文本结构；单篇导入未能提取文件名或一级标题作为笔记标题；批量导入时因循环创建触发实时 WebSocket 广播，拉取远端未落盘数据覆盖了本地尚未持久化的排队笔记，导致批量导入笔记大面积丢失；且文件选择器在用户取消时产生悬挂 Promise。

本次变更旨在修复下拉菜单的视觉抖动与交互定位，并重构 Markdown 导入与批量导入链路，保障文档结构保真度与批量导入的数据完整性。

## What Changes

- **修复下拉菜单与按钮 Hover 视觉闪烁**：
  - 为 `retro-pixel` 主题下的 Ghost 按钮样式常态预留 1px 透明边框（`border border-transparent`），避免 hover 时边框突现改变元素盒模型尺寸而陷入 60Hz 抖动死循环。
  - 重构 `DropdownMenuContent`，采用 `createPortal` 挂载至 `document.body`，并通过目标触发元素的 `getBoundingClientRect()` 进行视口防溢出精准定位，隔绝父级卡片平移动画与 `overflow-y-auto` 容器滚动条对下拉浮层的挤压。
  - 为 `DropdownMenuTrigger` 补齐 `onMouseDown={(e) => e.stopPropagation()}`，杜绝外部关闭监听与点击切换之间的微任务时序竞争。
- **重构 Markdown 解析与导入**：
  - 使用工程已依赖的 `@tiptap/markdown` 与 TipTap 模式解析器，替换旧有低效且丢失语法的 `convertMarkdownToTipTapJson` 纯段落拆解逻辑，实现标题（H1-H6）、无序/有序/任务列表、粗斜体、引用块、代码块等原生 TipTap 节点的保真解析。
  - 单篇导入自动从文件名或 Markdown 首个 H1 标头智能提取并更新笔记标题（`title`）。
- **重构批量 Markdown 导入事务保护**：
  - 批量导入时采用并发/批量写入编排，在批量笔记全量完成持久化前隔离局部刷新或使用原子状态锁，杜绝 WebSocket 增量回流期间拉取远端空隙覆盖本地乐观缓存造成的笔记丢失。
  - 为 `pickMarkdownFile` 与 `pickMultipleMarkdownFiles` 增加原生 `<input type="file">` 的 `oncancel` 事件处理，支持空选安全退出，解决取消时的挂起 Promise。
  - 增加空文件选取拦截与批量导入进度/成功提示。

### Non-goals

- 不重写后端 Go 服务的底层存储架构与 `sqlc` 基础模型（沿用现有的 `POST /api/v1/notes` 接口或轻量扩展）。
- 不变更知识库已有的富文本编辑器扩展集与核心工具栏布局。
- 不修改项目管理与专注助手等其他不相干模块的独立下拉交互。

## Capabilities

### Modified Capabilities

- `knowledge-base`: 扩展 Markdown 导入语法保真度契约、批量导入并发一致性防覆灭契约，以及知识库操作下拉菜单在主题动效与滚动视口下的定位稳定性约束。

## Impact

- **受影响代码**：
  - `src/components/ui/dropdown-menu.tsx`：增加 Portal 挂载与坐标计算，增强点击/关闭稳定性。
  - `src/components/ui/button.tsx`：规范 `retro-pixel` 下 Ghost 变体边框占位，消除 hover 抖动。
  - `src/components/ui/reactjs-tiptap-editor.tsx`：升级 `convertMarkdownToTipTapJson`，借助 `@tiptap/markdown` 输出标准文档 AST。
  - `src/features/knowledge/api/markdownIo.ts`：完善文件选择器 `oncancel` 生命周期与标题解析。
  - `src/features/knowledge/components/KnowledgePanel.tsx`：优化批量导入调用链路、单篇导入标题联动与下拉菜单触发结构。
  - `src/features/knowledge/hooks/useKnowledgeQuery.ts`：加固批量创建时的缓存保护，防止拉取远端未落盘数据覆写本地缓存。
- **外部依赖与兼容性**：使用现有的 `@tiptap/markdown` 依赖，无需安装额外第三方包；保持与现存 Note 数据结构的完全向后兼容。
