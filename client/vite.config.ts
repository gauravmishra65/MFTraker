import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  // Load .env from the monorepo root (one level up from client/)
  envDir: path.resolve(__dirname, ".."),
  base: "/",
  build: { outDir: "../dist", emptyOutDir: true },
  server: { port: 5173, host: true }
});
