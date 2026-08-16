import type { Task } from "@/types/timeManagement";

export type ProjectStatus = "not_started" | "in_progress" | "completed" | "archived";
export type Priority = "low" | "medium" | "high" | "urgent";

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  startDate?: string;
  endDate?: string;
  priority: Priority;
  tags: string[];
  ownerName?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectStage {
  id: string;
  projectId: string;
  name: string;
  defaultAssigneeName?: string;
  sortOrder: number;
  templateKey?: string;
  startDate?: string;
  endDate?: string;
}

export interface ProjectTask extends Task {
  projectId: string;
  projectStageId?: string;
  priority: Priority;
  assigneeName?: string;
}

export interface ProjectTemplateStage {
  key: string;
  name: string;
  defaultAssigneeName?: string;
}

export interface ProjectTemplateTask {
  title: string;
  description?: string;
  /** Stored task-table value, e.g. Q2_NOT_URGENT_IMPORTANT. */
  quadrant?: string;
  priority?: Priority;
  assigneeName?: string;
  stageKey?: string;
}

export interface ProjectTemplateDefinition {
  stages: ProjectTemplateStage[];
  tasks: ProjectTemplateTask[];
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description?: string;
  definition: ProjectTemplateDefinition;
  updatedAt: number;
}

export interface ProjectCenterData {
  projects: Project[];
  stages: ProjectStage[];
  tasks: ProjectTask[];
  templates: ProjectTemplate[];
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  not_started: "未开始",
  in_progress: "进行中",
  completed: "已完成",
  archived: "已归档",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "低",
  medium: "中",
  high: "高",
  urgent: "紧急",
};
