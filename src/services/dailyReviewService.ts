import { supabase } from "@/lib/supabase";
import { DailyReviewItem } from "@/types/dailyReview";
import { DailyReviewRow } from "@/types/database";
import { throwOnPostgrestError } from "@/lib/sync";
import { userStorageKey } from "@/lib/userStorage";

const LOCAL_STORAGE_KEY = "fishbuddy_daily_reviews_v1";

function getLocalReviews(): DailyReviewItem[] {
  try {
    const raw = localStorage.getItem(userStorageKey(LOCAL_STORAGE_KEY));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalReviews(reviews: DailyReviewItem[]): void {
  try {
    localStorage.setItem(userStorageKey(LOCAL_STORAGE_KEY), JSON.stringify(reviews));
  } catch (e) {
    console.error("Failed to save local daily reviews:", e);
  }
}

export const dailyReviewApi = {
  loadAll: async (): Promise<DailyReviewItem[]> => {
    try {
      const { data: dbReviews, error } = await supabase
        .from("daily_reviews")
        .select("*")
        .order("date", { ascending: false });

      if (error) {
        console.warn("Supabase daily reviews load warning, using local cache:", error.message);
        return getLocalReviews();
      }

      if (dbReviews && dbReviews.length >= 0) {
        const reviews: DailyReviewItem[] = dbReviews.map((r: DailyReviewRow) => {
          let contentStr = "";
          if (typeof r.content === "string") {
            contentStr = r.content;
          } else if (r.content && typeof r.content === "object") {
            contentStr = (r.content as { text?: string; html?: string; raw?: string }).text || JSON.stringify(r.content);
          }

          return {
            id: r.id,
            date: r.date,
            content: contentStr,
            createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
            updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
            baseUpdatedAt: r.updated_at ? new Date(r.updated_at).getTime() : undefined,
          };
        });

        saveLocalReviews(reviews);
        return reviews;
      }
    } catch (err) {
      console.warn("Using local storage fallback for daily reviews load exception:", err);
    }

    return getLocalReviews();
  },

  getByDate: async (date: string): Promise<DailyReviewItem | null> => {
    const localList = getLocalReviews();
    const localMatch = localList.find((r) => r.date === date);

    try {
      const { data, error } = await supabase
        .from("daily_reviews")
        .select("*")
        .eq("date", date)
        .maybeSingle();

      if (!error && data) {
        let contentStr = "";
        if (typeof data.content === "string") {
          contentStr = data.content;
        } else if (data.content && typeof data.content === "object") {
          contentStr = (data.content as { text?: string }).text || JSON.stringify(data.content);
        }

        const review: DailyReviewItem = {
          id: data.id,
          date: data.date,
          content: contentStr,
          createdAt: data.created_at ? new Date(data.created_at).getTime() : Date.now(),
          updatedAt: data.updated_at ? new Date(data.updated_at).getTime() : Date.now(),
          baseUpdatedAt: data.updated_at ? new Date(data.updated_at).getTime() : undefined,
        };
        return review;
      }
    } catch (err) {
      console.warn("Supabase getByDate exception:", err);
    }

    return localMatch || null;
  },

  upsertReview: async (review: DailyReviewItem): Promise<number> => {
    // 1. Immediate local storage optimistic update
    const current = getLocalReviews();
    const idx = current.findIndex((r) => r.id === review.id || r.date === review.date);
    if (idx >= 0) {
      current[idx] = review;
    } else {
      current.push(review);
    }
    saveLocalReviews(current);

    const { data, error } = await supabase.rpc("save_daily_review", {
      p_id: review.id,
      p_date: review.date,
      p_content: { text: review.content },
      p_created_at: new Date(review.createdAt).toISOString(),
      p_expected_updated_at: review.baseUpdatedAt ? new Date(review.baseUpdatedAt).toISOString() : null,
      p_next_updated_at: new Date(review.updatedAt).toISOString(),
    });
    throwOnPostgrestError(error, "保存每日复盘");
    return new Date(data as string).getTime();
  },

  deleteReview: async (id: string): Promise<void> => {
    // 1. Remove from local storage
    const current = getLocalReviews().filter((r) => r.id !== id);
    saveLocalReviews(current);

    // 2. Delete from Supabase
    // Keep this compatible with databases that have not yet applied the optional
    // RPC migration. This is still a hard delete and is protected by the table's
    // existing RLS policy.
    const { error } = await supabase
      .from("daily_reviews")
      .delete()
      .eq("id", id);
    throwOnPostgrestError(error, "删除每日复盘");
  },
};
