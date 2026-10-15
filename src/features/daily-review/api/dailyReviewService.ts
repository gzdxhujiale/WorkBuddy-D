import { apiClient } from "@/lib/apiClient";
import { DailyReviewItem, DailyReviewSummary, CompoundStats, DailyReviewHeatmap } from "../types";
import { registerOfflineExecutor, runOrQueue } from "@/lib/offlineSyncQueue";

export const EMPTY_TIPTAP_DOC = {
  type: "doc",
  content: [],
};

export function readReviewContent(content: unknown): string {
  if (!content) return JSON.stringify(EMPTY_TIPTAP_DOC);

  // 1. If it's an object, check if it's already a canonical Tiptap Doc or a legacy wrapper { text: ... }
  if (typeof content === "object" && content !== null) {
    const obj = content as Record<string, unknown>;

    // Case 1A: Directly a canonical Tiptap Document object
    if (obj.type === "doc" && Array.isArray(obj.content)) {
      return JSON.stringify(obj);
    }

    // Case 1B: Legacy wrapper { text: "..." }, { html: "..." }, or { raw: "..." }
    for (const key of ["text", "html", "raw"]) {
      if (key in obj && obj[key] !== undefined && obj[key] !== null) {
        return readReviewContent(obj[key]);
      }
    }

    // Case 1C: Empty object
    if (Object.keys(obj).length === 0) {
      return JSON.stringify(EMPTY_TIPTAP_DOC);
    }

    return JSON.stringify(obj);
  }

  // 2. If it's a string, it could be a JSON-serialized Doc, a JSON-serialized wrapper, or raw text/html
  if (typeof content === "string") {
    const trimmed = content.trim();
    if (!trimmed || trimmed === "{}" || trimmed === "null" || trimmed === '""') {
      return JSON.stringify(EMPTY_TIPTAP_DOC);
    }

    // Attempt JSON parse
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") {
        return readReviewContent(parsed);
      }
    } catch {
      // Not JSON; continue to plain-text fallback
    }

    // Plain text fallback into a canonical paragraph node
    return JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: trimmed }],
        },
      ],
    });
  }

  return JSON.stringify(EMPTY_TIPTAP_DOC);
}

function asTimestamp(val: unknown): number {
  if (!val) return Date.now();
  if (typeof val === "number") return val;
  return new Date(val as string).getTime();
}

export type SavedDailyReviewEntity = {
  id: string;
  updatedAt: number;
  lockVersion: number;
};

async function saveRemote(review: DailyReviewItem): Promise<SavedDailyReviewEntity> {
  let contentPayload: unknown = review.content;
  if (typeof review.content === "string") {
    try {
      contentPayload = JSON.parse(review.content);
    } catch {
      const trimmed = review.content.trim();
      contentPayload = trimmed
        ? {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: trimmed }],
              },
            ],
          }
        : EMPTY_TIPTAP_DOC;
    }
  }

  const saved = await apiClient.post<any>("/api/v1/daily-reviews", {
    id: review.id,
    date: review.date,
    content: contentPayload,
    lock_version: review.lockVersion ?? 1,
  });
  return {
    id: saved.id || review.id,
    updatedAt: asTimestamp(saved.updated_at || saved.updatedAt),
    lockVersion: Number(saved.lock_version || saved.lockVersion || 1),
  };
}

registerOfflineExecutor("daily-review:save", async (payload) => {
  await saveRemote(payload as DailyReviewItem);
});

export const dailyReviewApi = {
  loadAll: async (): Promise<DailyReviewItem[]> => {
    try {
      const dbReviews = await apiClient.get<any[]>("/api/v1/daily-reviews");
      if (dbReviews && Array.isArray(dbReviews)) {
        const reviews: DailyReviewItem[] = dbReviews.map((r) => {
          const contentStr = readReviewContent(r.content);
          return {
            id: r.id,
            date: typeof r.date === "string" ? r.date.substring(0, 10) : new Date(r.date).toISOString().substring(0, 10),
            content: contentStr,
            createdAt: asTimestamp(r.created_at || r.createdAt),
            updatedAt: asTimestamp(r.updated_at || r.updatedAt),
            lockVersion: Number(r.lock_version ?? r.lockVersion ?? 1),
            baseUpdatedAt: asTimestamp(r.updated_at || r.updatedAt),
          };
        });
        return reviews;
      }
    } catch (err) {
      console.error("[DailyReview] Error loading reviews:", err);
    }
    return [];
  },

  loadSummaries: async (): Promise<DailyReviewSummary[]> => {
    try {
      const dbSummaries = await apiClient.get<any[]>("/api/v1/daily-reviews/summaries");
      if (dbSummaries && Array.isArray(dbSummaries)) {
        return dbSummaries.map((s) => ({
          id: s.id,
          date: typeof s.date === "string" ? s.date.substring(0, 10) : new Date(s.date).toISOString().substring(0, 10),
          createdAt: asTimestamp(s.created_at || s.createdAt),
          updatedAt: asTimestamp(s.updated_at || s.updatedAt),
          lockVersion: Number(s.lock_version ?? s.lockVersion ?? 1),
        }));
      }
    } catch (err) {
      console.error("[DailyReview] Error loading summaries:", err);
    }
    return [];
  },

  loadByDate: async (date: string): Promise<DailyReviewItem | null> => {
    try {
      const r = await apiClient.get<any>(`/api/v1/daily-reviews/${date}`);
      if (!r || !r.id) return null;
      const contentStr = readReviewContent(r.content);
      return {
        id: r.id,
        date: typeof r.date === "string" ? r.date.substring(0, 10) : new Date(r.date).toISOString().substring(0, 10),
        content: contentStr,
        createdAt: asTimestamp(r.created_at || r.createdAt),
        updatedAt: asTimestamp(r.updated_at || r.updatedAt),
        lockVersion: Number(r.lock_version ?? r.lockVersion ?? 1),
        baseUpdatedAt: asTimestamp(r.updated_at || r.updatedAt),
      };
    } catch {
      // 404 is normal when no review exists for this date
      return null;
    }
  },

  loadStats: async (): Promise<CompoundStats> => {
    try {
      const stats = await apiClient.get<any>("/api/v1/daily-reviews/stats");
      if (stats) {
        return {
          currentStreak: stats.current_streak ?? 0,
          longestStreak: stats.longest_streak ?? 0,
          totalReviews: stats.total_reviews ?? 0,
          compoundValue: stats.compound_value ?? 1.0,
        };
      }
    } catch (err) {
      console.error("[DailyReview] Error loading stats:", err);
    }
    return { currentStreak: 0, longestStreak: 0, totalReviews: 0, compoundValue: 1.0 };
  },

  loadHeatmap: async (year: number): Promise<DailyReviewHeatmap> => {
    try {
      const data = await apiClient.get<any>(`/api/v1/daily-reviews/heatmap?year=${year}`);
      if (data) {
        return {
          year: data.year ?? year,
          days: data.days ?? {},
        };
      }
    } catch (err) {
      console.error("[DailyReview] Error loading heatmap:", err);
    }
    return { year, days: {} };
  },

  upsertReview: async (review: DailyReviewItem): Promise<SavedDailyReviewEntity | undefined> => {
    return runOrQueue({ kind: "daily-review:save", key: `daily-review:${review.date}`, payload: review }, () => saveRemote(review));
  },
};
