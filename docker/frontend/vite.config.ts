import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": {
        // Route API through nginx so protected file endpoints using
        // X-Accel-Redirect are resolved correctly in development.
        target: "http://nginx:80",
        changeOrigin: true,
      },
      "/media": {
        // Serve uploaded assets from Django in development.
        target: "http://backend:8000",
        changeOrigin: true,
      },
      "/Data": {
        // Serve question papers/answer keys mounted under /Data in DEBUG.
        target: "http://backend:8000",
        changeOrigin: true,
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
