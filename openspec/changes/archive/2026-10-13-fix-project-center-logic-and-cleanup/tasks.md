# Tasks

## 1. 数据库持久化与级联软删除修复 (Backend & SQL Cascade)

- [x] 1.1 在 `server/internal/database/queries/projects.sql` 中重构 `SoftDeleteProject` 与 `SoftDeleteProjectStage`，支持原子级联软删除关联 stages 与 tasks，并在 `ListAllProjectStages` 中过滤已软删除项目的孤儿阶段，通过 SQL 语法验证
- [x] 1.2 在 `server/internal/database/queries/projects.sql` 中清理未被引用的废弃 SQL 查询（`GetProjectByID`, `CreateProject`, `UpdateProject`, `CreateProjectStage`, `ListProjectStages`）
- [x] 1.3 同步更新 `server/internal/database/sqlc/projects.sql.go` 与 `server/internal/handler/project_handler.go`，适配级联删除与阶段排序递增分配，运行 `go build ./...` 验证编译通过

## 2. 前端缓存同步与乐观锁修复 (Client Optimistic Sync & Cache Consistency)

- [x] 2.1 修复 `src/features/projects/hooks/useProjects.ts` 中的 `triggerSaveProject` 与 `triggerSaveTemplate`，移除恒假的 `updatedAt` 时间戳比较，使服务端返回的 `lockVersion` 正常回写至本地缓存并通过类型检查
- [x] 2.2 清理 `src/features/projects/hooks/useProjects.ts` 中 `saveTask` 对 `queryClient.setQueryData<TimeManagementData>` 的冗余双重调用
- [x] 2.3 在 `src/features/time-management/hooks/useTimeManagement.ts` 的 `syncTaskToProjects` 中补充任务解绑项目时的项目中心缓存清除逻辑
- [x] 2.4 在 `src/pages/ProjectsPage.tsx` 中完善选中项目失效（被删除或筛选过滤）时的自动兜底选择逻辑

## 3. 模板全量实例化与阶段定序 (Template Full Instantiation & Stage Order)

- [x] 3.1 在 `src/features/projects/api/projectService.ts` 中重构 `createFromTemplate`，完整实现阶段与模板任务的自动化克隆及 `stageKey` ID 映射，并使用标准 `createProjectStageId` 与 `createTaskId`
- [x] 3.2 优化 `src/pages/ProjectsPage.tsx` 与 `src/features/projects/components/ProjectStageBoard.tsx` 中添加阶段的初始 `sortOrder`，避免所有新阶段均为 0 的冲突
- [x] 3.3 修正 `src/features/projects/schemas/projectSchemas.ts` 中 `templateFormSchema` 的 `quadrant` 默认值为标准大写 `"Q2"`

## 4. 死代码与历史包袱彻底清理 (Dead Code & Baggage Elimination)

- [x] 4.1 物理删除完全无引用的孤立死组件 `src/features/projects/components/StageTaskPopover.tsx` 并验证工程中无残留引用
- [x] 4.2 清理 `src/features/projects/components/ProjectGanttView.tsx` 中未解构未使用的冗余 props（`onSaveStage`, `onDeleteTask`）并在 `ProjectsPage.tsx` 调用点同步移除
- [x] 4.3 清理 `src/features/projects/api/projectService.ts` 中蛇形/驼峰多重防御读取代码与未使用的参数
- [x] 4.4 运行 `pnpm build` 与 `openspec validate`，验证全仓前端类型检查与 OpenSpec 规范校验 100% 通过
