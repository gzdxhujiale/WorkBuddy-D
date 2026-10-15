// Daily Review Application Level Types

export interface DailyReviewItem {
  id: string;
  date: string; // YYYY-MM-DD
  content: string; // Text or HTML/JSON content string
  createdAt: number; // Timestamp ms
  updatedAt: number; // Timestamp ms
  /** Database-owned optimistic-concurrency token; absent only before insert. */
  lockVersion?: number;
  isNew?: boolean;
  /** Server version the pending edit was based on; omitted for a new review. */
  baseUpdatedAt?: number;
}

export interface DailyReviewSummary {
  id: string;
  date: string; // YYYY-MM-DD
  createdAt: number;
  updatedAt: number;
  lockVersion?: number;
}

export interface CompoundStats {
  currentStreak: number;
  longestStreak: number;
  totalReviews: number;
  compoundValue: number;
}

export interface HeatmapDayData {
  has_review: boolean;
  level: number;
}

export interface DailyReviewHeatmap {
  year: number;
  days: Record<string, HeatmapDayData>;
}
