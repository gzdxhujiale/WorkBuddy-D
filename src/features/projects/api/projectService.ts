import { apiClient } from "@/lib/apiClient";
import { saveRemoteTask, deleteRemoteTask, type SavedTaskVersion } from "@/lib/taskApi";
import { createProjectStageId, createTaskId } from "@/lib/entityIds";
import { DB_QUADRANT_MAP, type Task } from "@/types/task";
import type {
  Project,
  ProjectCenterData,
  ProjectStage,
  ProjectTemplate,
  ProjectTemplateDefinition,
  ProjectTask,
} from "../types";

const emptyDefinition: ProjectTemplateDefinition = { stages: [], tasks: [] };

function asTimestamp(value: string | number | null | undefined): number {
  if (!value) return Date.now();
  if (typeof value === "number") return value;
  return new Date(value).getTime();
}

export const projectApi = {
  async loadAll(_userId?: string): Promise<ProjectCenterData> {
    const [projectRows, stageRows, taskRows, templateRows] = await Promise.all([
      apiClient.get<any[]>("/api/v1/projects"),
      apiClient.get<any[]>("/api/v1/projects/stages"),
      apiClient.get<any[]>("/api/v1/tasks"),
      apiClient.get<any[]>("/api/v1/projects/templates"),
    ]);

    const projectTasks = (taskRows ?? []).filter((r) => r.project_id);

    return {
      projects: (projectRows ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description || undefined,
        status: row.status,
        startDate: row.start_date || undefined,
        endDate: row.end_date || undefined,
        priority: row.priority,
        tags: row.tags ?? [],
        ownerName: row.owner_name || undefined,
        createdAt: asTimestamp(row.created_at),
        updatedAt: asTimestamp(row.updated_at),
        lockVersion: Number(row.lock_version || 1),
      })) as Project[],
      stages: (stageRows ?? []).map((row) => ({
        id: row.id,
        projectId: row.project_id,
        name: row.name,
        defaultAssigneeName: row.default_assignee_name || undefined,
        sortOrder: row.sort_order ?? 0,
        templateKey: row.template_key || undefined,
        startDate: row.start_date || undefined,
        endDate: row.end_date || undefined,
        updatedAt: asTimestamp(row.updated_at),
        lockVersion: Number(row.lock_version || 1),
      })) as ProjectStage[],
      tasks: projectTasks.map((row) => ({
        id: row.id,
        title: row.title,
        quadrant: DB_QUADRANT_MAP[row.quadrant] ?? "Q2",
        scheduleMode: row.schedule_mode || undefined,
        scheduledStartAt: row.scheduled_start_at ? asTimestamp(row.scheduled_start_at) : undefined,
        scheduledEndAt: row.scheduled_end_at ? asTimestamp(row.scheduled_end_at) : undefined,
        completed: Boolean(row.completed),
        completedAt: row.completed_at ? asTimestamp(row.completed_at) : undefined,
        description: row.description || undefined,
        reminder: row.reminder ? (typeof row.reminder === "string" ? row.reminder : JSON.stringify(row.reminder)) : undefined,
        projectId: row.project_id,
        projectStageId: row.project_stage_id || undefined,
        priority: row.priority,
        assigneeName: row.assignee_name || undefined,
        sortOrder: Number(row.sort_order ?? 0),
        createdAt: asTimestamp(row.created_at),
        updatedAt: asTimestamp(row.updated_at),
        baseUpdatedAt: asTimestamp(row.updated_at),
        lockVersion: Number(row.lock_version || 1),
      })) as ProjectTask[],
      templates: (templateRows ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description || undefined,
        definition: (row.definition ?? emptyDefinition) as ProjectTemplateDefinition,
        updatedAt: asTimestamp(row.updated_at),
        lockVersion: Number(row.lock_version || 1),
      })) as ProjectTemplate[],
    };
  },

  async saveProject(project: Project): Promise<{ updatedAt: number; lockVersion: number }> {
    const saved = await apiClient.post<any>("/api/v1/projects", {
      id: project.id,
      name: project.name,
      description: project.description || null,
      status: project.status,
      start_date: project.startDate || null,
      end_date: project.endDate || null,
      priority: project.priority,
      tags: project.tags,
      owner_name: project.ownerName || null,
      lock_version: project.lockVersion ?? 1,
    });
    return {
      updatedAt: asTimestamp(saved.updated_at),
      lockVersion: Number(saved.lock_version || 1),
    };
  },

  async saveStage(stage: ProjectStage): Promise<{ updatedAt: number; lockVersion: number; sortOrder: number }> {
    const saved = await apiClient.post<any>("/api/v1/projects/stages", {
      id: stage.id,
      project_id: stage.projectId,
      name: stage.name,
      default_assignee_name: stage.defaultAssigneeName || null,
      sort_order: stage.sortOrder,
      template_key: stage.templateKey || null,
      start_date: stage.startDate || null,
      end_date: stage.endDate || null,
      lock_version: stage.lockVersion ?? 1,
    });
    return {
      updatedAt: asTimestamp(saved.updated_at),
      lockVersion: Number(saved.lock_version || 1),
      sortOrder: saved.sort_order ?? 0,
    };
  },

  async reorderStages(_projectId: string, stages: Array<Pick<ProjectStage, "id" | "sortOrder" | "lockVersion">>): Promise<Array<{ id: string; updatedAt: number; lockVersion: number; sortOrder: number }>> {
    if (stages.some((stage) => stage.lockVersion === undefined)) {
      throw new Error("项目阶段版本尚未加载，已阻止非条件排序");
    }
    const updated = await apiClient.post<any[]>("/api/v1/projects/stages/reorder", {
      items: stages.map((s) => ({ id: s.id, sort_order: s.sortOrder })),
    });
    return (updated ?? []).map((s) => ({
      id: s.id,
      updatedAt: asTimestamp(s.updated_at),
      lockVersion: Number(s.lock_version || 1),
      sortOrder: s.sort_order ?? 0,
    }));
  },

  async saveTemplate(template: ProjectTemplate): Promise<{ updatedAt: number; lockVersion: number }> {
    const saved = await apiClient.post<any>("/api/v1/projects/templates", {
      id: template.id,
      name: template.name,
      description: template.description || null,
      definition: template.definition,
      lock_version: template.lockVersion ?? 1,
    });
    return {
      updatedAt: asTimestamp(saved.updated_at),
      lockVersion: Number(saved.lock_version || 1),
    };
  },

  async createFromTemplate(project: Project, templateId: string): Promise<void> {
    await this.saveProject(project);
    const templates = await apiClient.get<any[]>("/api/v1/projects/templates");
    const tmpl = templates.find((t) => t.id === templateId);
    if (tmpl && tmpl.definition) {
      const stageKeyToIdMap = new Map<string, string>();
      if (Array.isArray(tmpl.definition.stages)) {
        for (let i = 0; i < tmpl.definition.stages.length; i++) {
          const s = tmpl.definition.stages[i];
          const stageId = createProjectStageId();
          if (s.key) {
            stageKeyToIdMap.set(s.key, stageId);
          }
          await this.saveStage({
            id: stageId,
            projectId: project.id,
            name: s.name,
            defaultAssigneeName: s.defaultAssigneeName || undefined,
            templateKey: s.key || undefined,
            sortOrder: i,
            updatedAt: Date.now(),
            lockVersion: 1,
          });
        }
      }
      if (Array.isArray(tmpl.definition.tasks)) {
        for (let i = 0; i < tmpl.definition.tasks.length; i++) {
          const t = tmpl.definition.tasks[i];
          const targetStageId = t.stageKey ? stageKeyToIdMap.get(t.stageKey) : undefined;
          const quad = (t.quadrant?.toUpperCase() as any) || "Q2";
          const validQuad = ["Q1", "Q2", "Q3", "Q4"].includes(quad) ? quad : "Q2";
          await this.saveTask({
            id: createTaskId(),
            title: t.title || "未命名任务",
            description: t.description || undefined,
            quadrant: validQuad,
            priority: t.priority || "medium",
            assigneeName: t.assigneeName || undefined,
            projectId: project.id,
            projectStageId: targetStageId,
            completed: false,
            sortOrder: i,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            lockVersion: 1,
          } as Task);
        }
      }
    }
  },

  async deleteTemplate(template: Pick<ProjectTemplate, "id" | "lockVersion">): Promise<void> {
    if (template.lockVersion === undefined) throw new Error("项目模板版本尚未加载，已阻止非条件删除");
    await apiClient.delete(`/api/v1/projects/templates/${template.id}`);
  },

  async deleteProject(project: Pick<Project, "id" | "lockVersion">): Promise<void> {
    if (project.lockVersion === undefined) throw new Error("项目版本尚未加载，已阻止非条件删除");
    await apiClient.delete(`/api/v1/projects/${project.id}`);
  },

  async deleteStage(stage: Pick<ProjectStage, "id" | "lockVersion">): Promise<void> {
    if (stage.lockVersion === undefined) throw new Error("项目阶段版本尚未加载，已阻止非条件删除");
    await apiClient.delete(`/api/v1/projects/stages/${stage.id}`);
  },

  saveTask(task: Task): Promise<SavedTaskVersion> {
    return saveRemoteTask(task);
  },

  deleteTask(task: Pick<Task, "id" | "lockVersion">): Promise<void> {
    return deleteRemoteTask(task);
  },
};
