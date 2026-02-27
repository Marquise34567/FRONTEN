import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const resolveManualChunk = (id: string) => {
  if (!id.includes("node_modules")) return undefined;
  if (id.includes("framer-motion")) return "vendor-motion";
  if (id.includes("recharts")) return "vendor-charts";
  if (id.includes("@radix-ui") || id.includes("cmdk") || id.includes("vaul")) return "vendor-ui";
  if (id.includes("@supabase") || id.includes("socket.io")) return "vendor-data";
  if (id.includes("lucide-react")) return "vendor-icons";
  if (id.includes("i18next") || id.includes("react-i18next")) return "vendor-i18n";
  if (id.includes("react-router") || id.includes("@tanstack/react-query")) return "vendor-routing";
  return "vendor";
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      // Proxy /api to backend during local development. Target is configurable via
      // VITE_API_PROXY_TARGET (set in .env.local or .env) and falls back to localhost:4000.
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET || "http://localhost:4000",
        changeOrigin: true,
        secure: false,
      },
    },
    fs: {
      allow: [".."],
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "./src/shared"),
    },
  },
  build: {
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      output: {
        manualChunks: resolveManualChunk,
      },
    },
  },
}));
