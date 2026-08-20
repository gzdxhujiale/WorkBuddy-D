// Domain types for Habit Tracking

export interface Habit {
  id: string;
  name: string;
  frequencyType: "daily" | "weekly_days" | "custom";
  goal?: string;
  startDate?: string;
  duration?: string;
  category?: string;
  reminder?: string;
  autoPopupLog: boolean;
  checkInTime?: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  lockVersion?: number;
  isNew?: boolean;
  baseUpdatedAt?: number;
}

export interface HabitCheckIn {
  id: string;
  habitId: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface HabitData {
  habits: Habit[];
  checkIns: HabitCheckIn[];
}

export interface HabitStats {
  monthCheckIns: number;
  totalCheckIns: number;
  monthlyCompletionRate: number;
  currentStreak: number;
}
