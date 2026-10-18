import type { Metadata } from "next";
import { Alex_Brush, Fraunces, Inter, JetBrains_Mono, Sora, Space_Grotesk } from "next/font/google";
import "./globals.css";
import Chrome, { NavGate } from "@/components/chrome";
import ScrollProgress from "@/components/scroll-progress";

// Self-hosted premium type stack (no runtime font CDN — Google fonts are
// fetched at build time and served from our own domain, so text paints with
// the real typeface on first load instead of a system fallback):
//   Inter          → UI + body copy
//   Sora           → display headings on dashboard surfaces
//   Space Grotesk  → marketing headings (h1–h3)
//   Fraunces       → editorial serif accents, wordmark
//   JetBrains Mono → numerals, scores, tables, code
//   Alex Brush     → the single handwritten logo flourish
const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const sora = Sora({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-heading", display: "swap" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-serif", display: "swap" });
const alexBrush = Alex_Brush({ subsets: ["latin"], weight: "400", variable: "--font-script", display: "swap" });

const fontVars = `${inter.variable} ${sora.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} ${fraunces.variable} ${alexBrush.variable}`;

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
  themeColor: "#c2410c",
};

// Runs before paint: applies the visitor's saved theme, falling back to the
// sitewide default (sunrise). Validates the stored value so a corrupt entry
// can never leave the page unstyled.
function themeInit() {
  return `(function(){try{var ok=['sunset','light','midnight','ocean','forest'];var t=localStorage.getItem('mcamock-theme');if(ok.indexOf(t)<0)t='sunset';document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='sunset';}})();`;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="sunset" suppressHydrationWarning className={fontVars}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit() }} />
      </head>
      <body id="top" className="flex min-h-screen flex-col antialiased">
        <ScrollProgress />
        <NavGate />
        <div className="flex-1">{children}</div>
        <Chrome />
      </body>
    </html>
  );
}
