import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  server: {
    host: "127.0.0.1",   // avoid "::"
    port: 5173,          // Vite default
    strictPort: true,    // fail if taken instead of silently switching
    hmr: {
      protocol: "ws",
      host: "127.0.0.1",
      port: 5173,
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
