# Design: Knowledge Note Import/Export and Multi-View Modes

## Context

知识库模块目前基于 React 19、Tiptap 富文本编辑器、TanStack Query 5 与 Go 1.26 后端构建。Go 后端运行 `NoteBufferManager` 缓冲池（2.5s 定时刷盘）并通过 WebSocket 单调递增广播 `ENTITY_DELTA` 事件；Tauri 2 管理主窗口与辅窗口能力。现有笔记编辑仅提供单一的右侧 600px 抽屉（`NoteDrawer`），导入导出逻辑位于 `src/features/knowledge/api/markdownIo.ts`，UI 状态由 `useKnowledgeUiStore` 驱动。

## Goals / Non-Goals

**Goals:**
- 将 Markdown 导入标题提取由正文 H1 剥离重构为基于文件基础名称（不含扩展名），正文保持 100% 原始呈现。
- 在知识库主区域提供操作系统原生文件拖拽（Drag & Drop）导入支持与高亮视觉反馈。
- 实现智能导出协议：单篇笔记导出单个 `.md`；2 篇及以上批量导出自动打包为单个 `.zip` 压缩包。
- 保证创建笔记后输入框立即失焦，光标自动落入富文本编辑器首行。
- 提供三套完整的打开模式：侧边抽屉（Drawer）、主内容区铺满（Full Main Content）与 Tauri 独立原生窗口（Standalone Window），支持无缝互转。

**Non-Goals:**
- 不重构数据库表字段或持久化层结构。
- 不引入重型的第三方多协同编辑器框架（CRDT）。

## Decisions

### 1. 导出 ZIP 打包工具选型：`fflate`
- **选择**：采用超轻量（~8KB）、纯 TypeScript/ESM、零外部依赖且支持在浏览器及 Webview 高性能运行的 `fflate` 库。
- **替代方案对比**：
  - `jszip`：包体积较大（>100KB），存在历史打包兼容性问题。
  - 后端生成 zip：需要新增后端接口与多文件打包上传/下载往返，增加延迟与服务端内存负担。前端纯内存生成 zip 流并触发 Blob 下载最具实时性与可靠性。

### 2. 文件拖拽与现有 `@dnd-kit` 排序的隔离与协同
- **选择**：在 `KnowledgePanel` 根容器监听原生 HTML5 拖放事件（`onDragEnter`, `onDragOver`, `onDragLeave`, `onDrop`）。
- **判定机制**：通过 `e.dataTransfer?.types.includes('Files')` 严格识别文件拖入。系统原生的笔记卡片排序（`@dnd-kit`）只携带非文件类型数据，因此不会误触发文件放置覆盖层（Dropzone Overlay）。
- **放置处理**：过滤 `.md` 与 `.txt` 文件，依次读取为文本，以纯文件名作为笔记标题，批量调用 `addNote` 并弹出汇总提示。

### 3. 创建笔记时的焦点与光标转移
- **选择**：
  - 在创建输入框按 Enter 时，立即执行 `e.currentTarget.blur()` 并清空 `newNoteTitle`。
  - 在打开笔记时传递 `{ focusEditor: true }` 标记。
  - `ReactjsTiptapEditor` 组件挂载或切换笔记时，若检测到该标记，调用 `editor.commands.focus('start')` 将光标精准投放到正文第一行首个字符位置。

### 4. 视图打开模式架构与状态管理
- **UI 状态扩展 (`useKnowledgeUiStore`)**：
  ```ts
  interface KnowledgeUiState {
    activeNoteId: string | null;
    isDrawerOpen: boolean;
    viewMode: 'drawer' | 'full'; // 主窗口内展示模式
    defaultOpenMode: 'drawer' | 'full' | 'window'; // 用户默认偏好
    autoFocusEditor?: boolean;
    // ...
  }
  ```
- **主内容区铺满模式 (Full Main Content)**：
  - 当 `viewMode === 'full'` 且 `activeNoteId` 存在时，主区域从列表网格切换为宽幅居中的 `FullNoteEditor`。
  - 顶部导航条提供 `[← 返回笔记列表]` 面包屑按钮、标题、保存状态胶囊、`[切换为抽屉 ❐]` 与 `[独立窗口打开 ↗]` 动作。
- **独立原生窗口模式 (Standalone Window)**：
  - 扩展 `src-tauri/capabilities/default.json` 授权 `note-window-*` 模式窗口。
  - 创建 `note-window.html` 与 `src/note-window.tsx`，接收 URL 参数 `?noteId=xxx`。
  - 启动时通过 `useQuery` / `knowledgeService.loadNote(noteId)` 加载笔记，挂载富文本编辑器，利用既有的 `/api/v1/notes/:id/buffer` 写后缓冲池。
  - 关窗前监听 `beforeunload` 与 Tauri 关闭事件，主动调用 `/api/v1/notes/:id/flush` 保证落盘。
  - 当在主窗口点击“独立窗口打开”时，自动收起主窗口的抽屉或全屏编辑，防止同端双开编辑冲突。

## Risks / Trade-offs

- **[Risk] 多窗口并发编辑冲突** → **Mitigation**: 现有后端接口带有 `lock_version` 乐观锁保护，且主窗口在独立窗口弹出时自动关闭对应笔记的编辑态；多窗口通过已有 WebSocket Hub 同步接收 `ENTITY_DELTA` 事件刷新缓存。
- **[Risk] 独立窗口关闭时最新输入的字符尚未入库** → **Mitigation**: 在独立窗口关闭拦截器中调用 `flushNote(id)`，直接冲刷 Go 后端内存缓冲池落库。
