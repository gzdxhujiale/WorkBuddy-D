import { useMemo, useState, useEffect } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { FolderKanban } from "lucide-react";
import {
  ProjectSidebar,
  ProjectHeaderToolbar,
  ProjectStageBoard,
  ProjectGanttView,
  ProjectTableView,
  TemplateEditorModal,
  ProjectCreateModal,
  useProjectActions,
  useProjectsData,
  type ProjectViewMode,
  type SidebarStatusFilter,
  type Project,
} from "@/features/projects";
import { SectionErrorBoundary } from "@/components/ui/SectionErrorBoundary";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { createProjectStageId } from "@/lib/entityIds";

export function ProjectsPage() {
  const { data, isPending, error } = useProjectsData();
  const {
    saveProject,
    saveStage,
    reorderStages,
    saveTask,
    saveTemplate,
    createFromTemplate,
    deleteProject,
    deleteStage,
    deleteTask,
  } = useProjectActions();
  const { confirm, dialogElement } = useConfirmDialog();
  const navigate = useNavigate({ from: "/projects" });
  const search = useSearch({ from: "/projects" });

  const selectedId = search.projectId;
  const setSelectedId = (id: string | undefined) => {
    void navigate({
      search: (prev) => ({ ...prev, projectId: id || undefined }),
      replace: true,
    });
  };

  const viewMode: ProjectViewMode = search.view ?? "kanban";
  const setViewMode = (mode: ProjectViewMode) => {
    void navigate({
      search: (prev) => ({ ...prev, view: mode }),
      replace: true,
    });
  };

  const statusFilter: SidebarStatusFilter = search.status ?? "in_progress";
  const setStatusFilter = (filter: SidebarStatusFilter) => {
    void navigate({
      search: (prev) => ({ ...prev, status: filter }),
      replace: true,
    });
  };

  const [creating, setCreating] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const projects = data?.projects ?? [];
  const allStages = data?.stages ?? [];
  const allTasks = data?.tasks ?? [];

  useEffect(() => {
    if (projects.length === 0) {
      if (selectedId) {
        setSelectedId(undefined);
      }
      return;
    }
    const exists = projects.some((item) => item.id === selectedId);
    if (!exists) {
      setSelectedId(projects[0].id);
    }
  }, [projects, selectedId]);

  const selected = useMemo(() => projects.find((item) => item.id === selectedId), [projects, selectedId]);
  const selectedStages = useMemo(
    () =>
      allStages
        .filter((stage) => stage.projectId === selected?.id)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [allStages, selected?.id]
  );
  const selectedTasks = useMemo(
    () => allTasks.filter((task) => task.projectId === selected?.id),
    [allTasks, selected?.id]
  );

  const run = async <T,>(action: () => Promise<T> | T): Promise<T | undefined> => {
    setBusy(true);
    setActionError("");
    try {
      return await action();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "操作失败");
      return undefined;
    } finally {
      setBusy(false);
    }
  };

  const createProject = async (project: Project, templateId?: string) => {
    if (templateId) {
      await run(() => createFromTemplate(project, templateId));
    } else {
      await run(() => saveProject(project));
    }
    setSelectedId(project.id);
  };

  if (isPending) return <div className="p-8 text-sm text-muted-foreground font-mono">加载项目中心…</div>;
  if (error) return <div className="p-8 text-sm text-destructive font-mono">加载项目中心失败：{error.message}</div>;

  return (
    <SectionErrorBoundary fallbackTitle="项目中心加载异常" fallbackMessage="项目视图遇到错误，请尝试重新加载。">
      <div className="flex flex-row h-full w-full min-h-0 overflow-hidden bg-background text-foreground">
        {/* Sidebar */}
        <ProjectSidebar
          projects={projects}
          allTasks={allTasks}
          selectedId={selectedId}
          onSelectProject={(id) => setSelectedId(id)}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onCreateProject={() => setCreating(true)}
          onManageTemplates={() => setCreatingTemplate(true)}
        />

        {/* Main Details Panel */}
        {selected ? (
          <section className="flex-1 h-full min-w-0 overflow-y-auto">
            <div className="mx-auto max-w-5xl p-4 lg:p-5 space-y-3">
              <ProjectHeaderToolbar
                project={selected}
                allTasks={allTasks}
                stages={selectedStages}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                onSaveProject={(p) => void run(() => saveProject(p))}
                onDeleteProject={() => {
                  void confirm({
                    title: "删除项目？",
                    description: "项目、所有阶段及其任务都会移入已删除状态。",
                    confirmText: "删除项目",
                  }).then((confirmed) => {
                    if (!confirmed) return;
                    void run(async () => {
                      await deleteProject(selected.id);
                      setSelectedId(undefined);
                    });
                  });
                }}
                onAddStage={() =>
                  void run(() =>
                    saveStage({
                      id: createProjectStageId(),
                      projectId: selected.id,
                      name: `阶段 ${selectedStages.length + 1}`,
                      sortOrder: selectedStages.length,
                    })
                  )
                }
                busy={busy}
              />

              {/* Views Distribution */}
              {viewMode === "kanban" && (
                <ProjectStageBoard
                  stages={selectedStages}
                  tasks={selectedTasks}
                  disabled={busy}
                  onCreateStage={(name) =>
                    run(() =>
                      saveStage({
                        id: createProjectStageId(),
                        projectId: selected.id,
                        name,
                        sortOrder: selectedStages.length,
                      })
                    )
                  }
                  onSaveStage={(stage) => run(() => saveStage(stage))}
                  onReorderStages={(stageIds) => reorderStages(selected.id, stageIds)}
                  onDeleteStage={(stage) =>
                    confirm({
                      title: `删除阶段“${stage.name}”？`,
                      description: "该阶段中的任务也会移入已删除状态。",
                      confirmText: "删除阶段",
                    }).then((confirmed) => {
                      if (confirmed) void run(() => deleteStage(stage.id));
                    })
                  }
                  onSaveTask={(task) => saveTask(task)}
                  onDeleteTask={(taskId) => deleteTask(taskId)}
                />
              )}

              {viewMode === "gantt" && (
                <ProjectGanttView
                  project={selected}
                  stages={selectedStages}
                  tasks={selectedTasks}
                  disabled={busy}
                  onSaveTask={(task) => saveTask(task)}
                />
              )}

              {viewMode === "table" && (
                <ProjectTableView
                  project={selected}
                  stages={selectedStages}
                  tasks={selectedTasks}
                  disabled={busy}
                  onSaveTask={(task) => saveTask(task)}
                  onDeleteTask={(taskId) => deleteTask(taskId)}
                />
              )}

              {actionError && (
                <p className="mt-4 text-sm text-destructive font-mono" role="alert">
                  {actionError}
                </p>
              )}
            </div>
          </section>
        ) : (
          <section className="grid flex-1 place-items-center text-center text-muted-foreground">
            <div>
              <FolderKanban className="mx-auto mb-4 size-10 opacity-45" />
              <p className="font-medium">创建项目，开始管理完整事项</p>
            </div>
          </section>
        )}

        <ProjectCreateModal
          open={creating}
          templates={data?.templates ?? []}
          onOpenChange={setCreating}
          onCreate={createProject}
        />
        <TemplateEditorModal
          open={creatingTemplate}
          onOpenChange={setCreatingTemplate}
          onSave={saveTemplate}
        />
        {dialogElement}
      </div>
    </SectionErrorBoundary>
  );
}
