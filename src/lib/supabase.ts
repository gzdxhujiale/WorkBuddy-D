import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn('Supabase URL or Publishable Key is missing from environment variables.');
}

// React Query owns query lifecycle. Disable Supabase's built-in PostgREST
// retries so a 503 cannot be retried independently by both layers and across
// every open Tauri webview.
export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  db: { retry: false },
});
