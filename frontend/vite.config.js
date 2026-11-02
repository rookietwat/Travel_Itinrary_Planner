import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The API runs on 8001 by default; override with VITE_API_PROXY.
const target = process.env.VITE_API_PROXY || "http://localhost:8001";

export default defineConfig({
  plugins: [react()],
  server: { port: 5175, strictPort: true, proxy: { "/api": { target, changeOrigin: true } } },
  build: {
    rollupOptions: {
      output: {
        // Framework code changes rarely; keeping it in its own chunk lets browsers cache it across deploys.
        manualChunks: { react: ["react", "react-dom", "react-router-dom"], icons: ["lucide-react"] },
      },
    },
  },
});
