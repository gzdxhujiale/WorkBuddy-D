import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn('Supabase URL or Publishable Key is missing from environment variables.');
}

// React Query owns query lifecycle. Disable Supabase's built-in PostgREST
// retries so a 503 cannot be retried independently by both layers and across
// every open Tauri webview.
//
// A Supabase platform outage can return 521 without CORS headers. In a Tauri
// app every webview may then keep trying the same refresh request. Pause the
// auth refresh loop briefly so the outage does not turn into a request storm.
let client: any = null;
let resumeRefreshTimer: ReturnType<typeof setTimeout> | undefined;

const resilientFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  if (response.status === 521 && client) {
    client.auth.stopAutoRefresh();
    if (resumeRefreshTimer) clearTimeout(resumeRefreshTimer);
    resumeRefreshTimer = setTimeout(() => {
      client?.auth.startAutoRefresh();
      resumeRefreshTimer = undefined;
    }, 30_000);
  }
  return response;
};

export const supabase = client = createClient<Database>(supabaseUrl, supabasePublishableKey, {
  db: { retry: false },
  global: { fetch: resilientFetch },
});
