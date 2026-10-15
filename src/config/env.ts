import { z } from "zod";

const envSchema = z.object({
  VITE_API_BASE_URL: z.string().url().optional(),
  VITE_WS_URL: z.string().optional(),
});

const parsed = envSchema.safeParse({
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  VITE_WS_URL: import.meta.env.VITE_WS_URL,
});

if (!parsed.success) {
  console.warn("Environment variable validation warnings:", parsed.error.format());
}

export const env = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8080",
  WS_URL: import.meta.env.VITE_WS_URL || "ws://localhost:8080/ws",
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
};
