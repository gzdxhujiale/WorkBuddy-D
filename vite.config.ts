import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@douyinfe/semi-ui/dist/css/semi.css": path.resolve(__dirname, "./node_modules/@douyinfe/semi-ui/dist/css/semi.css"),
    },
  },
  clearScreen: false,
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        quickEdit: path.resolve(__dirname, "quick-edit.html"),
        focusAssistant: path.resolve(__dirname, "focus-assistant.html"),
        notificationToast: path.resolve(__dirname, "notification-toast.html"),
        noteWindow: path.resolve(__dirname, "note-window.html"),
      },
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules")) {
            if (id.includes("reactjs-tiptap-editor")) {
              return "tiptap-ui";
            }
            if (id.includes("prosemirror")) {
              return "prosemirror-vendor";
            }
            if (id.includes("@tiptap")) {
              return "tiptap-core";
            }
            if (id.includes("@tanstack")) {
              return "tanstack-vendor";
            }
            if (id.includes("@tauri-apps")) {
              return "tauri-vendor";
            }
            if (id.includes("dayjs")) {
              return "dayjs-vendor";
            }
            if (id.includes("lucide-react")) {
              return "lucide-vendor";
            }
            if (id.includes("react") || id.includes("react-dom") || id.includes("scheduler")) {
              return "react-vendor";
            }
          }
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
