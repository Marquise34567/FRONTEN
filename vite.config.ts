import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const requestedPort = Number(process.env.VITE_DEV_PORT ?? process.env.PORT ?? 8080);
  const devPort = Number.isFinite(requestedPort) ? requestedPort : 8080;
  return {
    server: {
      host: "::",
      port: devPort,
      strictPort: false,
      hmr: {
        overlay: false,
      },
      watch: {
        ignored: [
          "**/.playwright-cli/**",
          "**/output/**",
          "**/outputs/**",
          "**/public/creator-cards.html",
          "**/*.log",
        ],
      },
      proxy: {
        // Proxy /api to backend during local development. Target is configurable via
        // VITE_API_PROXY_TARGET (set in .env.local or .env) and falls back to localhost:4000.
        "/api": {
          target: process.env.VITE_API_PROXY_TARGET || "http://localhost:4000",
          changeOrigin: true,
          secure: false,
        },
        "/outputs": {
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
        input: {
          main: path.resolve(__dirname, "index.html"),
          pricing: path.resolve(__dirname, "pricing.html"),
          privacyPolicy: path.resolve(__dirname, "privacy-policy.html"),
          howEditorWorks: path.resolve(__dirname, "how-editor-works.html"),
          login: path.resolve(__dirname, "login.html"),
          signup: path.resolve(__dirname, "signup.html"),
        },
        output: {
          manualChunks: (id) => {
            if (id.includes("node_modules/react-router") || id.includes("node_modules/react-dom") || id.includes("node_modules/react/")) {
              return "vendor-react";
            }
            if (id.includes("node_modules/@tanstack/react-query")) return "vendor-query";
            if (id.includes("node_modules/@radix-ui")) return "vendor-radix";
            if (id.includes("node_modules/recharts")) return "vendor-charts";
            if (id.includes("node_modules/react-player")) return "vendor-player";
            if (id.includes("node_modules/framer-motion")) return "vendor-motion";
            if (id.includes("node_modules/@supabase")) return "vendor-supabase";
            if (id.includes("node_modules/tus-js-client")) return "vendor-upload";
            return undefined;
          },
        },
      },
    },
  };
});
