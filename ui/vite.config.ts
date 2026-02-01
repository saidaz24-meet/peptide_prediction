import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => {
  // Load env vars (only available in config, not in client code)
  const env = loadEnv(mode, process.cwd(), "");
  
  // Get API base URL from env, with dev fallback
  // This proxy is ONLY used in development - production builds use VITE_API_BASE_URL directly
  const apiBaseUrl = env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
  
  return {
    server: {
      host: "127.0.0.1",   // avoid "::"
      port: 5173,          // Vite default
      strictPort: true,    // fail if taken instead of silently switching
      hmr: {
        protocol: "ws",
        host: "127.0.0.1",
        port: 5173,
      },
      // DEV ONLY: Proxy API requests to backend
      // Production builds do NOT use this proxy - they use VITE_API_BASE_URL directly
      proxy: {
        "/api": {
          target: apiBaseUrl,
          changeOrigin: true,
          // Only proxy in development
          configure: (proxy, _options) => {
            if (mode === "production") {
              console.warn(
                "[vite.config] Proxy should not be used in production. " +
                "Production builds must set VITE_API_BASE_URL and make direct requests."
              );
            }
          },
        },
      },
    },
    plugins: [react()],
    resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  };
});
