// Daily Review Application Level Types

export interface DailyReviewItem {
  id: string;
  date: string; // YYYY-MM-DD
  content: string; // Text or HTML/JSON content string
  createdAt: number; // Timestamp ms
  updatedAt: number; // Timestamp ms
  /** Server version the pending edit was based on; omitted for a new review. */
  baseUpdatedAt?: number;
}

export interface CompoundStats {
  currentStreak: number;
  longestStreak: number;
  totalReviews: number;
  compoundValue: number;
  monthlyCompletionRate: number;
}

export interface SaveReviewOptions {
  isHighFreq?: boolean;
}

