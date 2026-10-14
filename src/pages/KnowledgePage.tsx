import React from "react";
import { KnowledgePanel } from "@/features/knowledge/components/KnowledgePanel";
import { SectionErrorBoundary } from "@/components/ui/SectionErrorBoundary";

export const KnowledgePage: React.FC = () => {
  return (
    <div className="h-full w-full overflow-hidden">
      <SectionErrorBoundary
        fallbackTitle="知识库加载异常"
        fallbackMessage="知识库视图遇到错误，请尝试重新加载。"
      >
        <KnowledgePanel />
      </SectionErrorBoundary>
    </div>
  );
};
