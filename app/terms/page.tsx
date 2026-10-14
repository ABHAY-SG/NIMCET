const SECTIONS: Array<[string, string[]]> = [
  ["1. What NimCuet offers", [
    "NimCuet provides online mock tests, previous-year-style question sets and performance reports for NIMCET and CUET PG (MCA).",
    "Free demo tests are available without an account. Paid plans unlock unlimited mocks for their billing period.",
  ]],
  ["2. Plans and payments", [
    "Free — ₹0 forever, 5 mock tests per month. Monthly — ₹149 per month, unlimited mocks. Annual — ₹699 per year, 12 months full access.",
    "Payments are collected over UPI. Your plan is activated on your registered email within one day of payment confirmation.",
    "Prices include all taxes. We may revise prices for new purchases; active plans keep their price till renewal.",
  ]],
  ["3. Fair use", [
    "Accounts and plans are for one person. Sharing logins, scraping questions or republishing content leads to suspension without refund.",
    "Automated bulk attempting that degrades service for others is not allowed.",
  ]],
  ["4. Content and ownership", [
    "All questions, explanations, reports and site content belong to NimCuet and are for personal preparation use only.",
    "Demo scores are illustrative of that question set — they are not predicted ranks or admission guarantees.",
  ]],
  ["5. Refunds", [
    "Monthly plans can be refunded within 48 hours of purchase if fewer than 2 mocks were attempted — write to abhayincodingworld@gmail.com.",
    "Annual plans can be refunded within 7 days under the same condition. Free plans are never charged.",
  ]],
  ["6. Liability", [
    "Mock scores do not guarantee real-exam results. Exam patterns follow official notifications; if NTA or NIMCET changes a pattern, we update our mocks accordingly.",
    "Service is provided as-is with best-effort uptime; we are not liable for indirect losses.",
  ]],
  ["7. Changes and contact", [
    "We may update these terms; continued use after changes means acceptance. Questions: abhayincodingworld@gmail.com, +91-74250-97293.",
  ]],
];

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-28">
      <p className="text-center text-[11px] font-semibold uppercase" style={{ color: "var(--accent)", letterSpacing: "0.22em" }}>
        Legal
      </p>
      <h1 className="mt-2 text-center text-3xl font-extrabold tracking-tight sm:text-4xl">Terms & Conditions</h1>
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
