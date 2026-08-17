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
      supabase.from("projects").select("id,name,description,status,start_date,end_date,priority,tags,owner_name,created_at,updated_at").eq("user_id", userId).is("deleted_at", null).order("updated_at", { ascending: false }),
      supabase.from("project_stages").select("id,project_id,name,default_assignee_name,sort_order,template_key,start_date,end_date").eq("user_id", userId).is("deleted_at", null).order("sort_order"),
      supabase.from("time_management_tasks").select("id,title,quadrant,schedule_mode,scheduled_start_at,scheduled_end_at,completed,completed_at,description,reminder,project_id,project_stage_id,priority,assignee_name,created_at,updated_at").eq("user_id", userId).is("deleted_at", null).not("project_id", "is", null).order("created_at", { ascending: false }),
      supabase.from("project_templates").select("id,name,description,definition,updated_at").eq("user_id", userId).is("deleted_at", null).order("updated_at", { ascending: false }),
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
        createdAt: asTimestamp(row.created_at),
        updatedAt: asTimestamp(row.updated_at),
        baseUpdatedAt: asTimestamp(row.updated_at),
      })) as ProjectTask[],
      templates: (templateResult.data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description || undefined,
        definition: (row.definition ?? emptyDefinition) as ProjectTemplateDefinition,
        updatedAt: asTimestamp(row.updated_at),
      })) as ProjectTemplate[],
    };
  },

  async saveProject(project: Project): Promise<void> {
    const { error } = await supabase.rpc("save_project", {
      p_id: project.id,
      p_name: project.name,
      p_description: project.description || null,
      p_status: project.status,
      p_start_date: project.startDate || null,
      p_end_date: project.endDate || null,
      p_priority: project.priority,
      p_tags: project.tags,
      p_owner_name: project.ownerName || null,
      p_expected_updated_at: project.updatedAt ? new Date(project.updatedAt).toISOString() : null,
    });
    throwOnPostgrestError(error, "保存项目");
  },

  async saveStage(stage: ProjectStage): Promise<void> {
    const { error } = await supabase.rpc("save_project_stage", {
      p_id: stage.id,
      p_project_id: stage.projectId,
      p_name: stage.name,
      p_default_assignee_name: stage.defaultAssigneeName || null,
      p_sort_order: stage.sortOrder,
      p_template_key: stage.templateKey || null,
      p_start_date: stage.startDate || null,
      p_end_date: stage.endDate || null,
    });
    throwOnPostgrestError(error, "保存项目阶段");
  },

  async saveTemplate(template: ProjectTemplate): Promise<void> {
    const { error } = await supabase.rpc("save_project_template", {
      p_id: template.id,
      p_name: template.name,
      p_description: template.description || null,
      p_definition: template.definition,
    });
    throwOnPostgrestError(error, "保存项目模板");
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

  async deleteTemplate(id: string): Promise<void> {
    const { error } = await supabase.rpc("soft_delete_project_template", { p_id: id });
    throwOnPostgrestError(error, "删除项目模板");
  },

  async deleteProject(id: string): Promise<void> {
    const { error } = await supabase.rpc("soft_delete_project", { p_id: id });
    throwOnPostgrestError(error, "删除项目");
  },

  async deleteStage(id: string): Promise<void> {
    const { error } = await supabase.rpc("soft_delete_project_stage", { p_id: id });
    throwOnPostgrestError(error, "删除项目阶段");
  },

  saveTask(task: Task): Promise<number | undefined> {
    return timeManagementApi.upsertTask(task);
  },

  deleteTask(id: string): Promise<void> {
    return timeManagementApi.deleteTask(id);
  },
};
