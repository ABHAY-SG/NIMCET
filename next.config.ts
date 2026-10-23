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

// Security headers applied to every response. CSP is deliberately
// `unsafe-inline` for scripts/styles because the app ships a static,
// pre-hydration theme script and Next/KaTeX inline styles; a nonce-based CSP
// would force every page (including static marketing pages) into dynamic
// rendering. External script origins are still blocked, and frame embedding
// is denied outright.
function securityRules() {
  const isProd = process.env.NODE_ENV === "production";
  const supabase = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  let supabaseOrigin = "";
  try {
    if (supabase) supabaseOrigin = new URL(supabase).origin;
  } catch {}
  const supabaseWs = supabaseOrigin ? supabaseOrigin.replace(/^http/, "ws") : "";
  const connect = ["'self'", supabaseOrigin, supabaseWs].filter(Boolean).join(" ");

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
    "font-src 'self' data:",
    `connect-src ${connect}`,
    "media-src 'self' data: blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    isProd ? "upgrade-insecure-requests" : "",
  ]
    .filter(Boolean)
    .join("; ");

  return [
    {
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: csp },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
        },
        ...(isProd
          ? [
              {
                key: "Strict-Transport-Security",
                value: "max-age=63072000; includeSubDomains; preload",
              },
            ]
          : []),
      ],
    },
  ];
}

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
    agentUpgrade: "security",
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
    return [
      ...securityRules(),
      ...corsRules(
        process.env.NODE_ENV === "production"
          ? MOBILE_ORIGINS
          : [...MOBILE_ORIGINS, ...DEV_ORIGINS]
      ),
    ];
  },
};

export default nextConfig;
