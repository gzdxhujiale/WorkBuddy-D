import { supabase } from "@/lib/supabase";
import { DailyReviewItem } from "@/types/dailyReview";
import { DailyReviewRow } from "@/types/database";

const LOCAL_STORAGE_KEY = "fishbuddy_daily_reviews_v1";

function getLocalReviews(): DailyReviewItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalReviews(reviews: DailyReviewItem[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(reviews));
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
        .is("deleted_at", null)
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
        .is("deleted_at", null)
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
        };
        return review;
      }
    } catch (err) {
      console.warn("Supabase getByDate exception:", err);
    }

    return localMatch || null;
  },

  upsertReview: async (review: DailyReviewItem): Promise<void> => {
    // 1. Immediate local storage optimistic update
    const current = getLocalReviews();
    const idx = current.findIndex((r) => r.id === review.id || r.date === review.date);
    if (idx >= 0) {
      current[idx] = review;
    } else {
      current.push(review);
    }
    saveLocalReviews(current);

    // 2. Sync to Supabase
    try {
      const payload = {
        id: review.id || undefined,
        date: review.date,
        content: { text: review.content },
        created_at: review.createdAt ? new Date(review.createdAt).toISOString() : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("daily_reviews").upsert(payload, {
        onConflict: "user_id,date",
      });

      if (error) {
        console.warn("Supabase upsert daily review warning:", error.message);
      }
    } catch (e) {
      console.warn("Supabase daily review save exception:", e);
    }
  },

  deleteReview: async (id: string): Promise<void> => {
    // 1. Remove from local storage
    const current = getLocalReviews().filter((r) => r.id !== id);
    saveLocalReviews(current);

    // 2. Soft delete in Supabase
    try {
      const { error } = await supabase
        .from("daily_reviews")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);

      if (error) {
        console.warn("Supabase delete daily review warning:", error.message);
      }
    } catch (e) {
      console.warn("Supabase delete daily review exception:", e);
    }
  },
};
