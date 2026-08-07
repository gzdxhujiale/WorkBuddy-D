import React from "react";
import { DailyReviewPanel } from "@/components/daily-review/DailyReviewPanel";

export const DailyReviewPage: React.FC = () => {
  return (
    <div className="w-full h-full overflow-hidden">
      <DailyReviewPanel />
    </div>
  );
};
