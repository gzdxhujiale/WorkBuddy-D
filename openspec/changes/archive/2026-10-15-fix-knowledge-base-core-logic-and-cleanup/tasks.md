# Tasks

## 1. 后端 SQL 与查询重构 (Backend Queries)
- [x] 1.1 重构 `server/internal/database/queries/notes.sql` 中的 `PatchNote`，通过布尔条件或安全判断区分“未传递字段”与“清空为字符串”，防止 `content` 和 `title` 被误清空
- [x] 1.2 在 `notes.sql` 中新增软删除级联支持（解绑 `knowledge_base_id` 为 NULL、解绑 `group_id` 为 NULL、级联软删除文件夹下笔记与分组）
- [x] 1.3 运行 `sqlc generate` 重新生成 Go 数据库访问代码

## 2. 后端 Handler 与事务实现 (Backend Handlers & OCC)
- [x] 2.1 在 `server/internal/handler/note_handler.go` 中重构 `PatchNote`，正确透传各字段提供标志，杜绝空字符串覆写
- [x] 2.2 在 `note_handler.go` 中完善 `UpdateNote`，严格绑定 `:id` 并强制校验 `lock_version`，若版本冲突返回 409
- [x] 2.3 在 `note_handler.go` 中使用数据库事务重构 `DuplicateFolder`，完整深拷贝目标文件夹及其下属的全部笔记分组与笔记记录
- [x] 2.4 在 `note_handler.go` 中重构软删除逻辑（知识库删除时将文件夹解绑为独立文件夹、分组删除时将笔记解绑为未分组、文件夹删除时级联软删除组与笔记）
- [x] 2.5 修正模板 `ListTemplates` 与 `UpsertTemplate` 的正文格式化，避免 `[]byte` 输出为 Base64 乱码

## 3. 前端 API 层与死代码清理 (Frontend API Layer & Cleanup)
- [x] 3.1 彻底删除未被任何代码引用的废弃文件 `src/features/knowledge/api/knowledgeQueries.ts`
- [x] 3.2 规范化 `src/features/knowledge/api/templates.ts`，修复 Base64 容错解析，并让保存接口返回权威实体数据
- [x] 3.3 规范化 `src/features/knowledge/api/notes.ts` 与 `folders.ts`，修复调用方法与错误提示，清理过时的 Supabase / PostgREST 注释与遗留文案

## 4. 前端按需水合与导出保护 (Hydration on-demand & Export)
- [x] 4.1 在 `src/features/knowledge/components/KnowledgePanel.tsx` 中为复制笔记与存为模板添加按需正文加载（`ensureNoteLoaded`），防止克隆空白笔记或空模板
- [x] 4.2 在 `KnowledgePanel.tsx` 批量导出处注入 `knowledgeService.loadNote`，确保未打开过的笔记也能完整导出正文
- [x] 4.3 在 `src/features/knowledge/api/markdownIo.ts` 中为批量文件下载增加串行与延时保护，防止浏览器拦截弹窗

## 5. 编辑器输入打断与生命周期修复 (Editor Continuity & Debounce)
- [x] 5.1 改造 `NoteDrawerContent`，添加编辑实例保护：当处于同一笔记且为 Dirty 状态时禁止外部更新重置本地输入，仅在切换不同笔记时全量重置
- [x] 5.2 将抽屉编辑器的自动保存防抖延迟从 3000ms 优化为更敏捷的 1000ms，缩短草稿暴露窗口

## 6. 概念统一、孤儿免疫与选择器整合 (Naming, Immunity & Selectors)
- [x] 6.1 修正 `KnowledgePanel.tsx` 与 Hook 中的历史倒错文案（将遗留的“清单”等字样统一更正为“知识库/文件夹/分组/笔记”）
- [x] 6.2 增强 `KnowledgePanel.tsx` 的孤儿笔记兜底渲染：若笔记的 `groupId` 指向已删除分组，自动归入未分组视图展示，杜绝隐形消失
- [x] 6.3 统一使用 `knowledgeSelectors.ts` 集中派生列表与分组，消除组件内部重复的手写过滤逻辑
- [x] 6.4 修复自建模板 ID 为标准 UUID，解决 400 Bad Request 导致无法删除模板的问题

## 7. 全链路编译与交付验证 (Verification & Quality Assurance)
- [x] 7.1 执行 Go 编译检查：进入 `server/` 运行 `go build ./...`，确认后端无语法和编译错误
- [x] 7.2 执行前端类型检查与构建：在根目录运行 `pnpm build`，确保无类型和打包错误
- [x] 7.3 校验 OpenSpec 变更工件完整性：运行 `openspec validate fix-knowledge-base-core-logic-and-cleanup --json`
