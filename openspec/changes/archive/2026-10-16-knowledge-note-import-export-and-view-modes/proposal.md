# Proposal: Knowledge Note Import/Export and Multi-View Modes

## Why

用户在管理与撰写知识库笔记时面临三个关键体验瓶颈：
1. **导入与导出体验割裂**：当前导入 Markdown 强制剥离正文首行一级标题作为笔记名，违背了以文件名为主标识的认知习惯；批量导出多个 Markdown 时在浏览器/桌面端触发多次循环下载弹窗，体验杂乱且易被系统拦截；缺少系统原生的拖拽文件导入能力。
2. **创建笔记输入焦点中断**：在列表上方输入框按 Enter 创建笔记后，焦点仍然停留在输入框中，用户必须手动用鼠标点击编辑器才能开始打字，打断了即时书写的心流。
3. **打开模式单一逼仄**：目前笔记仅支持固定宽度的右侧抽屉（Drawer）并伴随深色遮罩，无法满足沉浸式全宽深度长文写作，也不支持利用 Tauri 桌面端优势在独立原生多窗口中对照查阅。

通过优化文件导入导出、打通创建光标自动聚焦、并引入“抽屉 / 主工作区铺满 / 独立原生窗口”三位一体的打开模式，显著增强知识工作者的写作沉浸感与多任务桌面协同效率。

## What Changes

- **文件名作为导入笔记名**：提取去后缀的文件名作为笔记标题，正文完整保留原始 Markdown 的全部标题和格式，不再将正文首个 `# 标题` 剥离为笔记标题。
- **拖拽文件导入支持**：支持直接从操作系统拖入单篇或多篇 `.md` / `.txt` 文件至知识库主区域，高亮提示拖放并在当前文件夹批量创建笔记。
- **智能打包导出 (单篇 MD / 多篇 ZIP)**：导出 1 篇笔记时直接保存为单个 `.md` 文件；导出 2 篇及以上笔记时自动使用轻量 ZIP 打包为单一 `.zip` 压缩文件，单次触发下载。
- **创建笔记时光标自动定位**：在创建输入框输入标题并按 Enter 创建后，输入框立即失焦并清空，焦点自动转移至笔记编辑器正文首行；快捷创建空白笔记时焦点停在标题输入框。
- **新增主内容区铺满模式 (Full Main Content)**：点击笔记可全宽进入沉浸式主编辑区，提供顶部面包屑与“返回笔记列表”导航，彻底解除抽屉与遮罩的视觉逼仄。
- **新增独立原生窗口模式 (Standalone Window)**：支持将任意笔记脱嵌为独立的 Tauri 桌面窗口（`WebviewWindow`），支持多屏摆放与独立操作，并通过 WebSocket Hub 与 `NoteBufferManager` 保持跨窗口实时同步。
- **三种模式平滑互转**：在抽屉、主工作区和卡片列表中提供模式切换动作，并允许用户配置默认打开偏好。

## Non-goals

- 不在此次变更中引入复杂的双向文档实时多人协作 CRDT（如 Yjs 多光标并发），单用户跨窗口编辑依托现有的 WebSocket 增量广播与乐观锁机制。
- 不修改底层数据库表结构（继续复用 `notes` 现有 schema）。

## Capabilities

### Modified Capabilities

- `knowledge-base`: 修改 Markdown 文档标题提取规范，增加文件拖拽导入规范、批量导出单一 ZIP 规约、笔记创建时光标与焦点流转规约，以及侧边抽屉、主内容区铺满与独立原生窗口三种笔记视图打开模式的系统行为契约。

## Impact

- 前端：
  - `src/features/knowledge/api/markdownIo.ts`：更新标题提取、引入轻量 ZIP 打包（如 `fflate`）批量导出。
  - `src/features/knowledge/components/KnowledgePanel.tsx`：实现桌面文件原生拖拽监听、集成主工作区铺满视图与抽屉切换、实现创建后光标自动聚焦。
  - `src/features/knowledge/stores/knowledgeUiStore.ts`：扩充视图模式状态（`viewMode: 'drawer' | 'full' | 'window'`、`defaultOpenMode`）。
  - `src-tauri/capabilities/default.json` 与 `src-tauri/src/lib.rs`：适配 `note-window-*` 独立原生窗口权限与窗口打开命令。
  - 新建独立笔记窗口入口（如 `note-window.html` 与 `src/note-window.tsx`，类似 `quick-edit.html`）。
