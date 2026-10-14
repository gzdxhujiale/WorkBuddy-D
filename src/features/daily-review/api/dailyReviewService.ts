import { apiClient } from "@/lib/apiClient";
import { DailyReviewItem } from "../types";
import { registerOfflineExecutor, runOrQueue } from "@/lib/offlineSyncQueue";

function tryParseJson(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function tryDecodeBase64(str: string): string | null {
  if (!str || str.length < 8 || /[\s{}]/.test(str)) return null;
  try {
    const decoded = atob(str);
    if (decoded.startsWith("{") || decoded.startsWith("[")) {
      return decoded;
    }
  } catch {
    // Not valid base64
  }
  return null;
}

function readReviewContent(content: unknown): string {
  if (!content) return "";

  // 1. If it's a string, it might be raw text, a JSON string, or a Base64-encoded string
  if (typeof content === "string") {
    const trimmed = content.trim();
    if (!trimmed) return "";

    // Check if it's base64 encoded
    const decodedBase64 = tryDecodeBase64(trimmed);
    if (decodedBase64) {
      return readReviewContent(tryParseJson(decodedBase64) ?? decodedBase64);
    }

    // Check if it's a JSON string representing a wrapper object { text: "..." } or tiptap doc
    const parsed = tryParseJson(trimmed);
    if (parsed && typeof parsed === "object") {
      return readReviewContent(parsed);
    }

    return trimmed;
  }

  // 2. If it's an object, check for wrapper keys: text, html, raw
  if (typeof content === "object") {
    const payload = content as Record<string, unknown>;

    // If it's directly a Tiptap Doc
    if (payload.type === "doc" && Array.isArray(payload.content)) {
      return JSON.stringify(content);
    }

    // If it's a wrapper like { text: "..." }
    for (const key of ["text", "html", "raw"]) {
      if (typeof payload[key] === "string") {
        return readReviewContent(payload[key]);
      }
    }

    return JSON.stringify(content);
  }

  return String(content);
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
  const saved = await apiClient.post<any>("/api/v1/daily-reviews", {
    id: review.id,
    date: review.date,
    content: { text: review.content },
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

  upsertReview: async (review: DailyReviewItem): Promise<SavedDailyReviewEntity | undefined> => {
    return runOrQueue({ kind: "daily-review:save", key: `daily-review:${review.date}`, payload: review }, () => saveRemote(review));
  },
};
