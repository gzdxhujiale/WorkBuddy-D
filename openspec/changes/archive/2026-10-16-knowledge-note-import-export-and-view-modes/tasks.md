# Tasks: Knowledge Note Import/Export and Multi-View Modes

## 1. 依赖与导入导出能力重构 (Dependencies & Markdown I/O)

- [x] 1.1 安装轻量级 ZIP 工具库 `fflate` 并验证安装与编译成功
- [x] 1.2 重构 `src/features/knowledge/api/markdownIo.ts` 的 `extractTitleFromMarkdown`，使用去除扩展名的纯文件名作为笔记标题，正文完整保留
- [x] 1.3 重构 `src/features/knowledge/api/markdownIo.ts` 导出逻辑：单篇导出单个 `.md`，两篇及以上选中的笔记自动打包为单一 `.zip` 压缩文件并触发单次下载
- [x] 1.4 在 `src/features/knowledge/components/KnowledgePanel.tsx` 实现原生文件拖拽（Drag & Drop）覆盖层与导入处理，支持拖入单个或多个 `.md`/`.txt` 文件批量创建笔记

## 2. 笔记创建焦点与光标流转 (Creation Focus & Cursor Flow)

- [x] 2.1 改造 `KnowledgePanel` 创建笔记输入框的回车提交逻辑：按 Enter 后立即调用 `blur()` 失焦并清空输入框
- [x] 2.2 在 `src/components/ui/reactjs-tiptap-editor.tsx` 增强聚焦配置（支持 `autoFocus` 与命令聚焦），并在新建笔记打开时自动将光标定位至正文第一行首字符

## 3. 多视图打开模式 (Multi-Mode Presentation: Drawer, Full, Standalone Window)

- [x] 3.1 扩充 `src/features/knowledge/stores/knowledgeUiStore.ts` 状态，增加 `viewMode: 'drawer' | 'full'` 及 `defaultOpenMode`
- [x] 3.2 在 `src/features/knowledge/components/KnowledgePanel.tsx` 实现主内容区铺满视图（Full Main Content），提供返回列表面包屑、全宽居中编辑器与模式切换按钮
- [x] 3.3 在 `src-tauri/capabilities/default.json` 中配置 `note-window-*` 权限，支持动态创建独立的笔记原生窗口
- [x] 3.4 创建独立笔记窗口入口 `note-window.html` 与 `src/note-window.tsx`，支持独立加载笔记、Tiptap 编辑、写后缓冲与关窗强制刷盘 (`flushNote`)
- [x] 3.5 在抽屉、主工作区与笔记卡片菜单中添加“在独立窗口中打开 ↗”动作与窗口管理器

## 4. 跨窗口即时联动与防冲突 (Multi-Window Real-time Sync & Anti-Conflict)

- [x] 4.1 在 `src/features/knowledge/stores/knowledgeUiStore.ts` 扩展 `standaloneNoteIds` 与管理 actions
- [x] 4.2 在 `src/features/knowledge/utils/noteWindowManager.ts` 实现独立窗口检测、前置聚焦 (`focusStandaloneNoteWindow`)、关闭 (`closeStandaloneNoteWindow`) 与存活检测 (`getActiveStandaloneNoteIds`)
- [x] 4.3 在 `src/features/knowledge/components/NoteStandaloneEditor.tsx` 实现标题/正文编辑即时 IPC 广播 (`knowledge:note-updated`)、窗口状态广播 (`knowledge:note-window-state`) 及被删监听友好退出 (`knowledge:note-deleted`)
- [x] 4.4 在 `src/features/knowledge/components/KnowledgePanel.tsx` 接入 IPC 监听，原地更新 TanStack Query 缓存，列表卡片展示 `↗ 独立窗口` 微徽标，并在打开笔记时防重冲突拦截聚焦

## 5. 全局构建与校验 (Global Verification & Quality Gates)

- [x] 5.1 运行 `pnpm build` 与 `pnpm lint:boundaries` 验证前端类型与边界全绿
- [x] 5.2 运行 Rust 宿主编译检查 `cargo check` 验证 Tauri 2 窗口与原生功能无误
- [x] 5.3 运行 Go 后端测试与构建校验 `go -C server test ./...` 与 `go -C server build ./cmd/server` 确保后端稳定
