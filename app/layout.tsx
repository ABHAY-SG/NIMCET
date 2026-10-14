import type { Metadata } from "next";
import "./globals.css";
import Chrome, { NavGate } from "@/components/chrome";

export const metadata: Metadata = {
  title: "NimCuet — NIMCET & CUET PG MCA Mock Tests",
  description: "Prepare smart. Perform better. Premium mock tests for NIMCET and CUET PG MCA.",
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
      <body className="flex min-h-screen flex-col antialiased">
        <NavGate />
        <div className="flex-1">{children}</div>
        <Chrome />
      </body>
    </html>
  );
}
