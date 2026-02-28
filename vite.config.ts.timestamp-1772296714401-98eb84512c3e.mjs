// vite.config.ts
import { defineConfig, splitVendorChunkPlugin } from "file:///C:/Users/Quise/Downloads/aeee/auto-editor-pro/frontend/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/Quise/Downloads/aeee/auto-editor-pro/frontend/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import { componentTagger } from "file:///C:/Users/Quise/Downloads/aeee/auto-editor-pro/frontend/node_modules/lovable-tagger/dist/index.js";
var __vite_injected_original_dirname = "C:\\Users\\Quise\\Downloads\\aeee\\auto-editor-pro\\frontend";
var vite_config_default = defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false
    },
    watch: {
      ignored: [
        "**/.playwright-cli/**",
        "**/output/**",
        "**/outputs/**",
        "**/public/creator-cards.html",
        "**/*.log"
      ]
    },
    proxy: {
      // Proxy /api to backend during local development. Target is configurable via
      // VITE_API_PROXY_TARGET (set in .env.local or .env) and falls back to localhost:4000.
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET || "http://localhost:4000",
        changeOrigin: true,
        secure: false
      },
      "/outputs": {
        target: process.env.VITE_API_PROXY_TARGET || "http://localhost:4000",
        changeOrigin: true,
        secure: false
      }
    },
    fs: {
      allow: [".."]
    }
  },
  plugins: [react(), splitVendorChunkPlugin(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src"),
      "@shared": path.resolve(__vite_injected_original_dirname, "./src/shared")
    }
  },
  build: {
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules/recharts")) return "vendor-charts";
          return void 0;
        }
      }
    }
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxRdWlzZVxcXFxEb3dubG9hZHNcXFxcYWVlZVxcXFxhdXRvLWVkaXRvci1wcm9cXFxcZnJvbnRlbmRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXFF1aXNlXFxcXERvd25sb2Fkc1xcXFxhZWVlXFxcXGF1dG8tZWRpdG9yLXByb1xcXFxmcm9udGVuZFxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvUXVpc2UvRG93bmxvYWRzL2FlZWUvYXV0by1lZGl0b3ItcHJvL2Zyb250ZW5kL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBzcGxpdFZlbmRvckNodW5rUGx1Z2luIH0gZnJvbSBcInZpdGVcIjtcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3Qtc3djXCI7XG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuaW1wb3J0IHsgY29tcG9uZW50VGFnZ2VyIH0gZnJvbSBcImxvdmFibGUtdGFnZ2VyXCI7XG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiAoe1xuICBzZXJ2ZXI6IHtcbiAgICBob3N0OiBcIjo6XCIsXG4gICAgcG9ydDogODA4MCxcbiAgICBobXI6IHtcbiAgICAgIG92ZXJsYXk6IGZhbHNlLFxuICAgIH0sXG4gICAgd2F0Y2g6IHtcbiAgICAgIGlnbm9yZWQ6IFtcbiAgICAgICAgXCIqKi8ucGxheXdyaWdodC1jbGkvKipcIixcbiAgICAgICAgXCIqKi9vdXRwdXQvKipcIixcbiAgICAgICAgXCIqKi9vdXRwdXRzLyoqXCIsXG4gICAgICAgIFwiKiovcHVibGljL2NyZWF0b3ItY2FyZHMuaHRtbFwiLFxuICAgICAgICBcIioqLyoubG9nXCIsXG4gICAgICBdLFxuICAgIH0sXG4gICAgcHJveHk6IHtcbiAgICAgIC8vIFByb3h5IC9hcGkgdG8gYmFja2VuZCBkdXJpbmcgbG9jYWwgZGV2ZWxvcG1lbnQuIFRhcmdldCBpcyBjb25maWd1cmFibGUgdmlhXG4gICAgICAvLyBWSVRFX0FQSV9QUk9YWV9UQVJHRVQgKHNldCBpbiAuZW52LmxvY2FsIG9yIC5lbnYpIGFuZCBmYWxscyBiYWNrIHRvIGxvY2FsaG9zdDo0MDAwLlxuICAgICAgXCIvYXBpXCI6IHtcbiAgICAgICAgdGFyZ2V0OiBwcm9jZXNzLmVudi5WSVRFX0FQSV9QUk9YWV9UQVJHRVQgfHwgXCJodHRwOi8vbG9jYWxob3N0OjQwMDBcIixcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICBzZWN1cmU6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIFwiL291dHB1dHNcIjoge1xuICAgICAgICB0YXJnZXQ6IHByb2Nlc3MuZW52LlZJVEVfQVBJX1BST1hZX1RBUkdFVCB8fCBcImh0dHA6Ly9sb2NhbGhvc3Q6NDAwMFwiLFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIHNlY3VyZTogZmFsc2UsXG4gICAgICB9LFxuICAgIH0sXG4gICAgZnM6IHtcbiAgICAgIGFsbG93OiBbXCIuLlwiXSxcbiAgICB9LFxuICB9LFxuICBwbHVnaW5zOiBbcmVhY3QoKSwgc3BsaXRWZW5kb3JDaHVua1BsdWdpbigpLCBtb2RlID09PSBcImRldmVsb3BtZW50XCIgJiYgY29tcG9uZW50VGFnZ2VyKCldLmZpbHRlcihCb29sZWFuKSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyY1wiKSxcbiAgICAgIFwiQHNoYXJlZFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjL3NoYXJlZFwiKSxcbiAgICB9LFxuICB9LFxuICBidWlsZDoge1xuICAgIGNodW5rU2l6ZVdhcm5pbmdMaW1pdDogNTUwLFxuICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgIG91dHB1dDoge1xuICAgICAgICBtYW51YWxDaHVua3M6IChpZCkgPT4ge1xuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9yZWNoYXJ0c1wiKSkgcmV0dXJuIFwidmVuZG9yLWNoYXJ0c1wiO1xuICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG59KSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQWtXLFNBQVMsY0FBYyw4QkFBOEI7QUFDdlosT0FBTyxXQUFXO0FBQ2xCLE9BQU8sVUFBVTtBQUNqQixTQUFTLHVCQUF1QjtBQUhoQyxJQUFNLG1DQUFtQztBQU16QyxJQUFPLHNCQUFRLGFBQWEsQ0FBQyxFQUFFLEtBQUssT0FBTztBQUFBLEVBQ3pDLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLEtBQUs7QUFBQSxNQUNILFNBQVM7QUFBQSxJQUNYO0FBQUEsSUFDQSxPQUFPO0FBQUEsTUFDTCxTQUFTO0FBQUEsUUFDUDtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLElBQ0EsT0FBTztBQUFBO0FBQUE7QUFBQSxNQUdMLFFBQVE7QUFBQSxRQUNOLFFBQVEsUUFBUSxJQUFJLHlCQUF5QjtBQUFBLFFBQzdDLGNBQWM7QUFBQSxRQUNkLFFBQVE7QUFBQSxNQUNWO0FBQUEsTUFDQSxZQUFZO0FBQUEsUUFDVixRQUFRLFFBQVEsSUFBSSx5QkFBeUI7QUFBQSxRQUM3QyxjQUFjO0FBQUEsUUFDZCxRQUFRO0FBQUEsTUFDVjtBQUFBLElBQ0Y7QUFBQSxJQUNBLElBQUk7QUFBQSxNQUNGLE9BQU8sQ0FBQyxJQUFJO0FBQUEsSUFDZDtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFNBQVMsQ0FBQyxNQUFNLEdBQUcsdUJBQXVCLEdBQUcsU0FBUyxpQkFBaUIsZ0JBQWdCLENBQUMsRUFBRSxPQUFPLE9BQU87QUFBQSxFQUN4RyxTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsTUFDcEMsV0FBVyxLQUFLLFFBQVEsa0NBQVcsY0FBYztBQUFBLElBQ25EO0FBQUEsRUFDRjtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsdUJBQXVCO0FBQUEsSUFDdkIsZUFBZTtBQUFBLE1BQ2IsUUFBUTtBQUFBLFFBQ04sY0FBYyxDQUFDLE9BQU87QUFDcEIsY0FBSSxHQUFHLFNBQVMsdUJBQXVCLEVBQUcsUUFBTztBQUNqRCxpQkFBTztBQUFBLFFBQ1Q7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRixFQUFFOyIsCiAgIm5hbWVzIjogW10KfQo=
