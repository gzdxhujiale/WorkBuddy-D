import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      // Realtime is the source of cross-window invalidation. Refetching every
      // active query again on a network reconnect can create a request burst
      // and exhaust Supabase's connection pool.
      refetchOnReconnect: false,
      refetchOnMount: false,
      retryOnMount: false,
      // A failed data request is surfaced to the UI. Retrying every mounted
      // query at once can exhaust the Data API connection pool during a 503.
      retry: false,
      staleTime: 30_000,
    },
  },
});
