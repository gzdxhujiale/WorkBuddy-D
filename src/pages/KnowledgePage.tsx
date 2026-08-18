import React from "react";
import { KnowledgePanel } from "@/components/knowledge/KnowledgePanel";

export const KnowledgePage: React.FC = () => {
  return (
    <div className="h-full w-full overflow-hidden">
      <KnowledgePanel />
    </div>
  );
};
