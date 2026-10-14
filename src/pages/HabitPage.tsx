import React from "react";
import { HabitPanel } from "@/features/habit/components/HabitPanel";
import { SectionErrorBoundary } from "@/components/ui/SectionErrorBoundary";

export const HabitPage: React.FC = () => {
  return (
    <SectionErrorBoundary
      fallbackTitle="习惯模块加载出错"
      fallbackMessage="习惯追踪视图遇到问题，请尝试重新加载。"
    >
      <HabitPanel />
    </SectionErrorBoundary>
  );
};
