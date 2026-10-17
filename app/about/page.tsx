import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description: "NimCuet builds premium mock tests for NIMCET and CUET PG MCA — real marking, real timers, honest analytics.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-28 text-center">
      <h1 className="text-3xl font-extrabold">About Us</h1>
      <p className="mt-3 text-sm leading-7" style={{ color: "var(--muted)" }}>
        NimCuet makes premium mock tests for NIMCET and CUET PG MCA — real marking, real timers, honest analytics.
      </p>
    </main>
  );
}
