# Design

## Context

在现有架构中，`time_management_tasks` 是全系统任务的唯一事实源，通过 `project_id` 与 `project_stage_id` 关联至项目和阶段。前端 `ProjectStageBoard` 按 `projectStageId` 对任务进行静态分组展示。

本设计基于现有架构演进，不改变四象限与今日待办的核心查询机制，通过向任务模型补充轻量级的阶段流转历史元数据（`stageHistory`）、构建阶段推进与回退状态机，并引入基于 Tiptap TaskList 的模态管理弹窗与上下文菜单交互。

## Goals / Non-Goals

**Goals:**
- 实现非末尾阶段勾选任务时的静默工序自动流转，并在上一阶段呈现只读完成历史快照。
- 自动流转时静默对齐下一阶段的默认负责人（`defaultAssigneeName`）与起止排期。
- 提供“退回上一阶段”与右键菜单“直接标记完成”两条快速逃逸路径。
- 实现每个阶段的 Tiptap TaskList 模态管理弹窗，支持回车批量录入、退格删除与双向 Diff 同步。
- 只有在末尾阶段勾选或右键直接完成时，才触发系统级 `completed: true` 并影响项目总完成度。

**Non-Goals:**
- 不支持分支流（如根据条件流向阶段 A 或阶段 B），严格遵循线性的 `sortOrder` 阶段顺序。
- 不引入跨项目任务流转。
- 不在阶段内维护无限版本的复杂快照内容，快照仅记录阶段完成时间戳与阶段标识。

## Decisions

### 决策一：使用任务内的 `stageHistory` 数组记录快照，而非生成孤立的重复任务行

- **方案对比**：
  - *方案 A（生成影子副本）*：任务流转到阶段 2 时，在阶段 1 插入一条复制的已完成影子任务记录。
    - *缺点*：造成数据库任务实体冗余、污染今日待办与四象限统计，且后续修改任务标题时影子数据产生分叉，回退难以清理。
  - *方案 B（选定：单一实体 + `stageHistory` 元数据）*：任务始终保持单一行实体，其字段中携带 `stageHistory: Array<{ stageId: string, completedAt: number }>`。
    - *收益*：
      1. 任务唯一事实源，流转仅改变 `projectStageId` 与追加 `stageHistory`；
      2. 阶段 1 在渲染时，自动检索 `task.projectStageId === stage1.id`（当前活跃任务）及 `stageHistory.some(h => h.stageId === stage1.id)`（历史快照任务），快照以灰色删除线及“已流转”标签展示；
      3. 回退操作极其简洁：仅需将 `projectStageId` 置回前置阶段，并从 `stageHistory` 中移除对应项；
      4. 统一由单一 `lock_version` 控制并发。

### 决策二：工序流转状态机（Stage Flow State Machine）

```
[任务新建于 Stage 1] ──(勾选)──▶ [Stage 1 记录快照, Stage 2 生成活跃任务]
                                           │
                                         (勾选)
                                           │
                                           ▼
[项目完成度更新, 归档] ◀──(勾选)─── [Stage 3: 最终阶段]
          ▲                                │
          │                               (右键菜单)
          └─────────────(直接完成)──────────┘
```

1. **非末尾阶段勾选（Stage `i < N-1`）**：
   - 将 `{ stageId: currentStage.id, completedAt: Date.now() }` 追加至 `stageHistory`。
   - `projectStageId` 更新为 `stages[i+1].id`。
   - `completed` 保持 `false`（待办），`completedAt` 为空。
   - 若下个阶段存在 `defaultAssigneeName`，则将 `assigneeName` 覆盖为该负责人员。
   - 若下个阶段存在 `startDate`/`endDate`，则将任务 scheduled 字段自动对齐。
2. **末尾阶段勾选（Stage `i == N-1`）**：
   - `completed` 设置为 `true`，`completedAt = Date.now()`。
   - 触发项目整体完成度（100% / 比例）及今日待办已完成统计。
3. **右键菜单“直接标记完成”**：
   - 在任何阶段的右键菜单中选择“直接标记完成”，直接将 `completed` 置为 `true`，跳过后续所有未执行阶段。
4. **卡片菜单“退回上一阶段”（Stage `i > 0`）**：
   - 弹出确认或直接执行：将 `projectStageId` 改回 `stages[i-1].id`。
   - 从 `stageHistory` 剔除 `stages[i-1].id` 的记录。
   - 恢复对应前置阶段的负责人与排期。

### 决策三：StageTaskManagerModal（Tiptap 模态编辑器与 Diff 同步）

- **弹窗形式**：在阶段卡片操作区增加“管理任务”按钮，点击打开居中 Modal。
- **文档模型**：基于 Tiptap 预置的 `TaskList` 和 `TaskItem` 扩展构建，每个 item 的 HTML 属性记录 `data-task-id`。
- **Diff 算法**：
  - 遍历当前编辑器产生的文档节点：
    - 带有效 `data-task-id` 且标题变动：加入 `updateTasks`。
    - 带有效 `data-task-id` 且勾选状态改变：若在模态中勾选，触发前述流转/完成逻辑。
    - 无 `data-task-id` 的新增项：生成全新 `taskId`，填充默认属性并加入 `createTasks`。
  - 对比原阶段任务集合：
    - 原活跃任务中在编辑器里被完全移除（整行删除）的项：加入 `deleteTaskIds`。
  - 点击“保存”时批量通过 `useProjectActions` 执行原子批处理提交。

## Risks / Trade-offs

- **[风险] 批量 Diff 保存时并发版本冲突（Optimistic Lock Collision）**
  - *缓解*：在提交更新时提交当前最新的 `lock_version`，若发生冲突则提示用户“任务已被修改，已刷新最新内容”，避免静默覆盖。
- **[风险] 用户在阶段内既看到历史快照又看到活跃任务产生认知混淆**
  - *缓解*：历史快照使用专属的“已流转”标识弱化呈现，禁止在快照卡片上重复流转，仅允许点击查看或在活跃卡片上触发退回。
- **[风险] Tiptap 序列化多行富文本可能丢失纯文本换行**
  - *缓解*：TaskItem 严格约束为单行标题解析，多行内容通过回车自然切割为多条独立任务待办。
