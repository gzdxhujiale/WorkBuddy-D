# Proposal

## Why

知识库（Knowledge Base）是 WorkBuddy-D 桌面应用中用户沉淀结构化知识、会议纪要、项目文档与操作手册的核心基础资产。当前该模块存在多项直接威胁用户数据完整性与稳定性的严重缺陷：
1. **静默数据丢失与清空风险**：`PatchNote` 误将空字符串写入 `COALESCE` 导致在未加载正文时重命名笔记会永久抹除整篇笔记内容；克隆未展开正文的笔记或将其保存为模板时产生空白数据；批量导出 Markdown 时因缺失正文加载函数导致导出 0 字节空文件。
2. **结构复制与级联删除严重缺陷**：文件夹“创建副本”只复制空壳文件夹，丢弃所有内部笔记与分组；软删除知识库未解除关联文件夹，导致整批文件夹在 UI 侧永久“幽灵隐藏”；软删除分组未解绑笔记，导致组内笔记在前端完全不可见；文件夹复制缺乏深拷贝事务。
3. **模板系统破损**：模板正文因 Go 的 `[]byte` 序列化为 Base64 乱码；前端采用非标准 `tpl-${Date.now()}` 格式 ID 导致后端返回 400，用户自建模板永久无法删除。
4. **编辑器输入打断与并发冲突**：抽屉编辑器 Effect 盲目监听笔记快照变化，在 3000ms 慢防抖下，后台广播或刷新会无情重置并抹除用户正在输入的最新文字；后端 `PUT /notes/:id` 绕过乐观锁，OCC 并发控制形同虚设。
5. **历史技术债务与概念倒错**：代码深度残留早期待办清单时代的命名（KnowledgeBase 被称为 folder，KnowledgeFolder 被称为 list，NoteGroup 被称为 list-group，前端充斥“删除清单”、“移动清单”等错误提示）；存在 100% 未引用的死代码文件（`knowledgeQueries.ts`）、闲置的 OCC SQL 查询与重复的选择器。

通过本次变更，我们将全链路修复 8 项核心逻辑漏洞、清理 4 项兼容包袱与 4 项死代码，并优化 3 项交互体验缺陷。

## What Changes

1. **修复 `PatchNote` 与数据覆写防御**：
   - 重构后端 `PatchNote` SQL 与 Go Handler，区分“字段未提供”与“字段修改为空”，杜绝将正文或标题误清空；
   - 恢复 `PUT /notes/:id` 真正的乐观并发控制（OCC），绑定 `:id` 并强制校验 `lock_version`，淘汰盲目 upsert。
2. **文件夹深拷贝与完整克隆（`DuplicateFolder`）**：
   - 后端使用数据库事务完整深拷贝目标文件夹及其所属的全部笔记分组（`folder_note_groups`）和笔记（`notes`），维护新旧 UUID 映射并广播新增实体。
3. **未 Hydrate 笔记按需正文加载（Hydration on-demand）**：
   - 在笔记列表右键“复制笔记”、顶部菜单“保存为模板”、批量“导出 Markdown”时，若笔记正文尚未加载（`contentLoaded: false`），自动异步按需加载完整正文，确保克隆出的笔记、生成的模板和导出的 Markdown 100% 保留内容。
4. **批量导出优化与下载保护**：
   - 批量导出时完整注入 `knowledgeService.loadNote`；对多个 Markdown 文件的保存增加防抖间隔与串行保护，防止浏览器拦截连续下载弹窗。
5. **软删除级联与防隐形修复**：
   - 后端软删除知识库时将子文件夹 `knowledge_base_id` 置 NULL，作为独立文件夹保留，坚决杜绝“幽灵隐藏”；
   - 软删除笔记分组时将组内笔记 `group_id` 置 NULL，自动平退为未分组笔记；
   - 软删除文件夹时级联软删除内部的分组与笔记；
   - 前端增加兜底容错：孤儿笔记（指向已删除分组）自动归入未分组视图。
6. **模板 Base64 修复与 UUID 规范化**：
   - 统一模板正文传输格式，杜绝 Base64 乱码；
   - 前端创建模板采用标准 UUID（`crypto.randomUUID()`），保存后正确接收权威 ID，彻底修复自建模板无法删除（400 Bad Request）的缺陷。
7. **编辑器输入体验与状态保护**：
   - 改造 `NoteDrawerContent`，草稿处于 Dirty 状态时禁止外部快照重置本地输入；仅在切换不同笔记 ID 时重置编辑器；
   - 将自动保存防抖从 3000ms 优化为更敏捷的 1000ms。
8. **清理历史包袱与概念统一**：
   - 统一前后端概念为 `knowledgeBase`（知识库）、`folder`（文件夹）、`noteGroup`（笔记分组）、`note`（笔记）；
   - 清除“清单”等历史遗例文案，更新为清晰的知识库用语；
   - 移除已废弃的死代码文件 `src/features/knowledge/api/knowledgeQueries.ts`；
   - 移除后端闲置的死更新代码，清理过时的 Supabase / PostgREST 假注释。

## Capabilities

### New Capabilities
- `knowledge-base`: 提供稳定安全、层级清晰的个人知识库系统，包含知识库、文件夹、笔记分组与富文本笔记的多层级管理，支持可靠的深拷贝克隆、按需加载的 Markdown 导入导出、自定义笔记模板及无打断的富文本编辑。

### Modified Capabilities
<!-- 无现有规格需要修改 -->

## Impact

- **后端代码**：
  - `server/internal/database/queries/notes.sql`
  - `server/internal/database/sqlc/notes.sql.go`
  - `server/internal/database/sqlc/models.go`
  - `server/internal/handler/note_handler.go`
  - `server/cmd/server/main.go`
- **前端代码**：
  - `src/features/knowledge/types/index.ts`
  - `src/features/knowledge/api/types.ts`
  - `src/features/knowledge/api/notes.ts`
  - `src/features/knowledge/api/folders.ts`
  - `src/features/knowledge/api/templates.ts`
  - `src/features/knowledge/api/markdownIo.ts`
  - `src/features/knowledge/api/knowledgeService.ts`
  - `src/features/knowledge/api/knowledgeQueries.ts`（移除）
  - `src/features/knowledge/hooks/useKnowledgeQuery.ts`
  - `src/features/knowledge/components/KnowledgePanel.tsx`
  - `src/features/knowledge/components/KnowledgeTemplateDialog.tsx`
  - `src/features/knowledge/utils/knowledgeSelectors.ts`
