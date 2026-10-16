import Hero from "@/components/hero";
import Exams from "@/components/exams";
import Demo from "@/components/demo";
import LoginCta from "@/components/login-cta";
import How from "@/components/how";
import Pricing from "@/components/pricing";
import About from "@/components/about";
import Faqs from "@/components/faqs";

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
      <LoginCta />
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
