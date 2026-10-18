import type { NextConfig } from "next";

// The bundled mobile app is served by Capacitor from these WebView-local
// origins — they exist only inside the app, never as real websites.
// (Android uses https://localhost; iOS uses capacitor://localhost.)
const MOBILE_ORIGINS = ["https://localhost", "capacitor://localhost"];

// Vite dev server for the mobile app. Local development only, never present in
// a production build (see NODE_ENV gate below).
const DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

// Only these prefixes are reachable cross-origin. /api/admin/* is deliberately
// ABSENT: the admin panel stays web-only, so no browser context can reach an
// admin endpoint from a foreign origin.
const CORS_SOURCES = ["/api/student/:path*", "/api/avatar"];

// One rule per (source, origin) pair. Next matches `has` with an anchored
// regex (^value$), so each rule fires ONLY for that exact Origin — there is no
// wildcard and "*" is never sent. Access-Control-Allow-Credentials is
// deliberately omitted: the app authenticates with a Bearer token, so a
// cross-origin request can never carry this site's cookies.
function corsRules(origins: string[]) {
  return CORS_SOURCES.flatMap((source) =>
    origins.map((origin) => ({
      source,
      has: [{ type: "header" as const, key: "origin", value: origin }],
      headers: [
        { key: "Access-Control-Allow-Origin", value: origin },
        { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
        { key: "Access-Control-Allow-Headers", value: "Authorization, Content-Type" },
        { key: "Access-Control-Max-Age", value: "600" },
        // Responses differ per origin, so shared caches must key on it.
        { key: "Vary", value: "Origin" },
      ],
    }))
  );
}

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return corsRules(
      process.env.NODE_ENV === "production"
        ? MOBILE_ORIGINS
        : [...MOBILE_ORIGINS, ...DEV_ORIGINS]
    );
  },
};

export default nextConfig;
