import { supabase } from "@/lib/supabase";
import { throwOnPostgrestError } from "@/lib/sync";
import { timeManagementApi } from "@/services/timeManagementService";
import { DB_QUADRANT_MAP, type Task } from "@/types/timeManagement";
import type {
  Project,
  ProjectCenterData,
  ProjectStage,
  ProjectTemplate,
  ProjectTemplateDefinition,
  ProjectTask,
} from "@/types/projects";

const emptyDefinition: ProjectTemplateDefinition = { stages: [], tasks: [] };

function asTimestamp(value: string | null | undefined): number {
  return value ? new Date(value).getTime() : Date.now();
}

export const projectApi = {
  async loadAll(userId: string): Promise<ProjectCenterData> {
    const [projectResult, stageResult, taskResult, templateResult] = await Promise.all([
      supabase.from("projects").select("id,name,description,status,start_date,end_date,priority,tags,owner_name,created_at,updated_at,lock_version").eq("user_id", userId).is("deleted_at", null).order("updated_at", { ascending: false }),
      supabase.from("project_stages").select("id,project_id,name,default_assignee_name,sort_order,template_key,start_date,end_date,updated_at,lock_version").eq("user_id", userId).is("deleted_at", null).order("sort_order"),
      supabase.from("time_management_tasks").select("id,title,quadrant,schedule_mode,scheduled_start_at,scheduled_end_at,completed,completed_at,description,reminder,project_id,project_stage_id,priority,assignee_name,sort_order,created_at,updated_at,lock_version").eq("user_id", userId).is("deleted_at", null).not("project_id", "is", null).order("sort_order", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("project_templates").select("id,name,description,definition,updated_at,lock_version").eq("user_id", userId).is("deleted_at", null).order("updated_at", { ascending: false }),
    ]);
    throwOnPostgrestError(projectResult.error, "加载项目");
    throwOnPostgrestError(stageResult.error, "加载项目阶段");
    throwOnPostgrestError(taskResult.error, "加载项目任务");
    throwOnPostgrestError(templateResult.error, "加载项目模板");

    return {
      projects: (projectResult.data ?? []).map((row) => ({
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
        lockVersion: Number(row.lock_version),
      })) as Project[],
      stages: (stageResult.data ?? []).map((row) => ({
        id: row.id,
        projectId: row.project_id,
        name: row.name,
        defaultAssigneeName: row.default_assignee_name || undefined,
        sortOrder: row.sort_order,
        templateKey: row.template_key || undefined,
        startDate: row.start_date || undefined,
        endDate: row.end_date || undefined,
        updatedAt: asTimestamp(row.updated_at),
        lockVersion: Number(row.lock_version),
      })) as ProjectStage[],
      tasks: (taskResult.data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        quadrant: DB_QUADRANT_MAP[row.quadrant] ?? "Q2",
        scheduleMode: row.schedule_mode || undefined,
        scheduledStartAt: row.scheduled_start_at ? asTimestamp(row.scheduled_start_at) : undefined,
        scheduledEndAt: row.scheduled_end_at ? asTimestamp(row.scheduled_end_at) : undefined,
        completed: Boolean(row.completed),
        completedAt: row.completed_at ? asTimestamp(row.completed_at) : undefined,
        description: row.description || undefined,
        reminder: row.reminder ? JSON.stringify(row.reminder) : undefined,
        projectId: row.project_id,
        projectStageId: row.project_stage_id || undefined,
        priority: row.priority,
        assigneeName: row.assignee_name || undefined,
        sortOrder: Number(row.sort_order),
        createdAt: asTimestamp(row.created_at),
        updatedAt: asTimestamp(row.updated_at),
        baseUpdatedAt: asTimestamp(row.updated_at),
        lockVersion: Number(row.lock_version),
      })) as ProjectTask[],
      templates: (templateResult.data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description || undefined,
        definition: (row.definition ?? emptyDefinition) as ProjectTemplateDefinition,
        updatedAt: asTimestamp(row.updated_at),
        lockVersion: Number(row.lock_version),
      })) as ProjectTemplate[],
    };
  },

  async saveProject(project: Project): Promise<{ updatedAt: number; lockVersion: number }> {
    const { data, error } = await supabase.rpc("save_project_v2", {
      p_id: project.id,
      p_name: project.name,
      p_description: project.description || null,
      p_status: project.status,
      p_start_date: project.startDate || null,
      p_end_date: project.endDate || null,
      p_priority: project.priority,
      p_tags: project.tags,
      p_owner_name: project.ownerName || null,
      p_expected_lock_version: project.lockVersion ?? null,
    });
    throwOnPostgrestError(error, "保存项目");
    const saved = (data as Array<{ updated_at: string; lock_version: number }>)[0];
    return { updatedAt: asTimestamp(saved.updated_at), lockVersion: Number(saved.lock_version) };
  },

  async saveStage(stage: ProjectStage): Promise<{ updatedAt: number; lockVersion: number; sortOrder: number }> {
    const { data, error } = await supabase.rpc("save_project_stage_v2", {
      p_id: stage.id,
      p_project_id: stage.projectId,
      p_name: stage.name,
      p_default_assignee_name: stage.defaultAssigneeName || null,
      p_sort_order: stage.sortOrder,
      p_template_key: stage.templateKey || null,
      p_start_date: stage.startDate || null,
      p_end_date: stage.endDate || null,
      p_expected_lock_version: stage.lockVersion ?? null,
    });
    throwOnPostgrestError(error, "保存项目阶段");
    const saved = (data as Array<{ updated_at: string; lock_version: number; sort_order: number }>)[0];
    return { updatedAt: asTimestamp(saved.updated_at), lockVersion: Number(saved.lock_version), sortOrder: saved.sort_order };
  },

  async reorderStages(projectId: string, stages: Array<Pick<ProjectStage, "id" | "sortOrder" | "lockVersion">>): Promise<Array<{ id: string; updatedAt: number; lockVersion: number; sortOrder: number }>> {
    if (stages.some((stage) => stage.lockVersion === undefined)) {
      throw new Error("项目阶段版本尚未加载，已阻止非条件排序");
    }
    const { data, error } = await supabase.rpc("reorder_project_stages_v3", {
      p_project_id: projectId,
      p_items: stages.map((stage) => ({ id: stage.id, sort_order: stage.sortOrder, lock_version: stage.lockVersion })),
    });
    throwOnPostgrestError(error, "调整项目阶段顺序");
    return ((data ?? []) as Array<{ id: string; updated_at: string; lock_version: number; sort_order: number }>).map((stage) => ({
      id: stage.id,
      updatedAt: asTimestamp(stage.updated_at),
      lockVersion: Number(stage.lock_version),
      sortOrder: stage.sort_order,
    }));
  },

  async saveTemplate(template: ProjectTemplate): Promise<{ updatedAt: number; lockVersion: number }> {
    const { data, error } = await supabase.rpc("save_project_template_v2", {
      p_id: template.id,
      p_name: template.name,
      p_description: template.description || null,
      p_definition: template.definition,
      p_expected_lock_version: template.lockVersion ?? null,
    });
    throwOnPostgrestError(error, "保存项目模板");
    const saved = (data as Array<{ updated_at: string; lock_version: number }>)[0];
    return { updatedAt: asTimestamp(saved.updated_at), lockVersion: Number(saved.lock_version) };
  },

  async createFromTemplate(project: Project, templateId: string): Promise<void> {
    const { error } = await supabase.rpc("create_project_from_template", {
      p_project_id: project.id,
      p_template_id: templateId,
      p_name: project.name,
      p_description: project.description || null,
      p_start_date: project.startDate || null,
      p_end_date: project.endDate || null,
      p_priority: project.priority,
      p_tags: project.tags,
      p_owner_name: project.ownerName || null,
    });
    throwOnPostgrestError(error, "从模板创建项目");
  },

  async deleteTemplate(template: Pick<ProjectTemplate, "id" | "lockVersion">): Promise<void> {
    if (template.lockVersion === undefined) throw new Error("项目模板版本尚未加载，已阻止非条件删除");
    const { error } = await supabase.rpc("soft_delete_project_template_v3", { p_id: template.id, p_expected_lock_version: template.lockVersion });
    throwOnPostgrestError(error, "删除项目模板");
  },

  async deleteProject(project: Pick<Project, "id" | "lockVersion">): Promise<void> {
    if (project.lockVersion === undefined) throw new Error("项目版本尚未加载，已阻止非条件删除");
    const { error } = await supabase.rpc("soft_delete_project_v3", { p_id: project.id, p_expected_lock_version: project.lockVersion });
    throwOnPostgrestError(error, "删除项目");
  },

  async deleteStage(stage: Pick<ProjectStage, "id" | "lockVersion">): Promise<void> {
    if (stage.lockVersion === undefined) throw new Error("项目阶段版本尚未加载，已阻止非条件删除");
    const { error } = await supabase.rpc("soft_delete_project_stage_v3", { p_id: stage.id, p_expected_lock_version: stage.lockVersion });
    throwOnPostgrestError(error, "删除项目阶段");
  },

  saveTask(task: Task): Promise<import("@/services/timeManagementService").SavedTaskVersion | undefined> {
    return timeManagementApi.upsertTask(task);
  },

  deleteTask(task: Pick<Task, "id" | "lockVersion">): Promise<void> {
    return timeManagementApi.deleteTask(task);
  },
};
