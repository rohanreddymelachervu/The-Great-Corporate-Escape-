import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    cssCodeSplit: false,
    assetsInlineLimit: 10000000,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        entryFileNames: "assets/game.js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
  server: { host: "0.0.0.0", port: 4173 },
});
