import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { resolve } from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup.html"),
        worker: resolve(__dirname, "src/worker/index.ts"),
        content: resolve(__dirname, "src/content/index.ts"),
      },
      output: {
        entryFileNames: () => "[name].js",
        assetFileNames: () => "assets/[name][extname]",
        chunkFileNames: "chunks/[name].js",
      },
    },
    target: "es2022",
    sourcemap: true,
  },
  publicDir: "public",
  base: "./",
});
