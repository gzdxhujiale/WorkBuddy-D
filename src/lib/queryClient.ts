import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      // A failed data request is surfaced to the UI. Retrying every mounted
      // query at once can exhaust the Data API connection pool during a 503.
      retry: false,
      staleTime: 30_000,
    },
  },
});
