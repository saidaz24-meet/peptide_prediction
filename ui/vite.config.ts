import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import path from "path";
import { execSync } from "child_process";
import { readFileSync } from "fs";

// Read version from package.json at build time
function getAppVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf-8"));
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

// Read short git SHA at build time
function getBuildSha(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return "dev";
  }
}

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
    define: {
      __APP_VERSION__: JSON.stringify(getAppVersion()),
      __BUILD_SHA__: JSON.stringify(env.VITE_BUILD_SHA || getBuildSha()),
    },
    plugins: [
      react(),
      // V6-1: upload source maps to Sentry on production builds when an auth
      // token is present. Silently skipped in dev/CI without the token.
      mode === "production" && process.env.SENTRY_AUTH_TOKEN
        ? sentryVitePlugin({
            org: "pvl",
            project: "pvl-frontend",
            authToken: process.env.SENTRY_AUTH_TOKEN,
            sourcemaps: { assets: "./dist/**" },
          })
        : null,
    ].filter(Boolean) as any,
    resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            recharts: ["recharts"],
            xlsx: ["xlsx"],
            framer: ["framer-motion"],
          },
        },
      },
    },
  };
});
