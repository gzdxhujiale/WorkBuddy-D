import React from "react";
import { TimeManagementPanel } from "@/features/time-management/components/TimeManagementPanel";
import { useProjectsData } from "@/features/projects/hooks/useProjects";
import { SectionErrorBoundary } from "@/components/ui/SectionErrorBoundary";

export const FourQuadrantsPage: React.FC = () => {
  const { data: projectsData } = useProjectsData();

  return (
    <SectionErrorBoundary
      fallbackTitle="任务中心加载异常"
      fallbackMessage="四象限任务视图遇到错误，请尝试刷新重试。"
    >
      <TimeManagementPanel
        projects={projectsData?.projects}
        stages={projectsData?.stages}
      />
    </SectionErrorBoundary>
  );
};
