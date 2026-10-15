import React from "react";
import { SectionErrorBoundary } from "@/components/ui/SectionErrorBoundary";
import { TodayQuickAdd } from "@/features/time-management/components/TodayQuickAdd";
import { TodayTasksSection } from "@/features/time-management/components/TodayTasksSection";
import { TodayHabitsSection } from "@/features/habit/components/TodayHabitsSection";
import { TodayReviewSection } from "@/features/daily-review/components/TodayReviewSection";
import { TodayProjectTimeline } from "@/features/projects/components/TodayProjectTimeline";
import { useProjectsData } from "@/features/projects/hooks/useProjects";

export const TodayPage: React.FC = () => {
  const { data: projectsData } = useProjectsData();
  const projects = projectsData?.projects ?? [];
  const stages = projectsData?.stages ?? [];

  return (
    <SectionErrorBoundary
      fallbackTitle="今日工作台加载异常"
      fallbackMessage="今日视图遇到错误，请尝试重新加载。"
    >
      <div className="flex flex-col h-full w-full max-w-[1240px] mx-auto px-4 py-5 md:px-7 overflow-y-auto select-none space-y-4">
        {/* 顶部极速规划录入栏 */}
        <TodayQuickAdd projects={projects} stages={stages} />

        {/* 上屏：微观聚焦台 (紧凑双栏布局) */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)] gap-5 items-stretch">
          {/* 左栏：今日待办行动流 */}
          <TodayTasksSection
            projects={projects}
            stages={stages}
          />

          {/* 右栏：习惯追踪打卡与复盘快速记录 */}
          <div className="flex flex-col gap-3.5 h-[300px]">
            <TodayHabitsSection />
            <TodayReviewSection />
          </div>
        </div>

        {/* 下屏：项目全景时间轴与甘特图联动 */}
        <TodayProjectTimeline />
      </div>
    </SectionErrorBoundary>
  );
};
