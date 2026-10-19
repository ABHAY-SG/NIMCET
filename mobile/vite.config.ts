import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The mobile client is a plain Vite SPA. Capacitor bundles the `dist/` output
// into the Android APK/AAB and serves it from the app-local origin
// `https://localhost` (see capacitor.config.ts), which is why the Next.js API
// CORS allowlist already permits that origin for /api/student/* — see the
// site's next.config.ts (MOBILE_ORIGINS).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
