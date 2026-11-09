import { describe, it, expect } from "vitest";
import {
  sortStageTasks,
  sortQuadrantTasks,
  sortTodayTasks,
  compareStageTasks,
  compareQuadrantTasks,
  compareTodayTasks,
  type TaskLike,
} from "./taskSort";

describe("taskSort", () => {
  describe("compareStageTasks", () => {
    it("places uncompleted tasks before completed tasks", () => {
      const taskA: TaskLike = { id: "a", completed: true, createdAt: 1000 };
      const taskB: TaskLike = { id: "b", completed: false, createdAt: 1000 };
      expect(compareStageTasks(taskA, taskB)).toBeGreaterThan(0);
      expect(compareStageTasks(taskB, taskA)).toBeLessThan(0);
    });

    it("orders by explicit sortOrder ascending", () => {
      const taskA: TaskLike = { id: "a", sortOrder: 1, completed: false };
      const taskB: TaskLike = { id: "b", sortOrder: 0, completed: false };
      expect(compareStageTasks(taskA, taskB)).toBeGreaterThan(0);
    });

    it("orders by scheduled date when sortOrder is missing", () => {
      const taskA: TaskLike = { id: "a", scheduledEndAt: 2000, completed: false };
      const taskB: TaskLike = { id: "b", scheduledEndAt: 1000, completed: false };
      expect(compareStageTasks(taskA, taskB)).toBeGreaterThan(0);
    });

    it("orders by createdAt descending when dates and sortOrder are equal", () => {
      const taskA: TaskLike = { id: "a", createdAt: 1000, completed: false };
      const taskB: TaskLike = { id: "b", createdAt: 2000, completed: false };
      expect(compareStageTasks(taskA, taskB)).toBeGreaterThan(0);
    });

    it("uses ID lexicographical comparison as definitive tie-breaker when all timestamps collide", () => {
      const taskA: TaskLike = { id: "task-01", createdAt: 1000, completed: false };
      const taskB: TaskLike = { id: "task-02", createdAt: 1000, completed: false };
      // task-01 < task-02
      expect(compareStageTasks(taskA, taskB)).toBeLessThan(0);
      expect(compareStageTasks(taskB, taskA)).toBeGreaterThan(0);
    });

    it("guarantees idempotent deterministic sorting regardless of initial array shuffle", () => {
      const tasks: TaskLike[] = [
        { id: "t3", createdAt: 1000, completed: false },
        { id: "t1", createdAt: 1000, completed: false },
        { id: "t2", createdAt: 1000, completed: false },
        { id: "t4", createdAt: 1000, completed: true },
      ];

      const perm1 = sortStageTasks([tasks[0], tasks[1], tasks[2], tasks[3]]);
      const perm2 = sortStageTasks([tasks[3], tasks[2], tasks[1], tasks[0]]);
      const perm3 = sortStageTasks([tasks[1], tasks[3], tasks[0], tasks[2]]);

      const ids1 = perm1.map((t) => t.id);
      const ids2 = perm2.map((t) => t.id);
      const ids3 = perm3.map((t) => t.id);

      expect(ids1).toEqual(["t1", "t2", "t3", "t4"]);
      expect(ids2).toEqual(ids1);
      expect(ids3).toEqual(ids1);
    });
  });

  describe("compareQuadrantTasks", () => {
    it("orders by sortOrder descending for drag-and-drop stack", () => {
      const taskA: TaskLike = { id: "a", sortOrder: 5, completed: false };
      const taskB: TaskLike = { id: "b", sortOrder: 10, completed: false };
      expect(compareQuadrantTasks(taskA, taskB)).toBeGreaterThan(0);
    });

    it("falls back to createdAt and then ID when sortOrders are identical", () => {
      const taskA: TaskLike = { id: "t-b", sortOrder: 0, createdAt: 1000, completed: false };
      const taskB: TaskLike = { id: "t-a", sortOrder: 0, createdAt: 1000, completed: false };
      expect(compareQuadrantTasks(taskA, taskB)).toBeGreaterThan(0);
      expect(compareQuadrantTasks(taskB, taskA)).toBeLessThan(0);
    });

    it("sortQuadrantTasks sorts multiple quadrant tasks deterministically", () => {
      const qTasks: TaskLike[] = [
        { id: "q1", sortOrder: 1, completed: false },
        { id: "q2", sortOrder: 5, completed: false },
        { id: "q3", sortOrder: 0, completed: true },
      ];
      const sorted = sortQuadrantTasks(qTasks);
      expect(sorted.map((t) => t.id)).toEqual(["q2", "q1", "q3"]);
    });
  });

  describe("compareTodayTasks", () => {
    const now = 5000;

    it("prioritizes overdue tasks over upcoming tasks", () => {
      const overdue: TaskLike = { id: "a", scheduledEndAt: 3000, completed: false };
      const upcoming: TaskLike = { id: "b", scheduledEndAt: 7000, completed: false };
      expect(compareTodayTasks(overdue, upcoming, now)).toBeLessThan(0);
    });

    it("orders upcoming tasks by earlier deadline first", () => {
      const earlier: TaskLike = { id: "a", scheduledEndAt: 6000, completed: false };
      const later: TaskLike = { id: "b", scheduledEndAt: 8000, completed: false };
      expect(compareTodayTasks(earlier, later, now)).toBeLessThan(0);
    });

    it("resolves identical deadline collisions with ID tie-breaker", () => {
      const taskA: TaskLike = { id: "task-1", scheduledEndAt: 6000, completed: false };
      const taskB: TaskLike = { id: "task-2", scheduledEndAt: 6000, completed: false };
      expect(compareTodayTasks(taskA, taskB, now)).toBeLessThan(0);
    });

    it("sortTodayTasks sorts today tasks with overdue and deadline order", () => {
      const todayList: TaskLike[] = [
        { id: "t-later", scheduledEndAt: 8000, completed: false },
        { id: "t-overdue", scheduledEndAt: 2000, completed: false },
        { id: "t-done", scheduledEndAt: 1000, completed: true },
      ];
      const sorted = sortTodayTasks(todayList, now);
      expect(sorted.map((t) => t.id)).toEqual(["t-overdue", "t-later", "t-done"]);
    });
  });
});
