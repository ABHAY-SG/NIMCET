import type { MetadataRoute } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://nimcet-eta.vercel.app").replace(/\/+$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/admin/", "/dashboard", "/api/", "/auth/", "/login", "/login-choice", "/signup", "/reset-password"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
