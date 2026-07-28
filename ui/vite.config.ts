import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    // The packaging step inlines the output, so keep it to one JS chunk and one
    // CSS file and emit no preload directives pointing at files that will not
    // exist on disk once inlined.
    modulePreload: false,
    cssCodeSplit: false,
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        entryFileNames: "assets/control-center.js",
        assetFileNames: "assets/control-center.[ext]",
        manualChunks: undefined,
        // Streamdown lazy loads its syntax highlighter, which emitted a second
        // chunk the inliner cannot fold into one HTML file. There is no network
        // to fetch a chunk from once this is inlined and served from a local
        // process, so a dynamic import has nothing to gain here.
        inlineDynamicImports: true,
      },
    },
  },
  server: {
    proxy: {
      // The local service serves the API; `npm run dev` borrows it.
      "/api": "http://127.0.0.1:7717",
      "/health": "http://127.0.0.1:7717",
    },
  },
});
