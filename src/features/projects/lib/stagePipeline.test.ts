import { describe, it, expect } from "vitest";
import type { ProjectStage, ProjectTask } from "@/types/project";
import {
  advanceTaskStage,
  rollbackTaskStage,
  directCompleteTask,
  getStageCategorizedTasks,
  isTerminalStage,
  computeStageTaskMutations,
} from "./stagePipeline";

describe("stagePipeline", () => {
  const mockStages: ProjectStage[] = [
    {
      id: "stage-1",
      projectId: "proj-1",
      name: "需求调研",
      sortOrder: 0,
      defaultAssigneeName: "Alice",
      startDate: "2026-11-01",
      endDate: "2026-11-05",
    },
    {
      id: "stage-2",
      projectId: "proj-1",
      name: "方案开发",
      sortOrder: 1,
      defaultAssigneeName: "Bob",
      startDate: "2026-11-06",
      endDate: "2026-11-15",
    },
    {
      id: "stage-3",
      projectId: "proj-1",
      name: "测试上线",
      sortOrder: 2,
      defaultAssigneeName: "Charlie",
      startDate: "2026-11-16",
      endDate: "2026-11-20",
    },
  ];

  const baseTask: ProjectTask = {
    id: "task-1",
    projectId: "proj-1",
    projectStageId: "stage-1",
    title: "用户核心流程设计",
    quadrant: "Q2",
    priority: "high",
    completed: false,
    assigneeName: "Alice",
    createdAt: 1000,
  };

  it("advances task from stage 1 to stage 2, creates snapshot and updates assignee/schedule", () => {
    const now = 2000;
    const advanced = advanceTaskStage(baseTask, mockStages, now);

    expect(advanced.projectStageId).toBe("stage-2");
    expect(advanced.completed).toBe(false);
    expect(advanced.completedAt).toBeUndefined();
    expect(advanced.assigneeName).toBe("Bob");
    expect(advanced.scheduleMode).toBe("range");
    expect(advanced.scheduledStartAt).toBe(new Date("2026-11-06").getTime());
    expect(advanced.scheduledEndAt).toBe(new Date("2026-11-15").getTime());
    expect(advanced.stageHistory).toEqual([
      { stageId: "stage-1", completedAt: now },
    ]);
  });

  it("advances task in terminal stage (stage 3) marking it globally completed", () => {
    const now = 3000;
    const stage3Task: ProjectTask = {
      ...baseTask,
      projectStageId: "stage-3",
      stageHistory: [
        { stageId: "stage-1", completedAt: 1500 },
        { stageId: "stage-2", completedAt: 2500 },
      ],
    };

    const completedTask = advanceTaskStage(stage3Task, mockStages, now);
    expect(completedTask.projectStageId).toBe("stage-3");
    expect(completedTask.completed).toBe(true);
    expect(completedTask.completedAt).toBe(now);
  });

  it("correctly identifies terminal stage", () => {
    expect(isTerminalStage("stage-1", mockStages)).toBe(false);
    expect(isTerminalStage("stage-2", mockStages)).toBe(false);
    expect(isTerminalStage("stage-3", mockStages)).toBe(true);
  });

  it("rolls back task from stage 2 to stage 1 and cleans snapshot", () => {
    const now = 2500;
    const stage2Task: ProjectTask = {
      ...baseTask,
      projectStageId: "stage-2",
      assigneeName: "Bob",
      stageHistory: [{ stageId: "stage-1", completedAt: 1500 }],
    };

    const rolledBack = rollbackTaskStage(stage2Task, mockStages, now);
    expect(rolledBack.projectStageId).toBe("stage-1");
    expect(rolledBack.completed).toBe(false);
    expect(rolledBack.assigneeName).toBe("Alice");
    expect(rolledBack.stageHistory).toEqual([]);
    expect(rolledBack.scheduledStartAt).toBe(new Date("2026-11-01").getTime());
    expect(rolledBack.scheduledEndAt).toBe(new Date("2026-11-05").getTime());
  });

  it("does not rollback when already in stage 1", () => {
    const rolledBack = rollbackTaskStage(baseTask, mockStages);
    expect(rolledBack).toBe(baseTask);
  });

  it("directly completes task regardless of current stage", () => {
    const now = 4000;
    const directlyCompleted = directCompleteTask(baseTask, now);
    expect(directlyCompleted.completed).toBe(true);
    expect(directlyCompleted.completedAt).toBe(now);
  });

  it("categorizes active tasks and stage snapshots correctly", () => {
    const taskInStage1: ProjectTask = { ...baseTask, id: "task-1", projectStageId: "stage-1" };
    const taskInStage2WithSnap: ProjectTask = {
      ...baseTask,
      id: "task-2",
      projectStageId: "stage-2",
      stageHistory: [{ stageId: "stage-1", completedAt: 1500 }],
    };
    const taskInStage3: ProjectTask = { ...baseTask, id: "task-3", projectStageId: "stage-3" };

    const stage1Items = getStageCategorizedTasks("stage-1", [
      taskInStage1,
      taskInStage2WithSnap,
      taskInStage3,
    ]);

    expect(stage1Items.active.map((t) => t.id)).toEqual(["task-1"]);
    expect(stage1Items.snapshots.map((t) => t.id)).toEqual(["task-2"]);
  });

  describe("computeStageTaskMutations", () => {
    let mockIdCounter = 0;
    const mockCreateId = () => `new-task-${++mockIdCounter}`;

    it("updates existing task title without duplicating or creating", () => {
      const activeTasks: ProjectTask[] = [baseTask];
      const parsedItems = [
        { taskId: "task-1", title: "更新后的需求调研", checked: false },
      ];

      const mutations = computeStageTaskMutations(
        parsedItems,
        activeTasks,
        mockStages[0],
        mockStages,
        mockCreateId,
        5000
      );

      expect(mutations.creates).toHaveLength(0);
      expect(mutations.deletes).toHaveLength(0);
      expect(mutations.updates).toHaveLength(1);
      expect(mutations.updates[0].id).toBe("task-1");
      expect(mutations.updates[0].title).toBe("更新后的需求调研");
    });

    it("prevents newly added tasks from overwriting the first task even if splitListItem duplicated taskId", () => {
      const activeTasks: ProjectTask[] = [baseTask];
      // User pressed Enter on task-1: item 2 accidentally had same taskId in raw AST
      const parsedItems = [
        { taskId: "task-1", title: "第一条原始任务", checked: false },
        { taskId: "task-1", title: "第二条回车新增任务", checked: false },
      ];

      const mutations = computeStageTaskMutations(
        parsedItems,
        activeTasks,
        mockStages[0],
        mockStages,
        mockCreateId,
        5000
      );

      // First task must be preserved in updates
      expect(mutations.updates).toHaveLength(1);
      expect(mutations.updates[0].id).toBe("task-1");
      expect(mutations.updates[0].title).toBe("第一条原始任务");

      // Second task must NOT overwrite first task; it must be in creates with a new ID!
      expect(mutations.creates).toHaveLength(1);
      expect(mutations.creates[0].id).toBe("new-task-1");
      expect(mutations.creates[0].title).toBe("第二条回车新增任务");
      expect(mutations.creates[0].projectStageId).toBe("stage-1");

      // No deletions
      expect(mutations.deletes).toHaveLength(0);
    });

    it("handles brand new task without taskId", () => {
      const activeTasks: ProjectTask[] = [baseTask];
      const parsedItems = [
        { taskId: "task-1", title: "第一条原始任务", checked: false },
        { title: "第三条全新任务", checked: false },
      ];

      const mutations = computeStageTaskMutations(
        parsedItems,
        activeTasks,
        mockStages[0],
        mockStages,
        mockCreateId,
        5000
      );

      expect(mutations.updates).toHaveLength(1);
      expect(mutations.creates).toHaveLength(1);
      expect(mutations.creates[0].title).toBe("第三条全新任务");
      expect(mutations.deletes).toHaveLength(0);
    });

    it("deletes active tasks that were removed from editor", () => {
      const activeTasks: ProjectTask[] = [
        baseTask,
        { ...baseTask, id: "task-2", title: "将被删除的任务" },
      ];
      // User deleted task-2 line
      const parsedItems = [
        { taskId: "task-1", title: "保留的任务", checked: false },
      ];

      const mutations = computeStageTaskMutations(
        parsedItems,
        activeTasks,
        mockStages[0],
        mockStages,
        mockCreateId,
        5000
      );

      expect(mutations.updates).toHaveLength(1);
      expect(mutations.creates).toHaveLength(0);
      expect(mutations.deletes).toEqual(["task-2"]);
    });

    it("advances task to next stage when checked is toggled", () => {
      const activeTasks: ProjectTask[] = [baseTask];
      const parsedItems = [
        { taskId: "task-1", title: "完成并流转", checked: true },
      ];

      const mutations = computeStageTaskMutations(
        parsedItems,
        activeTasks,
        mockStages[0],
        mockStages,
        mockCreateId,
        6000
      );

      expect(mutations.updates).toHaveLength(1);
      expect(mutations.updates[0].projectStageId).toBe("stage-2");
      expect(mutations.updates[0].stageHistory).toEqual([
        { stageId: "stage-1", completedAt: 6000 },
      ]);
    });
  });
});
