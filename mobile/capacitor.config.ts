import type { CapacitorConfig } from "@capacitor/cli";

// NimCuet native shell configuration.
//
// appId/appName must match the Android applicationId/label chosen for the
// project (app.nimcuet.mobile / NimCuet).
//
// `androidScheme: "https"` makes the WebView load the bundled SPA from
// https://localhost — the exact origin the site's API CORS allowlist expects
// (MOBILE_ORIGINS in the website's next.config.ts). iOS uses
// capacitor://localhost and is already allowed too.
const config: CapacitorConfig = {
  appId: "app.nimcuet.mobile",
  appName: "NimCuet",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  android: {
    // The whole app talks to Supabase/Vercel over TLS only.
    allowMixedContent: false,
  },
};

export default config;
