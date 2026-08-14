import { supabase } from "@/lib/supabase";
import { DailyReviewItem } from "@/types/dailyReview";
import { throwOnPostgrestError } from "@/lib/sync";
import { registerOfflineExecutor, runOrQueue } from "@/lib/offlineSyncQueue";

function readReviewContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!content || typeof content !== "object") return "";

  const payload = content as Record<string, unknown>;
  for (const key of ["text", "html", "raw"]) {
    if (typeof payload[key] === "string") return payload[key];
  }

  return JSON.stringify(content);
}

async function saveRemote(review: DailyReviewItem): Promise<number> {
  const { data, error } = await supabase.rpc("save_daily_review", {
    p_id: review.id, p_date: review.date, p_content: { text: review.content },
    p_expected_updated_at: review.baseUpdatedAt ? new Date(review.baseUpdatedAt).toISOString() : null,
  });
  throwOnPostgrestError(error, "保存每日复盘");
  return new Date(data as string).getTime();
}

registerOfflineExecutor("daily-review:save", async (payload) => { await saveRemote(payload as DailyReviewItem); });

export const dailyReviewApi = {
  loadAll: async (): Promise<DailyReviewItem[]> => {
    try {
      const { data: dbReviews, error } = await supabase
        .from("daily_reviews")
        .select("id,date,content,created_at,updated_at")
        .gte("date", "2026-01-01")
        .order("date", { ascending: false });

      if (error) {
        throwOnPostgrestError(error, "加载每日复盘");
      }

      if (dbReviews && dbReviews.length >= 0) {
        const reviews: DailyReviewItem[] = dbReviews.map((r) => {
          const contentStr = readReviewContent(r.content);

          return {
            id: r.id,
            date: r.date,
            content: contentStr,
            createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
            updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
            baseUpdatedAt: r.updated_at ? new Date(r.updated_at).getTime() : undefined,
          };
        });

        return reviews;
      }
    } catch (err) {
      throw err;
    }

    return [];
  },

  getByDate: async (date: string): Promise<DailyReviewItem | null> => {
    try {
      const { data, error } = await supabase
        .from("daily_reviews")
        .select("id,date,content,created_at,updated_at")
        .eq("date", date)
        .maybeSingle();

      if (!error && data) {
        const contentStr = readReviewContent(data.content);

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
    } catch (err) { throw err; }
    return null;
  },

  upsertReview: async (review: DailyReviewItem): Promise<number | undefined> => {
    return runOrQueue({ kind: "daily-review:save", key: `daily-review:${review.date}`, payload: review }, () => saveRemote(review));
  },

};
