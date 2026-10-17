// Single source of truth for every FAQ answer. The landing section picks a
// short subset; /faq renders the grouped version. Keeping one file means the
// two surfaces can never drift apart again.

export const FAQ_GROUPS: Array<{ title: string; items: Array<[string, string]> }> = [
  {
    title: "Exams & Pattern",
    items: [
      ["What is the NIMCET pattern?", "120 MCQs, 1000 marks, 120 minutes. Mathematics 50×12 (−3), Reasoning 40×6 (−1.5), Computer Awareness 20×6 (−1.5), General English 10×4 (−1). Section windows run 70 + 30 + 20 minutes."],
      ["What is CUET PG MCA (SCQP09)?", "75 MCQs, 300 marks, 90 minutes, single paper. +4 correct, −1 wrong across Mathematics (30Q), Computer Science (35Q) and Thinking & Decision Making (10Q)."],
      ["Which NIMCET section matters most?", "Mathematics — 600 of 1000 marks. A 15% accuracy jump there moves your total more than perfect English ever could."],
      ["Is the site only for the 2027 attempt?", "No. Patterns are stable year to year; we update mocks whenever NTA or NIMCET notifies a change."],
    ],
  },
  {
    title: "Mocks & Marking",
    items: [
      ["Is there negative marking in demos?", "Yes — the free sample mock uses per-section marking in the same style as the real paper, scaled to its 12 questions."],
      ["Do skipped questions lose marks?", "Never — in NIMCET, CUET PG and our mocks. A confident skip beats a blind guess, especially in Maths."],
      ["Do I need an account?", "The sample mock works without one. A free account saves your attempt history to your dashboard and unlocks custom mocks built from the question bank."],
      ["Which device works best?", "Any modern phone, tablet or laptop browser. A laptop-sized screen matches the real CBT best."],
    ],
  },
  {
    title: "Plans & Payments",
    items: [
      ["What do the plans cost?", "Free ₹0 forever — sample mock, custom mocks from the bank and saved history. Monthly ₹149 — unlimited published mocks and full analytics. Annual ₹699 — 12 months full access. Prices include all taxes."],
      ["How do I pay?", "Over UPI. Share your payment reference on email and your plan activates within a day."],
      ["Can I get a refund?", "Monthly within 48 hours and Annual within 7 days of purchase, if fewer than 2 mocks were attempted. Write to abhayincodingworld@gmail.com."],
      ["Will prices change later?", "Active plans keep their price till renewal. Only new purchases follow revised prices."],
    ],
  },
  {
    title: "Support",
    items: [
      ["How do I contact you?", "Email abhayincodingworld@gmail.com or call +91-74250-97293. A human replies within a day."],
      ["I found a wrong answer. What now?", "Send the mock name, question number and your working — we verify and fix it, and credit your report if it affected scoring."],
    ],
  },
];

// Short subset shown on the landing page (one or two per area).
export const LANDING_FAQS: Array<[string, string]> = [
  FAQ_GROUPS[0].items[0],
  FAQ_GROUPS[0].items[1],
  FAQ_GROUPS[1].items[0],
  FAQ_GROUPS[1].items[2],
  FAQ_GROUPS[3].items[0],
];
