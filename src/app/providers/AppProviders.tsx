import React, { type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { AppErrorBoundary } from "@/components/ui/AppErrorBoundary";

interface AppProvidersProps {
  children: ReactNode;
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <AppErrorBoundary>
        {children}
      </AppErrorBoundary>
    </QueryClientProvider>
  );
};
