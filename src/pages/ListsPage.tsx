import React from "react";
import { ListsPanel } from "@/components/lists/ListsPanel";

export const ListsPage: React.FC = () => {
  return (
    <div className="h-full w-full overflow-hidden">
      <ListsPanel />
    </div>
  );
};
