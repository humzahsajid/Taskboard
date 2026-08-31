import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// During local development (npm run dev) requests to /api are proxied to the
// backend so the frontend and backend behave as one origin — the same as the
// nginx setup used in Docker.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY ?? "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
