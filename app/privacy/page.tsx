const SECTIONS: Array<[string, string[]]> = [
  ["1. Data we collect", [
    "Theme preference — stored only in your own browser (localStorage), never sent to us.",
    "Demo attempts — stay on your device unless you create an account in a future release.",
    "Contact messages — your email or phone when you write or call us, used only to reply.",
    "Payment confirmations — UPI reference and email, used only to activate your plan.",
  ]],
  ["2. How we use it", [
    "To run the site (remember your theme), activate paid plans, answer support messages and improve question quality.",
    "We never sell personal data, never run third-party ad trackers, and never share data for marketing.",
  ]],
  ["3. Storage and security", [
    "Browser-only data never leaves your device. Anything you send us is stored with standard safeguards and kept only as long as needed for support or legal records.",
  ]],
  ["4. Cookies and local storage", [
    "We use no advertising cookies. The site uses local storage purely for functional preferences like your theme choice.",
  ]],
  ["5. Your rights", [
    "Ask for a copy, correction or deletion of anything you shared with us at any time — write to abhayincodingworld@gmail.com and we act within 7 days.",
    "Clearing your browser storage removes locally kept preferences and demo history instantly.",
  ]],
  ["6. Children", [
    "NimCuet is built for MCA aspirants, generally 18+. Younger users should use it with a guardian.",
  ]],
  ["7. Contact", [
    "Privacy questions: abhayincodingworld@gmail.com, +91-74250-97293. Policy updates will carry a new date above.",
  ]],
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-28">
      <p className="text-center text-[11px] font-semibold uppercase" style={{ color: "var(--accent)", letterSpacing: "0.22em" }}>
        Legal
      </p>
      <h1 className="mt-2 text-center text-3xl font-extrabold tracking-tight sm:text-4xl">Privacy Policy</h1>
      <p className="mt-2 text-center text-sm" style={{ color: "var(--muted)" }}>Last updated: October 2026</p>
      <div className="mt-8 space-y-7">
        {SECTIONS.map(([t, ps]) => (
          <section key={t}>
            <h2 className="text-lg font-extrabold tracking-tight">{t}</h2>
            {ps.map((p, i) => (
              <p key={i} className="mt-2 text-sm leading-7" style={{ color: "var(--muted)" }}>{p}</p>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}
