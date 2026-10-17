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
        className="mb-12 h-px"
        style={{ background: "linear-gradient(90deg, transparent, var(--border), transparent)" }}
      />
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-[20vh] pt-24">
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
