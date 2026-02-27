// vite.config.ts
import { defineConfig } from "file:///C:/Users/Quise/Downloads/aeee/auto-editor-pro/frontend/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/Quise/Downloads/aeee/auto-editor-pro/frontend/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import { componentTagger } from "file:///C:/Users/Quise/Downloads/aeee/auto-editor-pro/frontend/node_modules/lovable-tagger/dist/index.js";
var __vite_injected_original_dirname = "C:\\Users\\Quise\\Downloads\\aeee\\auto-editor-pro\\frontend";
var resolveManualChunk = (id) => {
  if (!id.includes("node_modules")) return void 0;
  if (id.includes("framer-motion")) return "vendor-motion";
  if (id.includes("recharts")) return "vendor-charts";
  if (id.includes("@supabase") || id.includes("socket.io")) return "vendor-data";
  if (id.includes("lucide-react")) return "vendor-icons";
  if (id.includes("i18next") || id.includes("react-i18next")) return "vendor-i18n";
  if (id.includes("react-router") || id.includes("@tanstack/react-query")) return "vendor-routing";
  if (id.includes("react-player") || id.includes("react-resizable") || id.includes("tus-js-client")) return "vendor-editor";
  return void 0;
};
var vite_config_default = defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false
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
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
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
        manualChunks: resolveManualChunk
      }
    }
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxRdWlzZVxcXFxEb3dubG9hZHNcXFxcYWVlZVxcXFxhdXRvLWVkaXRvci1wcm9cXFxcZnJvbnRlbmRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXFF1aXNlXFxcXERvd25sb2Fkc1xcXFxhZWVlXFxcXGF1dG8tZWRpdG9yLXByb1xcXFxmcm9udGVuZFxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvUXVpc2UvRG93bmxvYWRzL2FlZWUvYXV0by1lZGl0b3ItcHJvL2Zyb250ZW5kL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3Qtc3djXCI7XG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuaW1wb3J0IHsgY29tcG9uZW50VGFnZ2VyIH0gZnJvbSBcImxvdmFibGUtdGFnZ2VyXCI7XG5cbmNvbnN0IHJlc29sdmVNYW51YWxDaHVuayA9IChpZDogc3RyaW5nKSA9PiB7XG4gIGlmICghaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXNcIikpIHJldHVybiB1bmRlZmluZWQ7XG4gIGlmIChpZC5pbmNsdWRlcyhcImZyYW1lci1tb3Rpb25cIikpIHJldHVybiBcInZlbmRvci1tb3Rpb25cIjtcbiAgaWYgKGlkLmluY2x1ZGVzKFwicmVjaGFydHNcIikpIHJldHVybiBcInZlbmRvci1jaGFydHNcIjtcbiAgaWYgKGlkLmluY2x1ZGVzKFwiQHN1cGFiYXNlXCIpIHx8IGlkLmluY2x1ZGVzKFwic29ja2V0LmlvXCIpKSByZXR1cm4gXCJ2ZW5kb3ItZGF0YVwiO1xuICBpZiAoaWQuaW5jbHVkZXMoXCJsdWNpZGUtcmVhY3RcIikpIHJldHVybiBcInZlbmRvci1pY29uc1wiO1xuICBpZiAoaWQuaW5jbHVkZXMoXCJpMThuZXh0XCIpIHx8IGlkLmluY2x1ZGVzKFwicmVhY3QtaTE4bmV4dFwiKSkgcmV0dXJuIFwidmVuZG9yLWkxOG5cIjtcbiAgaWYgKGlkLmluY2x1ZGVzKFwicmVhY3Qtcm91dGVyXCIpIHx8IGlkLmluY2x1ZGVzKFwiQHRhbnN0YWNrL3JlYWN0LXF1ZXJ5XCIpKSByZXR1cm4gXCJ2ZW5kb3Itcm91dGluZ1wiO1xuICBpZiAoaWQuaW5jbHVkZXMoXCJyZWFjdC1wbGF5ZXJcIikgfHwgaWQuaW5jbHVkZXMoXCJyZWFjdC1yZXNpemFibGVcIikgfHwgaWQuaW5jbHVkZXMoXCJ0dXMtanMtY2xpZW50XCIpKSByZXR1cm4gXCJ2ZW5kb3ItZWRpdG9yXCI7XG4gIHJldHVybiB1bmRlZmluZWQ7XG59O1xuXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4gKHtcbiAgc2VydmVyOiB7XG4gICAgaG9zdDogXCI6OlwiLFxuICAgIHBvcnQ6IDgwODAsXG4gICAgaG1yOiB7XG4gICAgICBvdmVybGF5OiBmYWxzZSxcbiAgICB9LFxuICAgIHByb3h5OiB7XG4gICAgICAvLyBQcm94eSAvYXBpIHRvIGJhY2tlbmQgZHVyaW5nIGxvY2FsIGRldmVsb3BtZW50LiBUYXJnZXQgaXMgY29uZmlndXJhYmxlIHZpYVxuICAgICAgLy8gVklURV9BUElfUFJPWFlfVEFSR0VUIChzZXQgaW4gLmVudi5sb2NhbCBvciAuZW52KSBhbmQgZmFsbHMgYmFjayB0byBsb2NhbGhvc3Q6NDAwMC5cbiAgICAgIFwiL2FwaVwiOiB7XG4gICAgICAgIHRhcmdldDogcHJvY2Vzcy5lbnYuVklURV9BUElfUFJPWFlfVEFSR0VUIHx8IFwiaHR0cDovL2xvY2FsaG9zdDo0MDAwXCIsXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgc2VjdXJlOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICBcIi9vdXRwdXRzXCI6IHtcbiAgICAgICAgdGFyZ2V0OiBwcm9jZXNzLmVudi5WSVRFX0FQSV9QUk9YWV9UQVJHRVQgfHwgXCJodHRwOi8vbG9jYWxob3N0OjQwMDBcIixcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICBzZWN1cmU6IGZhbHNlLFxuICAgICAgfSxcbiAgICB9LFxuICAgIGZzOiB7XG4gICAgICBhbGxvdzogW1wiLi5cIl0sXG4gICAgfSxcbiAgfSxcbiAgcGx1Z2luczogW3JlYWN0KCksIG1vZGUgPT09IFwiZGV2ZWxvcG1lbnRcIiAmJiBjb21wb25lbnRUYWdnZXIoKV0uZmlsdGVyKEJvb2xlYW4pLFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxuICAgICAgXCJAc2hhcmVkXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9zcmMvc2hhcmVkXCIpLFxuICAgIH0sXG4gIH0sXG4gIGJ1aWxkOiB7XG4gICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiA1NTAsXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIG1hbnVhbENodW5rczogcmVzb2x2ZU1hbnVhbENodW5rLFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxufSkpO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFrVyxTQUFTLG9CQUFvQjtBQUMvWCxPQUFPLFdBQVc7QUFDbEIsT0FBTyxVQUFVO0FBQ2pCLFNBQVMsdUJBQXVCO0FBSGhDLElBQU0sbUNBQW1DO0FBS3pDLElBQU0scUJBQXFCLENBQUMsT0FBZTtBQUN6QyxNQUFJLENBQUMsR0FBRyxTQUFTLGNBQWMsRUFBRyxRQUFPO0FBQ3pDLE1BQUksR0FBRyxTQUFTLGVBQWUsRUFBRyxRQUFPO0FBQ3pDLE1BQUksR0FBRyxTQUFTLFVBQVUsRUFBRyxRQUFPO0FBQ3BDLE1BQUksR0FBRyxTQUFTLFdBQVcsS0FBSyxHQUFHLFNBQVMsV0FBVyxFQUFHLFFBQU87QUFDakUsTUFBSSxHQUFHLFNBQVMsY0FBYyxFQUFHLFFBQU87QUFDeEMsTUFBSSxHQUFHLFNBQVMsU0FBUyxLQUFLLEdBQUcsU0FBUyxlQUFlLEVBQUcsUUFBTztBQUNuRSxNQUFJLEdBQUcsU0FBUyxjQUFjLEtBQUssR0FBRyxTQUFTLHVCQUF1QixFQUFHLFFBQU87QUFDaEYsTUFBSSxHQUFHLFNBQVMsY0FBYyxLQUFLLEdBQUcsU0FBUyxpQkFBaUIsS0FBSyxHQUFHLFNBQVMsZUFBZSxFQUFHLFFBQU87QUFDMUcsU0FBTztBQUNUO0FBR0EsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxLQUFLLE9BQU87QUFBQSxFQUN6QyxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixLQUFLO0FBQUEsTUFDSCxTQUFTO0FBQUEsSUFDWDtBQUFBLElBQ0EsT0FBTztBQUFBO0FBQUE7QUFBQSxNQUdMLFFBQVE7QUFBQSxRQUNOLFFBQVEsUUFBUSxJQUFJLHlCQUF5QjtBQUFBLFFBQzdDLGNBQWM7QUFBQSxRQUNkLFFBQVE7QUFBQSxNQUNWO0FBQUEsTUFDQSxZQUFZO0FBQUEsUUFDVixRQUFRLFFBQVEsSUFBSSx5QkFBeUI7QUFBQSxRQUM3QyxjQUFjO0FBQUEsUUFDZCxRQUFRO0FBQUEsTUFDVjtBQUFBLElBQ0Y7QUFBQSxJQUNBLElBQUk7QUFBQSxNQUNGLE9BQU8sQ0FBQyxJQUFJO0FBQUEsSUFDZDtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFNBQVMsQ0FBQyxNQUFNLEdBQUcsU0FBUyxpQkFBaUIsZ0JBQWdCLENBQUMsRUFBRSxPQUFPLE9BQU87QUFBQSxFQUM5RSxTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsTUFDcEMsV0FBVyxLQUFLLFFBQVEsa0NBQVcsY0FBYztBQUFBLElBQ25EO0FBQUEsRUFDRjtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsdUJBQXVCO0FBQUEsSUFDdkIsZUFBZTtBQUFBLE1BQ2IsUUFBUTtBQUFBLFFBQ04sY0FBYztBQUFBLE1BQ2hCO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRixFQUFFOyIsCiAgIm5hbWVzIjogW10KfQo=
