import type { Metadata } from "next";
import "./globals.css";
import Chrome, { NavGate } from "@/components/chrome";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://nimcet-eta.vercel.app").replace(/\/+$/, "");
const SITE_DESCRIPTION =
  "Premium mock tests for NIMCET and CUET PG MCA — real marking, live timers, instant scorecards, full solutions and honest analytics.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "NimCuet — NIMCET & CUET PG MCA Mock Tests",
    template: "%s — NimCuet",
  },
  description: SITE_DESCRIPTION,
  applicationName: "NimCuet",
  openGraph: {
    type: "website",
    url: "/",
    siteName: "NimCuet",
    title: "NimCuet — NIMCET & CUET PG MCA Mock Tests",
    description: SITE_DESCRIPTION,
    images: [{ url: "/logo.png", alt: "NimCuet" }],
  },
  twitter: {
    card: "summary",
    title: "NimCuet — NIMCET & CUET PG MCA Mock Tests",
    description: SITE_DESCRIPTION,
    images: ["/logo.png"],
  },
  alternates: { canonical: "/" },
};

export const viewport = {
  themeColor: "#635bdb",
};

function themeInit() {
  return `(function(){try{var t=localStorage.getItem('mcamock-theme')||'light';document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='light';}})();`;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit() }} />
      </head>
      <body id="top" className="flex min-h-screen flex-col antialiased">
        <NavGate />
        <div className="flex-1">{children}</div>
        <Chrome />
      </body>
    </html>
  );
}
