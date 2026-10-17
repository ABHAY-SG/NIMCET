import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
  description: "Talk to the NimCuet team about plans, bugs, question quality or anything else.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-28 text-center">
      <h1 className="text-3xl font-extrabold">Contact Us</h1>
      <p className="mt-3 text-sm leading-7" style={{ color: "var(--muted)" }}>
        Email: <a href="mailto:abhayincodingworld@gmail.com" className="font-bold" style={{ color: "var(--accent)" }}>abhayincodingworld@gmail.com</a>
        <br />
        Phone: <a href="tel:+917425097293" className="font-bold" style={{ color: "var(--accent)" }}>+91 74250 97293</a>
      </p>
    </main>
  );
}
