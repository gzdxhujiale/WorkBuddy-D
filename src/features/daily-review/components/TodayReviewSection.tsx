import React, { useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronRight, Sparkles, BookOpen } from "lucide-react";
import { useDailyReviewDetail, useReviewActions, isReviewEmpty, extractReviewPlainText } from "../hooks/useDailyReview";
import { todayYMD } from "@/lib/dateUtils";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { PixelScroll } from "@/components/pixel/PixelIcons";
import { cn } from "@/lib/utils";

export const TodayReviewSection: React.FC = () => {
  const { isPixelTheme } = useAppThemeStyle();
  const navigate = useNavigate();
  const today = todayYMD();

  const { data: todayReview } = useDailyReviewDetail(today);
  const { saveReview } = useReviewActions();

  const reviewWritten = useMemo(() => Boolean(todayReview && !isReviewEmpty(todayReview.content)), [todayReview]);
  const reviewSummary = useMemo(() => extractReviewPlainText(todayReview?.content), [todayReview?.content]);

  const [reviewInput, setReviewInput] = useState("");
  const [isSavedFeedback, setIsSavedFeedback] = useState(false);

  const handleSaveInitialReview = () => {
    if (!reviewInput.trim() || reviewWritten) return;
    const tiptapJson = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: reviewInput.trim() }],
        },
      ],
    });
    saveReview(today, tiptapJson);
    setReviewInput("");
    setIsSavedFeedback(true);
    setTimeout(() => setIsSavedFeedback(false), 2000);
  };

  return (
    <div
      className={cn(
        "flex-1 bg-card p-3 flex flex-col justify-between overflow-hidden",
        isPixelTheme
          ? "border-2 border-border/90 rounded-xl shadow-[3px_3px_0px_rgba(0,0,0,0.1)] font-mono"
          : "border border-border rounded-xl shadow-2xs"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
          {isPixelTheme ? <PixelScroll size={14} /> : <Sparkles size={14} className="text-purple-500" />}
          <span>{isPixelTheme ? "今日冒险日志" : "今日深度复盘"}</span>
        </div>
        <button
          type="button"
          onClick={() => navigate({ to: "/daily-review" })}
          className="text-[11px] text-primary hover:underline flex items-center gap-0.5 font-medium cursor-pointer"
        >
          <span>完整复盘</span>
          <ChevronRight size={11} />
        </button>
      </div>

      {/* Review Content / Quick Input */}
      <div className="my-1">
        {reviewWritten ? (
          <div
            onClick={() => navigate({ to: "/daily-review" })}
            className={cn(
              "w-full px-2.5 py-1.5 text-xs bg-muted/30 border border-border/60 text-muted-foreground transition-colors cursor-pointer flex items-center justify-between hover:bg-muted/60",
              isPixelTheme ? "rounded-xs font-mono" : "rounded-lg"
            )}
            title="点击前往复盘中心编辑完整内容"
          >
            <span className="truncate max-w-[240px] text-foreground font-medium">
              {reviewSummary || "今日复盘已就绪"}
            </span>
            <span className="text-[10px] text-primary shrink-0 flex items-center gap-0.5">
              <BookOpen size={11} />
              <span>查看</span>
            </span>
          </div>
        ) : (
          <input
            type="text"
            value={reviewInput}
            onChange={(e) => setReviewInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveInitialReview();
            }}
            placeholder="记录今日心得与收获，回车保存..."
            className={cn(
              "w-full px-2.5 py-1 text-xs bg-muted/40 border border-border/70 text-foreground placeholder:text-muted-foreground/60 outline-hidden transition-colors",
              isPixelTheme
                ? "rounded-xs focus:border-amber-600 font-mono"
                : "rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20"
            )}
          />
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/50 pt-1.5">
        <span>{reviewWritten ? "✅ 今日日志已就绪" : "⏳ 尚未提交复盘"}</span>
        <span className={cn("text-[10px]", isSavedFeedback ? "text-emerald-500 font-bold" : "text-muted-foreground/50")}>
          {isSavedFeedback ? "✓ 已保存" : reviewWritten ? "已保护排版" : "按 Enter 保存"}
        </span>
      </div>
    </div>
  );
};
