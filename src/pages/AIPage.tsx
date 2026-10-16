import React from "react";
import { SectionErrorBoundary } from "@/components/ui/SectionErrorBoundary";
import { AIWorkspace } from "@/features/ai";

export const AIPage: React.FC = () => {
  return (
    <SectionErrorBoundary
      fallbackTitle="AI 工作台加载异常"
      fallbackMessage="AI 对话工作台遇到错误，请尝试重新加载。"
    >
      <div className="flex flex-col h-full w-full overflow-hidden">
        <AIWorkspace />
      </div>
    </SectionErrorBoundary>
  );
};
