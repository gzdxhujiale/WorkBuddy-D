# Spec Delta

## Purpose

提供稳定安全、层级清晰的个人知识库系统，涵盖知识库（Knowledge Base）、文件夹（Folder）、笔记分组（Note Group）与富文本笔记（Note）的多层级管理，保障在部分更新、深拷贝、软删除级联、模板应用、批量导出与多端编辑全链路中的数据完整性与零丢失。

## ADDED Requirements

### Requirement: Lossless Partial Update and Optimistic Concurrency Control
系统在部分更新笔记属性（如标题、排序或所属分组）或全量更新笔记内容时，SHALL 严格保持未提供字段的原有数据，严禁将未传字段覆写为空字符串；在更新已有笔记时，SHALL 强制校验 `lock_version`，在发生版本冲突时拒绝写入。

#### Scenario: Renaming note in sidebar preserves unhydrated content
- **WHEN** 用户在侧边栏对尚未在编辑器中加载正文的笔记进行重命名或移动
- **THEN** 后端仅更新标题或层级属性，原笔记正文数据保持完好，不得被置为空字符串

#### Scenario: Concurrent note edit detects version conflict
- **WHEN** 客户端提交笔记更新时携带的 `lock_version` 与服务端现有版本不匹配
- **THEN** 服务端返回 409 Conflict，前端提示版本冲突并阻止静默数据覆盖

### Requirement: Deep Folder Duplication
系统在复制文件夹时，SHALL 采用数据库事务深拷贝文件夹本身及其包含的所有笔记分组与笔记记录，保持组内映射关系完好。

#### Scenario: Duplicating folder clones all child groups and notes
- **WHEN** 用户对包含多个分组和多篇笔记的文件夹发起复制副本操作
- **THEN** 服务端原子化创建新文件夹，并在新文件夹下为所有原分组和笔记建立完整副本，正文内容与分组归属关系 100% 保留

### Requirement: On-Demand Hydration for Note Operations
系统在对未加载正文的笔记进行复制、存为模板或批量导出时，SHALL 自动按需异步拉取完整笔记正文，严禁生成空白副本、空模板或 0 字节文件。

#### Scenario: Duplicating unhydrated note from list creates non-empty clone
- **WHEN** 用户在笔记列表右键复制一篇尚未单独打开过的笔记
- **THEN** 系统自动在后台按需加载该笔记的完整正文，生成包含完整内容的新笔记副本

#### Scenario: Batch exporting markdown preserves full contents
- **WHEN** 用户在批量导出弹窗中选择多篇未在当前会话打开过的笔记并点击确认导出
- **THEN** 系统自动拉取各篇笔记的完整正文，转换为有效的 Markdown 文件并串行安全触发保存，避免导出空白文件或遭浏览器并发拦截

### Requirement: Cascade Soft Deletion and Orphan Immunity
系统在软删除知识库或笔记分组时，SHALL 级联更新关联实体的外键归属；前端在渲染层 SHALL 具备孤儿实体免疫兜底，防止数据因外键失效而在 UI 上隐形蒸发。

#### Scenario: Deleting knowledge base converts folders to standalone
- **WHEN** 用户软删除某个知识库
- **THEN** 该知识库下的全部文件夹的关联 `knowledge_base_id` 被置空作为独立文件夹保留，在页面刷新后依然完整可见，绝不隐形消失

#### Scenario: Deleting folder group converts notes to ungrouped
- **WHEN** 用户删除某个笔记分组
- **THEN** 该分组下的全部笔记的 `group_id` 被置空作为未分组笔记保留，在界面中平滑迁移至未分组区域

### Requirement: Template Payload Integrity and Valid Entity Identifiers
系统在管理知识库模板时，SHALL 采用标准 JSON 序列化格式保持内容可读，并在客户端和服务端全局使用符合 RFC 4122 标准的 UUID，确保模板的创建、应用和删除全生命周期顺畅无阻。

#### Scenario: Applying and deleting custom template succeeds without errors
- **WHEN** 用户将笔记保存为新模板并随后在模板管理弹窗中将其删除
- **THEN** 模板以标准 UUID 与可读文本存储，应用模板创建笔记内容无 Base64 乱码，删除模板成功执行且无 400 校验异常

### Requirement: Interruption-Free Drawer Editor Lifecycle
系统在抽屉富文本编辑器中，SHALL 保护用户当前处于 Dirty 状态的输入草稿，严禁由于外部查询刷新或 WebSocket 广播而导致正在键入的内容被旧快照强行重置。

#### Scenario: Background sync does not overwrite active draft typing
- **WHEN** 用户在抽屉中持续键入文本，且此时触发了后台数据刷新或网络响应返回
- **THEN** 正在编辑的标题与正文草稿不受重置影响，用户输入焦点与光标保持平稳
