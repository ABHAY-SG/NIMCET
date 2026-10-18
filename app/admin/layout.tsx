import type { Metadata } from "next";

// Staff area metadata: a clear browser-tab title and no search-engine
// indexing. Purely presentational — authentication and authorization stay in
// app/admin/(gated)/layout.tsx and lib/admin-server.ts.
export const metadata: Metadata = {
  title: "Admin — NimCuet",
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
