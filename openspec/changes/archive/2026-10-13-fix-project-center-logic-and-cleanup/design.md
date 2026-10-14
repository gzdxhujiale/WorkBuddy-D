# Design: 项目中心逻辑漏洞修复与架构精简

## Context

项目中心由前端展示层（`src/features/projects/`、`src/pages/ProjectsPage.tsx`）、乐观同步缓存层（`src/features/projects/hooks/useProjects.ts`、`src/features/time-management/hooks/useTimeManagement.ts`）与后端 Go Gin 处理器（`server/internal/handler/project_handler.go`、`server/internal/database/queries/projects.sql`）组成。

自向 Go 原生架构演进后，原 Supabase RPC 的部分级联和自动定序逻辑未完整迁移，导致软删除残留孤儿数据、模板任务遗失、新建阶段序号撞车以及乐观版本回写失效等问题。

## Goals / Non-Goals

**Goals:**
- 在 Go 后端与 SQL 层实现原子性级联软删除：删除项目时级联软删除所属阶段及项目任务；删除阶段时级联软删除所属任务；查询所有阶段时过滤已软删除项目的阶段。
- 阶段新建时具备确定性递增序号分配，消除看板无序错乱。
- 打通 `createFromTemplate` 的全量实例化链路，完整克隆模板中的阶段及任务，并建立 `stageKey` 到新生阶段 ID 的精确映射。
- 修复 `useProjects.ts` 缓存乐观回写判断，确保服务端最新 `lockVersion` 与 `updatedAt` 正确持久进 TanStack Query 缓存。
- 修复 `useTimeManagement.ts`，在任务解除项目关联时同步从项目中心缓存中清除。
- 修复 `ProjectsPage.tsx` 选中项目失效时的自动兜底选择。
- 彻底清理 `StageTaskPopover.tsx` 死组件、`ProjectGanttView.tsx` 无用 props、废弃 SQL 语句与双重命名防御。

**Non-Goals:**
- 不改变任务中心无项目/无阶段独立待办的既有定位：无阶段任务继续保持在阶段看板与甘特视图外的正常隔离行为。
- 不引入新的数据库表或破坏性数据库变更：充分复用现有 `deleted_at` 软删除字段与索引。

## Decisions

### 1. 级联软删除的 SQL 事务封装
* **决策**：在 `server/internal/database/queries/projects.sql` 中新增级联更新操作：
  - `SoftDeleteProject`：在单个事务内同时更新 `projects.deleted_at`、`project_stages.deleted_at`（`WHERE project_id = $1`）与 `time_management_tasks.deleted_at`（`WHERE project_id = $1`）。
  - `SoftDeleteProjectStage`：同时更新 `project_stages.deleted_at` 与 `time_management_tasks.deleted_at`（`WHERE project_stage_id = $1`）。
  - `ListAllProjectStages`：增加 `JOIN projects p ON p.id = project_stages.project_id` 且 `WHERE p.deleted_at IS NULL`，防止软删除项目的孤儿阶段泄漏给前端。
* **备选方案**：由应用层在 Go 处理器中发起 3 次单独查询。
  * *劣势*：无法保证事务原子性，且增加额外的网络往返。在 SQL/DB 事务中一次性完成更为健壮。

### 2. 新建阶段 `sort_order` 的确定性递增分配
* **决策**：在 Go 后端 `UpsertProjectStage` 中，当创建新阶段（非更新已有阶段）且传入的 `sort_order <= 0` 时，自动采用 `COALESCE((SELECT MAX(sort_order) FROM project_stages WHERE project_id = $1 AND deleted_at IS NULL), -1) + 1`；同时前端创建阶段时也以当前有效阶段数组长度（`selectedStages.length`）作为初始建议值，形成双重保证。
* **备选方案**：完全由前端计算。
  * *劣势*：多端并发或未完全加载时可能产生重复序号。服务端自动兜底最为可靠。

### 3. 项目模板实例化架构
* **决策**：在 `projectService.createFromTemplate` 中：
  1. 调用 `saveProject` 持久化项目；
  2. 遍历 `tmpl.definition.stages`，使用 `createProjectStageId()` 生成阶段 ID，并建立 `stageKeyMap: Map<string, string>`（`stageKey -> stageId`）；
  3. 批量持久化阶段；
  4. 遍历 `tmpl.definition.tasks`，使用 `createTaskId()` 生成任务 ID，并将 `projectStageId` 赋值为 `stageKeyMap.get(task.stageKey)`；
  5. 批量持久化模板任务，赋予项目 ID 与对应的阶段 ID，并使用规范的象限映射 `QUADRANT_DB_MAP`。

### 4. 客户端乐观锁版本号回写修复
* **决策**：在 `useProjects.ts` 的 `triggerSaveProject` 与 `triggerSaveTemplate` 中，移除错误的 `item.updatedAt === project.updatedAt` 比较，直接以 `item.id === project.id` 匹配并更新 `lockVersion: saved.lockVersion, updatedAt: saved.updatedAt`，与 `triggerSaveStage` 的成熟模式保持一致。

### 5. 跨模块缓存双向清理
* **决策**：在 `useTimeManagement.ts` 的 `syncTaskToProjects` 中：
  ```ts
  if (!task.projectId) {
    // 若任务已无项目归属，从项目中心 tasks 缓存中移除
    queryClient.setQueryData<ProjectCenterData>(PROJECTS_KEY, (old) =>
      old ? { ...old, tasks: old.tasks.filter((t) => t.id !== task.id) } : old
    );
    return;
  }
  ```

### 6. 死代码物理删除与命名清理
* **决策**：直接删除 `src/features/projects/components/StageTaskPopover.tsx`；清理 `ProjectGanttView.tsx` 中未使用的 `onSaveStage` 和 `onDeleteTask`；清理 `projectService.ts` 中的 `row.start_date || row.startDate` 蛇形/驼峰冗余防御；修正 `templateFormSchema` 中的象限大写。

## Risks / Trade-offs

- **[Risk] 级联软删除误伤任务** → **Mitigation**：所有 SQL 更新必须严格附带 `user_id = $2` 与 `project_id = $1` / `project_stage_id = $1` 双重约束。
- **[Risk] 模板任务创建时如果某些任务没有指定 stageKey** → **Mitigation**：默认绑定至模板的第一个生成阶段，确保任务不会失去阶段归属。
