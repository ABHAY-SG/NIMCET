import type { Metadata } from "next";

// Staff area metadata: a clear browser-tab title and no search-engine
// indexing. Purely presentational — authentication and authorization stay in
// app/admin/(gated)/layout.tsx and lib/admin-server.ts.
export const metadata: Metadata = {
  // The root layout's title template appends "— NimCuet", so this must stay a
  // bare segment ("Admin — NimCuet" would double the brand).
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
