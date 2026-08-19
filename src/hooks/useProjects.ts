import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { queryKeys } from "@/lib/syncEngine";
import { projectApi } from "@/services/projectService";
import type { Project, ProjectStage, ProjectTemplate } from "@/types/projects";
import type { Task } from "@/types/timeManagement";

export function useProjectsData() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: queryKeys.projects(userId),
    queryFn: () => projectApi.loadAll(userId),
    staleTime: 30_000,
  });
}

export function useProjectActions() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.projects(userId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.timeManagement(userId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.focusAssistantTasks(userId) }),
    ]);
  }, [queryClient, userId]);

  const saveProject = useCallback(async (project: Project) => {
    await projectApi.saveProject(project);
    await refresh();
  }, [refresh]);

  const saveStage = useCallback(async (stage: ProjectStage) => {
    await projectApi.saveStage(stage);
    await refresh();
  }, [refresh]);

  const reorderStages = useCallback(async (projectId: string, stageIds: string[]) => {
    await projectApi.reorderStages(projectId, stageIds);
    await refresh();
  }, [refresh]);

  const saveTemplate = useCallback(async (template: ProjectTemplate) => {
    await projectApi.saveTemplate(template);
    await refresh();
  }, [refresh]);

  const createFromTemplate = useCallback(async (project: Project, templateId: string) => {
    await projectApi.createFromTemplate(project, templateId);
    await refresh();
  }, [refresh]);

  const deleteTemplate = useCallback(async (templateId: string) => {
    await projectApi.deleteTemplate(templateId);
    await refresh();
  }, [refresh]);

  const deleteProject = useCallback(async (projectId: string) => {
    await projectApi.deleteProject(projectId);
    await refresh();
  }, [refresh]);

  const deleteStage = useCallback(async (stageId: string) => {
    await projectApi.deleteStage(stageId);
    await refresh();
  }, [refresh]);

  const saveTask = useCallback(async (task: Task) => {
    await projectApi.saveTask(task);
    await refresh();
  }, [refresh]);

  const deleteTask = useCallback(async (taskId: string) => {
    await projectApi.deleteTask(taskId);
    await refresh();
  }, [refresh]);

  return {
    saveProject,
    saveStage,
    reorderStages,
    saveTemplate,
    createFromTemplate,
    deleteTemplate,
    deleteProject,
    deleteStage,
    saveTask,
    deleteTask,
  };
}
