import Reveal from "@/components/reveal";
import MockDemo from "@/components/mockdemo";

export default function Demo() {
  return (
    <section id="demo" className="mx-auto w-full scroll-mt-24 px-4 pb-12 sm:px-6 lg:px-8">
      <div className="grid gap-8 md:grid-cols-[1fr_1.4fr] md:items-start">
        <Reveal className="text-center md:sticky md:top-24 md:text-left">
          <p
            className="text-[11px] font-semibold uppercase"
            style={{ color: "var(--accent)", letterSpacing: "0.22em" }}
          >
            The Experience
          </p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Feel the <span style={{ color: "var(--accent)" }}>exam hall.</span>
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-7 md:mx-0" style={{ color: "var(--muted)" }}>
            The same screen you will meet on exam day — palette, timer and
            Save & Next vocabulary, practised until it feels routine. Every
            mock ends with a section-wise report, so you always know what to
            fix next.
          </p>
          <a href="/#how" className="nlink nounder mt-4 inline-block text-sm font-bold">
            See how a mock flows →
          </a>
        </Reveal>
        <div>
          <Reveal>
            <MockDemo />
          </Reveal>
          <p className="mt-3 text-center text-[11px] md:text-right" style={{ color: "var(--muted)" }}>
            12 questions · 12 minutes · real marking · solutions included
          </p>
        </div>
      </div>
    </section>
  );
}
