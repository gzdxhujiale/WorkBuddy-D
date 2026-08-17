import React from "react";
import { Navigation } from "lucide-react";

export const MissionPage: React.FC = () => {
  return (
    <div className="p-6 h-full overflow-y-auto">
      <header className="mb-6">
        <h1 className="text-base font-bold text-foreground flex items-center gap-2">
          <Navigation className="text-purple-600 dark:text-purple-400" size={20} />
          人生罗盘
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          锚定长期愿景、使命与终极愿景
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card p-5 rounded-xl border border-border">
          <h3 className="font-semibold text-foreground mb-1">🎯 核心愿景</h3>
          <p className="text-xs text-muted-foreground">定义你未来 3-5 年期望达到的生活与事业状态</p>
        </div>
        <div className="bg-card p-5 rounded-xl border border-border">
          <h3 className="font-semibold text-foreground mb-1">🧭 价值观与原则</h3>
          <p className="text-xs text-muted-foreground">指导决策与日常行动的底层基准准则</p>
        </div>
      </div>
    </div>
  );
};
