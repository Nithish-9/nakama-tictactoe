import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/v2": {
        target: "http://127.0.0.1:7350",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
