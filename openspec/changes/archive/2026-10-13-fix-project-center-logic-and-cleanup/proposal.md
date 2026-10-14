# Proposal: 修复项目中心核心逻辑漏洞并清理历史包袱与死代码

## Why

项目中心（Project Center）在经历从 Supabase 向 Go 原生后端的演进后，数据持久层、乐观缓存同步机制与模板实例化链路中遗留了多个隐蔽的逻辑漏洞。具体表现为：项目与阶段软删除缺乏后端级联、模板实例化完全丢弃了模板任务、阶段新建时排序号全为 0 导致看板乱序、乐观锁版本号回写条件恒假导致前端缓存版本失真，以及任务解绑项目时项目中心缓存单向滞留泄漏等。同时，工程内还残留了未引用的死组件（如 `StageTaskPopover.tsx`）、无用 props 以及废弃的 SQL 查询与双重命名防御。

修复这些缺陷不仅能彻底保障项目中心数据的级联一致性与并发安全，还能打通项目模板任务的完整实例化流程，并精简冗余代码。

## What Changes

- **后端事务性级联软删除**：在 Go 后端与 SQL 查询层中，完善 `SoftDeleteProject`（级联软删除关联的所有阶段与属于该项目的任务）与 `SoftDeleteProjectStage`（级联软删除属于该阶段的任务），并在 `ListAllProjectStages` 中排查排除已软删除项目的孤儿阶段。
- **阶段排序递增分配**：修复新建阶段时 `sort_order` 全为 0 的乱序缺陷，由后端或创建逻辑自动分配 `COALESCE(MAX(sort_order), -1) + 1`，保证阶段新建与看板展示顺序稳定一致。
- **项目模板完整实例化**：修复 `createFromTemplate` 只拷贝阶段而丢失任务的缺陷。在创建项目时，解析模板中的 `stages` 与 `tasks`，自动生成符合 ID 规范的阶段与任务，并将任务中的 `stageKey` 精确映射为新建阶段的 ID，实现阶段与任务的全量自动化生成。
- **修复乐观锁版本缓存回写**：修复 `useProjects.ts` 中 `item.updatedAt === project.updatedAt` 的恒假匹配判断，使服务端返回的最新 `lockVersion` 和 `updatedAt` 能正确持久同步到 TanStack Query 缓存中。
- **修复项目取消关联时的双向缓存同步**：修复 `useTimeManagement.ts` 中 `syncTaskToProjects` 在任务移除项目关联（`!task.projectId`）时直接 return 的缺陷，确保任务从项目解绑后能立即从项目中心缓存中同步移除。
- **选中项目丢失时的自动兜底**：修复 `ProjectsPage.tsx` 中当已选项目被删除或在当前状态筛选下不存在时，主视图死锁在空白占位的问题，自动回退选中首个有效项目。
- **明确无阶段任务的边界定义**：确立规则——任务中心创建的无项目、无阶段独立任务不属于项目中心阶段看板与单体甘特图的管理范畴；阶段看板与甘特图仅聚焦呈现归属于具体阶段的推进事项。
- **死代码与历史包袱彻底清理**：
  - 彻底删除已无任何引用的 `StageTaskPopover.tsx`（-339 行）；
  - 清理 `ProjectGanttView.tsx` 中未解构未使用的冗余 props（`onSaveStage`, `onDeleteTask`）；
  - 清理 `projects.sql` 中未被 Go 处理器使用的废弃查询（`GetProjectByID`, `CreateProject`, `UpdateProject`, `CreateProjectStage`, `ListProjectStages`）；
  - 清理 `projectService.ts` 中蛇形/驼峰多重防御读取的冗余兼容代码；
  - 修正 `projectSchemas.ts` 中 `templateFormSchema` 默认象限小写 `"q2"` 为系统标准大写 `"Q2"`。

## Capabilities

### New Capabilities
- `project-management-center`: 规定项目中心的端到端行为规范，包括项目与阶段的创建与排序、模板阶段与任务实例化、基于阶段的任务看板与甘特流转、级联软删除保证与跨模块缓存实时同步。

### Modified Capabilities
（无。现有 `task-management-center`、`task-quick-edit` 与 `today-workbench` 行为保持既有规约不变。）

## Impact

- **前端影响**：
  - `src/features/projects/api/projectService.ts`：模板全量实例化逻辑与字段映射；
  - `src/features/projects/hooks/useProjects.ts`：乐观更新回写匹配逻辑；
  - `src/features/projects/components/ProjectGanttView.tsx`：清除无用 props 与日期类型；
  - `src/features/projects/components/StageTaskPopover.tsx`：彻底删除无用死组件；
  - `src/features/projects/schemas/projectSchemas.ts`：修复 quadrant 默认值；
  - `src/features/time-management/hooks/useTimeManagement.ts`：解除项目关联时的双向缓存清理；
  - `src/pages/ProjectsPage.tsx`：兜底选中逻辑优化与清理。
- **后端影响**：
  - `server/internal/database/queries/projects.sql`：级联软删除 SQL 与阶段自动排序查询；
  - `server/internal/database/sqlc/projects.sql.go`：重新生成 sqlc 代码；
  - `server/internal/handler/project_handler.go`：事务性级联删除与阶段排序处理。
