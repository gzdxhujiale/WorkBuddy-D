import { supabase } from "@/lib/supabase";
import { DailyReviewItem } from "@/types/dailyReview";
import { throwOnPostgrestError } from "@/lib/sync";
import { registerOfflineExecutor, runOrQueue } from "@/lib/offlineSyncQueue";

async function saveRemote(review: DailyReviewItem): Promise<number> {
  const { data, error } = await supabase.rpc("save_daily_review", {
    p_id: review.id, p_date: review.date, p_content: { text: review.content },
    p_created_at: new Date(review.createdAt).toISOString(),
    p_expected_updated_at: review.baseUpdatedAt ? new Date(review.baseUpdatedAt).toISOString() : null,
    p_next_updated_at: new Date(review.updatedAt).toISOString(),
  });
  throwOnPostgrestError(error, "保存每日复盘");
  return new Date(data as string).getTime();
}

registerOfflineExecutor("daily-review:save", async (payload) => { await saveRemote(payload as DailyReviewItem); });
registerOfflineExecutor("daily-review:delete", async (payload) => {
  const { error } = await supabase.from("daily_reviews").delete().eq("id", payload as string);
  throwOnPostgrestError(error, "删除每日复盘");
});

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
    } catch (err) { throw err; }
    return null;
  },

  upsertReview: async (review: DailyReviewItem): Promise<number | undefined> => {
    return runOrQueue({ kind: "daily-review:save", key: `daily-review:${review.date}`, payload: review }, () => saveRemote(review));
  },

  deleteReview: async (id: string): Promise<void> => {
    await runOrQueue({ kind: "daily-review:delete", key: `daily-review:${id}`, payload: id }, async () => {
      const { error } = await supabase.from("daily_reviews").delete().eq("id", id);
      throwOnPostgrestError(error, "删除每日复盘");
    });
  },
};
