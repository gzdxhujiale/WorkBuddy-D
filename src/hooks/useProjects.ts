import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { queryKeys } from "@/lib/syncEngine";
import { projectApi } from "@/services/projectService";
import { useOptimisticSync } from "@/hooks/useOptimisticSync";
import type {
  Project,
  ProjectCenterData,
  ProjectStage,
  ProjectTask,
  ProjectTemplate,
} from "@/types/projects";
import type { Task, TimeManagementData } from "@/types/timeManagement";

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
  const PROJECTS_KEY = queryKeys.projects(userId);
  const TIME_KEY = queryKeys.timeManagement(userId);

  // 1. Optimistic Project Save (Upsert / Property Change)
  const { trigger: triggerSaveProject } = useOptimisticSync<ProjectCenterData, Project>({
    queryKey: PROJECTS_KEY,
    debounceMs: 300,
    getSyncKey: (p) => p.id,
    updateCache: (old, project) => {
      const cur = old ?? { projects: [], stages: [], tasks: [], templates: [] };
      const idx = cur.projects.findIndex((p) => p.id === project.id);
      let nextProjects: Project[];
      if (idx >= 0) {
        nextProjects = cur.projects.map((p) =>
          p.id === project.id ? { ...p, ...project, updatedAt: Date.now() } : p
        );
      } else {
        nextProjects = [project, ...cur.projects];
      }
      return { ...cur, projects: nextProjects };
    },
    syncFn: async (project) => {
      const saved = await projectApi.saveProject(project);
      queryClient.setQueryData<ProjectCenterData>(PROJECTS_KEY, (old) => old ? {
        ...old,
        projects: old.projects.map((item) => item.id === project.id && item.updatedAt === project.updatedAt
          ? { ...item, updatedAt: saved.updatedAt, lockVersion: saved.lockVersion, isNew: false } : item),
      } : old);
    },
  });

  // 2. Optimistic Project Delete
  const { trigger: triggerDeleteProject } = useOptimisticSync<ProjectCenterData, Pick<Project, "id" | "lockVersion">>({
    queryKey: PROJECTS_KEY,
    debounceMs: 0,
    getSyncKey: ({ id }) => id,
    updateCache: (old, { id: projectId }) => {
      const cur = old ?? { projects: [], stages: [], tasks: [], templates: [] };
      return {
        ...cur,
        projects: cur.projects.filter((p) => p.id !== projectId),
        stages: cur.stages.filter((s) => s.projectId !== projectId),
        tasks: cur.tasks.filter((t) => t.projectId !== projectId),
      };
    },
    syncFn: async (project) => {
      await projectApi.deleteProject(project);
    },
  });

  // 3. Optimistic Stage Save (Create / Rename / Date change)
  const { trigger: triggerSaveStage } = useOptimisticSync<ProjectCenterData, ProjectStage>({
    queryKey: PROJECTS_KEY,
    debounceMs: 200,
    getSyncKey: (s) => s.id,
    updateCache: (old, stage) => {
      const cur = old ?? { projects: [], stages: [], tasks: [], templates: [] };
      const idx = cur.stages.findIndex((s) => s.id === stage.id);
      let nextStages: ProjectStage[];
      if (idx >= 0) {
        nextStages = cur.stages.map((s) => (s.id === stage.id ? { ...s, ...stage } : s));
      } else {
        nextStages = [...cur.stages, stage];
      }
      return { ...cur, stages: nextStages };
    },
    syncFn: async (stage) => {
      const saved = await projectApi.saveStage(stage);
      queryClient.setQueryData<ProjectCenterData>(PROJECTS_KEY, (old) => old ? {
        ...old,
        stages: old.stages.map((item) => item.id === stage.id
          ? { ...item, updatedAt: saved.updatedAt, lockVersion: saved.lockVersion, sortOrder: saved.sortOrder, isNew: false } : item),
      } : old);
    },
  });

  // 4. Optimistic Stage Reorder (Drag and drop reordering)
  const { trigger: triggerReorderStages } = useOptimisticSync<
    ProjectCenterData,
    { projectId: string; stageIds: string[] }
  >({
    queryKey: PROJECTS_KEY,
    debounceMs: 100,
    getSyncKey: ({ projectId }) => `reorder-stages-${projectId}`,
    updateCache: (old, { projectId, stageIds }) => {
      const cur = old ?? { projects: [], stages: [], tasks: [], templates: [] };
      const nextStages = cur.stages.map((s) => {
        if (s.projectId !== projectId) return s;
        const newOrder = stageIds.indexOf(s.id);
        return newOrder >= 0 ? { ...s, sortOrder: newOrder } : s;
      });
      return { ...cur, stages: nextStages };
    },
    syncFn: async ({ projectId }) => {
      const stages = queryClient.getQueryData<ProjectCenterData>(PROJECTS_KEY)?.stages
        .filter((stage) => stage.projectId === projectId) ?? [];
      const saved = await projectApi.reorderStages(projectId, stages);
      const versions = new Map(saved.map((stage) => [stage.id, stage]));
      queryClient.setQueryData<ProjectCenterData>(PROJECTS_KEY, (old) => old ? {
        ...old,
        stages: old.stages.map((stage) => {
          const version = versions.get(stage.id);
          return version ? { ...stage, sortOrder: version.sortOrder, updatedAt: version.updatedAt, lockVersion: version.lockVersion } : stage;
        }),
      } : old);
    },
  });

  // 5. Optimistic Stage Delete
  const { trigger: triggerDeleteStage } = useOptimisticSync<ProjectCenterData, Pick<ProjectStage, "id" | "lockVersion">>({
    queryKey: PROJECTS_KEY,
    debounceMs: 0,
    getSyncKey: ({ id }) => id,
    updateCache: (old, { id: stageId }) => {
      const cur = old ?? { projects: [], stages: [], tasks: [], templates: [] };
      return {
        ...cur,
        stages: cur.stages.filter((s) => s.id !== stageId),
        tasks: cur.tasks.filter((t) => t.projectStageId !== stageId),
      };
    },
    syncFn: async (stage) => {
      await projectApi.deleteStage(stage);
    },
  });

  // 6. Optimistic Task Save (Create / Check / Edit / Stage Move)
  const { trigger: triggerSaveTask } = useOptimisticSync<ProjectCenterData, Task>({
    queryKey: PROJECTS_KEY,
    debounceMs: 200,
    getSyncKey: (t) => t.id,
    updateCache: (old, task) => {
      const cur = old ?? { projects: [], stages: [], tasks: [], templates: [] };
      const pTask = task as ProjectTask;
      const idx = cur.tasks.findIndex((t) => t.id === task.id);
      let nextTasks: ProjectTask[];
      if (idx >= 0) {
        nextTasks = cur.tasks.map((t) =>
          t.id === task.id ? { ...t, ...pTask, updatedAt: Date.now() } : t
        );
      } else {
        nextTasks = [
          { ...pTask, updatedAt: Date.now(), createdAt: pTask.createdAt || Date.now() },
          ...cur.tasks,
        ];
      }
      return { ...cur, tasks: nextTasks };
    },
    syncFn: async (task) => {
      const savedUpdatedAt = await projectApi.saveTask(task);
      if (savedUpdatedAt !== undefined) {
        queryClient.setQueryData<ProjectCenterData>(PROJECTS_KEY, (old) =>
          old
            ? {
                ...old,
                tasks: old.tasks.map((t) =>
                  t.id === task.id
                    ? { ...t, updatedAt: savedUpdatedAt.updatedAt, baseUpdatedAt: savedUpdatedAt.updatedAt, lockVersion: savedUpdatedAt.lockVersion, isNew: false }
                    : t
                ),
              }
            : old
        );
      }
      // Keep TimeManagement cache in sync if loaded
      queryClient.setQueryData<TimeManagementData>(TIME_KEY, (old) => {
        if (!old) return old;
        const idx = old.tasks.findIndex((t) => t.id === task.id);
        const nextTasks =
          idx >= 0
            ? old.tasks.map((t) => (t.id === task.id ? { ...t, ...task } : t))
            : [task, ...old.tasks];
        return { ...old, tasks: nextTasks };
      });
    },
  });

  // 7. Optimistic Task Delete
  const { trigger: triggerDeleteTask } = useOptimisticSync<ProjectCenterData, Pick<Task, "id" | "lockVersion">>({
    queryKey: PROJECTS_KEY,
    debounceMs: 0,
    getSyncKey: ({ id }) => id,
    updateCache: (old, { id: taskId }) => {
      const cur = old ?? { projects: [], stages: [], tasks: [], templates: [] };
      return {
        ...cur,
        tasks: cur.tasks.filter((t) => t.id !== taskId),
      };
    },
    syncFn: async (task) => {
      await projectApi.deleteTask(task);
      queryClient.setQueryData<TimeManagementData>(TIME_KEY, (old) => {
        if (!old) return old;
        return { ...old, tasks: old.tasks.filter((t) => t.id !== task.id) };
      });
    },
  });

  // 8. Optimistic Template Save
  const { trigger: triggerSaveTemplate } = useOptimisticSync<ProjectCenterData, ProjectTemplate>({
    queryKey: PROJECTS_KEY,
    debounceMs: 200,
    getSyncKey: (tpl) => tpl.id,
    updateCache: (old, template) => {
      const cur = old ?? { projects: [], stages: [], tasks: [], templates: [] };
      const idx = cur.templates.findIndex((t) => t.id === template.id);
      let nextTemplates: ProjectTemplate[];
      if (idx >= 0) {
        nextTemplates = cur.templates.map((t) => (t.id === template.id ? template : t));
      } else {
        nextTemplates = [template, ...cur.templates];
      }
      return { ...cur, templates: nextTemplates };
    },
    syncFn: async (template) => {
      const saved = await projectApi.saveTemplate(template);
      queryClient.setQueryData<ProjectCenterData>(PROJECTS_KEY, (old) => old ? {
        ...old,
        templates: old.templates.map((item) => item.id === template.id && item.updatedAt === template.updatedAt
          ? { ...item, updatedAt: saved.updatedAt, lockVersion: saved.lockVersion, isNew: false } : item),
      } : old);
    },
  });

  // 9. Optimistic Template Delete
  const { trigger: triggerDeleteTemplate } = useOptimisticSync<ProjectCenterData, Pick<ProjectTemplate, "id" | "lockVersion">>({
    queryKey: PROJECTS_KEY,
    debounceMs: 0,
    getSyncKey: ({ id }) => id,
    updateCache: (old, { id: templateId }) => {
      const cur = old ?? { projects: [], stages: [], tasks: [], templates: [] };
      return {
        ...cur,
        templates: cur.templates.filter((t) => t.id !== templateId),
      };
    },
    syncFn: async (template) => {
      await projectApi.deleteTemplate(template);
    },
  });

  // 10. Template instantiate (DB generates batch stages & tasks, so we invalidate after creation)
  const createFromTemplate = useCallback(
    async (project: Project, templateId: string) => {
      await projectApi.createFromTemplate(project, templateId);
      await queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
    },
    [queryClient, PROJECTS_KEY]
  );

  const saveProject = useCallback(async (project: Project) => { triggerSaveProject(project); }, [triggerSaveProject]);
  const deleteProject = useCallback(async (projectId: string) => {
    const project = queryClient.getQueryData<ProjectCenterData>(PROJECTS_KEY)?.projects.find((item) => item.id === projectId);
    if (!project) return;
    triggerDeleteProject(project);
    queryClient.setQueryData<TimeManagementData>(TIME_KEY, (old) => old
      ? { ...old, tasks: old.tasks.filter((task) => task.projectId !== projectId) }
      : old);
  }, [PROJECTS_KEY, TIME_KEY, queryClient, triggerDeleteProject]);
  const saveStage = useCallback(async (stage: ProjectStage) => { triggerSaveStage(stage); }, [triggerSaveStage]);
  const reorderStages = useCallback(
    async (projectId: string, stageIds: string[]) => { triggerReorderStages({ projectId, stageIds }); },
    [triggerReorderStages]
  );
  const deleteStage = useCallback(async (stageId: string) => {
    const stage = queryClient.getQueryData<ProjectCenterData>(PROJECTS_KEY)?.stages.find((item) => item.id === stageId);
    if (!stage) return;
    triggerDeleteStage(stage);
    queryClient.setQueryData<TimeManagementData>(TIME_KEY, (old) => old
      ? { ...old, tasks: old.tasks.filter((task) => task.projectStageId !== stageId) }
      : old);
  }, [PROJECTS_KEY, TIME_KEY, queryClient, triggerDeleteStage]);
  const saveTask = useCallback(
    async (task: Task) => {
      triggerSaveTask(task);
      queryClient.setQueryData<TimeManagementData>(TIME_KEY, (old) => {
        if (!old) return old;
        const idx = old.tasks.findIndex((t) => t.id === task.id);
        const nextTasks =
          idx >= 0
            ? old.tasks.map((t) => (t.id === task.id ? { ...t, ...task } : t))
            : [task, ...old.tasks];
        return { ...old, tasks: nextTasks };
      });
    },
    [triggerSaveTask, queryClient, TIME_KEY]
  );
  const deleteTask = useCallback(
    async (taskId: string) => {
      const task = queryClient.getQueryData<ProjectCenterData>(PROJECTS_KEY)?.tasks.find((item) => item.id === taskId)
        ?? queryClient.getQueryData<TimeManagementData>(TIME_KEY)?.tasks.find((item) => item.id === taskId);
      if (!task) return;
      triggerDeleteTask(task);
      queryClient.setQueryData<TimeManagementData>(TIME_KEY, (old) => {
        if (!old) return old;
        return { ...old, tasks: old.tasks.filter((t) => t.id !== taskId) };
      });
    },
    [triggerDeleteTask, queryClient, TIME_KEY]
  );
  const saveTemplate = useCallback(async (template: ProjectTemplate) => { triggerSaveTemplate(template); }, [triggerSaveTemplate]);
  const deleteTemplate = useCallback(async (templateId: string) => {
    const template = queryClient.getQueryData<ProjectCenterData>(PROJECTS_KEY)?.templates.find((item) => item.id === templateId);
    if (template) triggerDeleteTemplate(template);
  }, [PROJECTS_KEY, queryClient, triggerDeleteTemplate]);

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
