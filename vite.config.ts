import { defineConfig } from "vite";
import type { PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const devApiTarget = process.env.VITE_DEV_API_TARGET || "http://localhost:8000";

export default defineConfig({
  root: path.resolve(__dirname, "client"),
  plugins: [react() as unknown as PluginOption],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist", "public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          icons: ["lucide-react"],
        },
      },
    },
  },
  server: {
    host: true,
    port: 3000,
    proxy: {
      "/api": {
        target: devApiTarget,
        changeOrigin: true,
      },
    },
  },
});
