# Spec Delta

## Purpose

提供稳定可靠的每日复盘全流程能力，涵盖数据持久化与真实乐观并发控制、富文本结构保护、平滑无缝的自动保存生命周期，以及严谨精确的打卡连击（Streak）与字数热力图统计。

## ADDED Requirements

### Requirement: Schema-aligned Daily Review Persistence
系统在查询和持久化复盘记录时，SHALL 仅依据实际数据库表结构进行操作，不得在查询条件中使用未定义的字段（如 deleted_at）。

#### Scenario: List user daily reviews successfully
- **WHEN** 客户端请求加载当前用户的复盘列表
- **THEN** 服务端直接根据 `user_id` 查询所有复盘记录并按日期倒序返回，不触发字段不存在的数据库异常

### Requirement: Optimistic Concurrency Control and ID Synchronization
系统在保存每日复盘时，SHALL 维护 `lock_version`，并在更新成功后返回完整的实体数据（包含权威 ID、更新时间和锁版本号），供前端同步本地缓存。

#### Scenario: Upsert review updates lock version and returns authoritative entity
- **WHEN** 客户端提交特定日期的复盘更新
- **THEN** 服务端原子化保存内容并将 `lock_version` 自增，返回包含真实 `id`、最新 `updated_at` 与 `lock_version` 的完整实体

### Requirement: Rich Text Content Integrity Protection
系统在工作台或外部入口展示或快捷操作每日复盘时，SHALL 保护已存在的 Tiptap 富文本结构，严禁单行扁平纯文本直接覆盖销毁富文本文档。

#### Scenario: Interacting with review from Today Workbench prevents overwrite
- **WHEN** 今日已有包含多段或富文本排版的复盘记录，且用户在今日工作台查看或操作
- **THEN** 系统保护既有富文本结构，不得通过单行输入框直接全量覆写原有文档

### Requirement: Stable Editor Lifecycle and Input Continuity
系统在每日复盘编辑器中，SHALL 采用基于日期的稳定生命周期标识，在自动保存完成并回填服务端 ID 时保持编辑器实例活跃，不得销毁重建。

#### Scenario: Auto-save does not interrupt active typing
- **WHEN** 用户在新的一天首次撰写复盘触发自动保存，且服务端返回持久化 ID
- **THEN** 编辑器组件持续挂载，用户的输入焦点、光标位置和输入法组合状态保持连续

### Requirement: Accurate Streak and Character Heatmap Statistics
系统在统计连续复盘天数（Streak）与日历字数热力图时，SHALL 递归判定多段落空文档、基于剔除语法标签后的纯文字符数评估热力等级，并过滤未来日期。

#### Scenario: Empty blocks do not count towards streak
- **WHEN** 用户保存的复盘文档仅包含空白回车段落或空节点
- **THEN** 系统判定该复盘为空，不将其计入连续打卡天数与总篇数

#### Scenario: Heatmap reflects real text volume rather than JSON tokens
- **WHEN** 计算特定日期打卡格子的字数热力等级
- **THEN** 系统提取纯文本文字计算字符数，避免 Tiptap JSON 语法标签导致短文被错误呈现为长文热力色
