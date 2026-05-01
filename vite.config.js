import { defineConfig } from "vite";

export default defineConfig({
  server: {
    proxy: {
      "/api": {
        target: "https://dearyou-bfffc.web.app",
        changeOrigin: true,
        secure: true
      }
    }
  },
  build: {
    target: "esnext"
  }
});
