import React, { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { FocusAssistant } from "@/features/focus/components/FocusAssistant";
import { queryClient } from "@/lib/queryClient";
import { WindowSessionGate } from "./WindowSessionGate";
import { useFocusTaskOptions } from "@/features/time-management/hooks/useTimeManagement";
import { useHabitData } from "@/features/habit/hooks/useHabits";
import { useProjectsData } from "@/features/projects/hooks/useProjects";

function FocusAssistantContent() {
  const { data: tasks = [], refetch: refetchTasks, isFetching: isFetchingTasks } = useFocusTaskOptions();
  const { data: habitData, refetch: refetchHabits, isFetching: isFetchingHabits } = useHabitData();
  const { data: projectData, refetch: refetchProjects, isFetching: isFetchingProjects } = useProjectsData();

  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const handleRefreshData = async () => {
    setIsManualRefreshing(true);
    try {
      await Promise.all([
        refetchTasks(),
        refetchHabits(),
        refetchProjects(),
      ]);
    } catch {
      // Ignore
    } finally {
      setIsManualRefreshing(false);
    }
  };

  const isDataRefreshing =
    isManualRefreshing || isFetchingTasks || isFetchingHabits || isFetchingProjects;

  return (
    <FocusAssistant
      targetData={{
        tasks,
        habits: habitData?.habits ?? [],
        projects: projectData?.projects ?? [],
        stages: projectData?.stages ?? [],
        projectTasks: projectData?.tasks ?? [],
        onRefreshData: handleRefreshData,
        isDataRefreshing,
      }}
    />
  );
}

export const FocusAssistantWindow: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <WindowSessionGate>
        <FocusAssistantContent />
      </WindowSessionGate>
    </QueryClientProvider>
  );
};
