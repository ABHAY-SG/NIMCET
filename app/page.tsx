import type { Metadata } from "next";
import Hero from "@/components/hero";
import Exams from "@/components/exams";
import Demo from "@/components/demo";
import How from "@/components/how";
import Pricing from "@/components/pricing";
import About from "@/components/about";
import Faqs from "@/components/faqs";

export const metadata: Metadata = {
  title: { absolute: "NimCuet — NIMCET & CUET PG MCA Mock Tests" },
  description:
    "Take free NIMCET and CUET PG MCA mock tests with real marking, live timers, instant scorecards and full solutions — then track every attempt in your dashboard.",
  alternates: { canonical: "/" },
};

function Divider() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-6xl px-4">
      <div
        className="relative mb-12 h-px"
        style={{ background: "linear-gradient(90deg, transparent, var(--border), transparent)" }}
      >
        <span
          className="absolute left-1/2 top-1/2 block h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rotate-45"
          style={{ background: "var(--accent)", boxShadow: "0 0 14px color-mix(in srgb, var(--accent) 65%, transparent)" }}
        />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-[20vh]">
      <Hero />
      <Divider />
      <Exams />
      <Divider />
      <Demo />
      <Divider />
      <How />
      <Divider />
      <Pricing />
      <Divider />
      <About />
      <Divider />
      <Faqs />
    </main>
  );
}
