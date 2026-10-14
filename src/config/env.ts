import { z } from "zod";

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url().optional(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
});

if (!parsed.success) {
  console.warn("Environment variable validation warnings:", parsed.error.format());
}

export const env = {
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || "",
  SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
};
