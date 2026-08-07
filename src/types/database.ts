// Database Types for Supabase

export type QuadrantType = 
  | 'Q1_URGENT_IMPORTANT'
  | 'Q2_NOT_URGENT_IMPORTANT'
  | 'Q3_URGENT_NOT_IMPORTANT'
  | 'Q4_NOT_URGENT_NOT_IMPORTANT';

export interface ReminderConfig {
  time?: string;
  channel?: 'email' | 'push' | 'system';
  [key: string]: unknown;
}

export interface MissionRole {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface TimeManagementTask {
  id: string;
  user_id: string;
  role_id: string | null;
  title: string;
  quadrant: QuadrantType;
  scheduled_date: string | null; // YYYY-MM-DD
  time_of_day: string | null;
  completed: boolean;
  completed_at: string | null;
  description: string | null;
  deadline: string | null;
  reminder: ReminderConfig | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type InsertTimeManagementTask = Omit<
  TimeManagementTask,
  'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'
> & {
  id?: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
};

export type UpdateTimeManagementTask = Partial<InsertTimeManagementTask>;

export interface DailyReviewRow {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  content: Record<string, unknown> | string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export type InsertDailyReview = Omit<
  DailyReviewRow,
  'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'
> & {
  id?: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
};

export type UpdateDailyReview = Partial<InsertDailyReview>;

export interface HabitRow {
  id: string;
  user_id: string;
  name: string;
  frequency_type: 'daily' | 'weekly_days' | 'custom';
  frequency_days: number[] | null;
  goal: string | null;
  start_date: string | null;
  duration: string | null;
  category: string | null;
  reminder: string | null;
  auto_popup_log: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type InsertHabit = Omit<
  HabitRow,
  'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'
> & {
  id?: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
};

export type UpdateHabit = Partial<InsertHabit>;

export interface HabitCheckinRow {
  id: string;
  user_id: string;
  habit_id: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type InsertHabitCheckin = Omit<
  HabitCheckinRow,
  'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'
> & {
  id?: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
};

export type UpdateHabitCheckin = Partial<InsertHabitCheckin>;

// Lists & Notes Module Database Types

export type ListViewType = 'list' | 'kanban' | 'grid';

export interface ListFolderRow {
  id: string;
  user_id: string;
  name: string;
  is_pinned: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type InsertListFolder = Omit<
  ListFolderRow,
  'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'
> & {
  id?: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
};

export type UpdateListFolder = Partial<InsertListFolder>;

export interface ListListRow {
  id: string;
  user_id: string;
  folder_id: string | null;
  name: string;
  icon: string;
  color: string;
  view_type: ListViewType;
  is_pinned: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type InsertListList = Omit<
  ListListRow,
  'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'
> & {
  id?: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
};

export type UpdateListList = Partial<InsertListList>;

export interface ListNoteGroupRow {
  id: string;
  user_id: string;
  list_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type InsertListNoteGroup = Omit<
  ListNoteGroupRow,
  'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'
> & {
  id?: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
};

export type UpdateListNoteGroup = Partial<InsertListNoteGroup>;

export interface ListNoteRow {
  id: string;
  user_id: string;
  list_id: string;
  group_id: string | null;
  title: string;
  content: string;
  is_pinned: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type InsertListNote = Omit<
  ListNoteRow,
  'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'
> & {
  id?: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
};

export type UpdateListNote = Partial<InsertListNote>;

export interface ListTemplateRow {
  id: string;
  user_id: string;
  name: string;
  content: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type InsertListTemplate = Omit<
  ListTemplateRow,
  'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'
> & {
  id?: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
};

export type UpdateListTemplate = Partial<InsertListTemplate>;



