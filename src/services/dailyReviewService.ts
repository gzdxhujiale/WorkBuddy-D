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

export type SavedDailyReviewVersion = { updatedAt: number; lockVersion: number };

async function saveRemote(review: DailyReviewItem): Promise<SavedDailyReviewVersion> {
  const { data, error } = await supabase.rpc("save_daily_review_v2", {
    p_id: review.id, p_date: review.date, p_content: { text: review.content },
    p_expected_lock_version: review.lockVersion ?? null,
  });
  throwOnPostgrestError(error, "保存每日复盘");
  const saved = (data as Array<{ updated_at: string; lock_version: number }>)[0];
  return { updatedAt: new Date(saved.updated_at).getTime(), lockVersion: Number(saved.lock_version) };
}

registerOfflineExecutor("daily-review:save", async (payload) => { await saveRemote(payload as DailyReviewItem); });

export const dailyReviewApi = {
  loadAll: async (): Promise<DailyReviewItem[]> => {
    try {
      const { data: dbReviews, error } = await supabase
        .from("daily_reviews")
        .select("id,date,content,created_at,updated_at,lock_version")
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
            lockVersion: Number(r.lock_version),
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
        .select("id,date,content,created_at,updated_at,lock_version")
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
          lockVersion: Number(data.lock_version),
          baseUpdatedAt: data.updated_at ? new Date(data.updated_at).getTime() : undefined,
        };
        return review;
      }
    } catch (err) { throw err; }
    return null;
  },

  upsertReview: async (review: DailyReviewItem): Promise<SavedDailyReviewVersion | undefined> => {
    return runOrQueue({ kind: "daily-review:save", key: `daily-review:${review.date}`, payload: review }, () => saveRemote(review));
  },

};
