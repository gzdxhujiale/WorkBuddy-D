import React from "react";
import { DailyReviewPanel } from "@/features/daily-review/components/DailyReviewPanel";
import { SectionErrorBoundary } from "@/components/ui/SectionErrorBoundary";

export const DailyReviewPage: React.FC = () => {
  return (
    <div className="w-full h-full overflow-hidden">
      <SectionErrorBoundary
        fallbackTitle="每日复盘加载异常"
        fallbackMessage="复盘面板遇到错误，请尝试刷新重试。"
      >
        <DailyReviewPanel />
      </SectionErrorBoundary>
    </div>
  );
};
