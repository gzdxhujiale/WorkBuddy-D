# Design

## Context

知识库模块是一个多层树状组织架构（知识库 KnowledgeBase -> 文件夹 Folder -> 笔记分组 NoteGroup -> 富文本笔记 Note）。前端采用 TanStack Query 维护乐观客户端缓存，后端采用 Go Gin + PostgreSQL (sqlc) 提供持久化与 WebSocket 同步。

本次设计针对探索发现的 8 项核心逻辑漏洞、4 项历史包袱、4 项死代码和 3 项体验缺陷，制定严谨的前后端协同解决方案。

## Architecture & Technical Decisions

### 1. 无损部分更新与真实乐观锁控制（PatchNote & OCC）

- **问题**：旧有的 `PatchNote` 将未传字段绑定为空字符串 `""`，Postgres 中的 `COALESCE('', content)` 将笔记正文/标题清空；`PUT /notes/:id` 路由直接调用无条件 `UpsertNote`，绕过了版本校验。
- **解决方案**：
  - 在 `server/internal/database/queries/notes.sql` 中重构 `PatchNote`：
    ```sql
    -- name: PatchNote :one
    UPDATE notes
    SET title = CASE WHEN $3 = TRUE THEN $4 ELSE title END,
        content = CASE WHEN $5 = TRUE THEN $6 ELSE content END,
        sort_order = COALESCE($7, sort_order),
        folder_id = COALESCE($8, folder_id),
        group_id = CASE WHEN $9 = TRUE THEN $10 ELSE group_id END,
        lock_version = lock_version + 1,
        updated_at = now()
    WHERE id = $1 AND user_id = $2 AND lock_version = $11 AND deleted_at IS NULL
    RETURNING *;
    ```
  - 在 `note_handler.go` 中，根据 `req.Title != nil` 和 `req.Content != nil` 显式设置布尔标志（如 `hasTitle`, `hasContent`），仅当客户端显式传递该字段时才执行更新。
  - 在 `PUT /notes/:id` 路由中，正确接收 URL 中的 `:id`，解析请求体中的 `lock_version`，调用带锁版本控制的 `UpdateNote` 查询。若版本不匹配则返回 `409 StatusConflict`。

### 2. 文件夹深拷贝事务（DuplicateFolder Deep Clone）

- **问题**：`DuplicateFolder` 原先只复制了 `knowledge_base_folders` 表的单条记录，导致子内容全部丢失。
- **解决方案**：
  - 在 `note_handler.go` 中开启数据库事务 `tx`：
    1. 复制文件夹本身，生成新 UUID `newFolderID`，名称为 `req.NewName`；
    2. 查询源文件夹下的所有非删除 `folder_note_groups`；为每个分组生成新 UUID，插入新记录（指向 `newFolderID`），并在内存中构建 `oldGroupID -> newGroupID` 映射字典；
    3. 查询源文件夹下的所有非删除 `notes`；为每篇笔记生成新 UUID，插入新记录（指向 `newFolderID`，其 `group_id` 替换为映射后的 `newGroupID`，若原为 NULL 则保留 NULL）；
    4. 提交事务后，通过 WebSocket 广播该新文件夹插入事件，并向客户端返回完整的克隆结果。

### 3. 未 Hydrate 笔记按需正文加载（Hydration on-demand）

- **问题**：列表摘要笔记在初次加载时未携带正文（`contentLoaded: false`，`content: ""`）。用户直接在列表执行复制、存为模板或批量导出时，如果笔记未单独打开过，正文会丢失为空白。
- **解决方案**：
  - 在 `KnowledgePanel.tsx` 中封装统一的 `ensureNoteLoaded(note: Note): Promise<Note>`：
    ```typescript
    const ensureNoteLoaded = async (note: Note): Promise<Note> => {
      if (note.contentLoaded) return note;
      const full = await knowledgeService.loadNote(note.id);
      return full ?? note;
    };
    ```
  - 在 `handleDuplicateNote` 中先 `await ensureNoteLoaded(source)`，再以完整正文生成新笔记；
  - 在 `handleSaveAsTemplate` 中先 `await ensureNoteLoaded(note)`，再以完整正文调用 `addTemplate`；
  - 在 `handleBatchExport` 中，向 `exportNotesToMarkdown` 传入 `knowledgeService.loadNote`，对选中的每一篇未加载笔记先执行异步正文回填，再转换为 Markdown。

### 4. 批量导出下载防护

- **问题**：`saveMultipleMarkdownFiles` 通过紧凑循环并发触发 `link.click()`，导致浏览器拦截连续弹窗。
- **解决方案**：
  - 对循环下载增加异步延时或安全节流间隔（150ms），确保浏览器文件保存对话框或下载通道平稳处理每一个文件。

### 5. 软删除级联与前端孤儿免疫

- **后端处理**：
  - `SoftDeleteKnowledgeBase`：软删除知识库时，联动执行 `UPDATE knowledge_base_folders SET knowledge_base_id = NULL WHERE knowledge_base_id = $1 AND user_id = $2 AND deleted_at IS NULL;`，将下属文件夹降级为独立顶层文件夹保留，防止隐形蒸发；
  - `SoftDeleteFolderGroup`：软删除笔记分组时，联动执行 `UPDATE notes SET group_id = NULL WHERE group_id = $1 AND user_id = $2 AND deleted_at IS NULL;`，将组内笔记安全移出至未分组；
  - `SoftDeleteFolder`：软删除文件夹时，级联软删除内部的组与笔记。
- **前端防御**：
  - 在 `KnowledgePanel.tsx` 中，计算 `ungroupedNotes` 时增强判断：`notes.filter(n => !n.groupId || !groupMap.has(n.groupId))`，确保任何历史遗留的孤儿笔记都能稳定渲染在未分组区域，绝不丢失视野。

### 6. 模板 Base64 与 UUID 规范化

- **问题**：Go 将 `[]byte` 序列化为 Base64，前端临时 ID 格式非法无法删除。
- **解决方案**：
  - 后端在 `note_handler.go` 中，将模板 content 的序列化统一为可读字符串或纯 JSON 格式；前端 `api/templates.ts` 在拉取模板时增加健壮校验，若遇到 Base64 编码自动尝试解码；
  - 前端生成模板 ID 时统一调用 `crypto.randomUUID()`；
  - `remoteUpsertTemplate` 正确返回后端分配或确认的权威实体，客户端在创建后同步更新本地缓存，彻底消除 400 Bad Request。

### 7. 抽屉编辑器（NoteDrawerContent）生命周期与防抖保护

- **问题**：`NoteDrawerContent` 的依赖 Effect 会在用户打字期间因后台刷新被触发，强行覆写本地草稿。
- **解决方案**：
  - 维护 `editingNoteIdRef`：仅当 `note.id !== editingNoteIdRef.current` 时（即用户切换了另一篇笔记），才全量重置本地 `title` 和 `content`；
  - 若处于当前笔记且 `isDirtyRef.current === true`（用户正在编辑未提交），坚决忽略外部传入的旧快照，杜绝打字中断；
  - 将保存防抖延迟从 3000ms 调整为更紧凑的 1000ms，在降低网络压力的同时大幅缩小未提交草稿的暴露窗口。

### 8. 规范命名与技术债务清理

- **概念统一**：
  - 移除前端中将 KnowledgeBase 称为 folders、将 KnowledgeFolder 称为 lists 的倒错混乱代码；
  - 清除“清单”等已废弃的历史提示语，统一使用“知识库”、“文件夹”、“分组”、“笔记”标准术语；
- **清理冗余**：
  - 彻底删除 100% 未被引用的死代码文件 `src/features/knowledge/api/knowledgeQueries.ts`；
  - 移除后端未引用的死更新代码，清理过时的 Supabase / PostgREST 注释；
  - 统一调用 `knowledgeSelectors.ts` 集中派生数据，消除组件内重复的手写过滤代码。
