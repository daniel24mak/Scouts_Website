import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/Scouts_Website/",
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1500
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:4174"
    }
  }
});
