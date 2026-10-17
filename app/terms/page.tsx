import type { Metadata } from "next";
import LegalPage from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "The rules for using NimCuet mock tests, plans and content.",
  alternates: { canonical: "/terms" },
};

const SECTIONS: Array<[string, string[]]> = [
  ["1. What NimCuet offers", [
    "NimCuet is an independent online mock-test platform for NIMCET and CUET PG (MCA) aspirants. We are not affiliated with NTA, the NIMCET organising institutes or any university — exam names are used only to describe the papers our mocks simulate.",
    "Our mocks replay the real paper: a 120-question NIMCET pattern and a 75-question CUET PG pattern, split into timed parts with auto-submit, resume support, instant scorecards, full solutions and analytics.",
    "The sample mock works without an account. A free account saves your attempt history and unlocks custom mocks built from the question bank. Paid plans cover unlimited published mocks for their billing period.",
  ]],
  ["2. Accounts and eligibility", [
    "You need a valid email address to create an account, and the details you give us should be accurate. One account is for one person.",
    "You are responsible for keeping your login secure and for all activity that happens under your account. If you think someone else has accessed it, tell us right away and change your password.",
    "NimCuet is built for MCA aspirants who are generally 18 or older. Younger users may use it with the involvement of a parent or guardian.",
    "We may suspend or close accounts that break these terms, attempt to abuse the platform, or put other users at risk.",
  ]],
  ["3. Plans, payments and activation", [
    "Free — ₹0 forever: the sample mock, custom mocks from the question bank and saved attempt history.",
    "Monthly — ₹149 per month: unlimited published mocks and full analytics for the billing period.",
    "Annual — ₹699 per year: the same full access for 12 months.",
    "Payments are collected over UPI. Share the payment reference with us; your plan is activated on your registered email within one day of payment confirmation (usually much faster).",
    "Prices include all taxes. We may revise prices for new purchases, but an active plan keeps the price you paid until it comes up for renewal. Plans are personal — they cannot be shared or transferred.",
  ]],
  ["4. Mock tests, scoring and results", [
    "Mocks follow the official exam patterns as published. When NTA or the NIMCET organisers change a pattern or marking scheme, we update our papers to match.",
    "Scores and analytics are practice tools. They are not predicted ranks, admission advice or a guarantee of any result in the real exam.",
    "If we confirm an error in a question or key, we may correct or void it and adjust affected scores. If a genuine technical failure interrupts your attempt, contact us — we may reset that attempt.",
  ]],
  ["5. Fair use", [
    "Accounts and plans are for one person. Sharing logins, scraping questions, bulk-downloading content or republishing it is not allowed.",
    "Automated bulk attempting, attempts to bypass timers or gating, and anything that degrades the service for other users is also not allowed.",
    "Breaking these rules can lead to suspension or closure of the account without a refund.",
  ]],
  ["6. Content and ownership", [
    "All questions, explanations, reports, designs and site content belong to NimCuet and are provided for personal preparation use only. You may not copy, resell or redistribute them.",
    "Exam names, logos and trademarks belong to their respective owners and are used only to describe the exams we cover.",
  ]],
  ["7. Refunds and cancellation", [
    "Monthly plans can be refunded within 48 hours of purchase if fewer than 2 mocks were attempted. Annual plans can be refunded within 7 days under the same condition. Write to abhayincodingworld@gmail.com with your payment reference.",
    "Approved refunds go back to the original payment method, usually within 7 working days.",
    "You can stop renewing at any time — access simply runs to the end of the paid period. After the refund window, part-period refunds are not available. The free plan is never charged.",
  ]],
  ["8. Availability and liability", [
    "We run the service on a best-effort basis and aim for high uptime, but maintenance, hosting issues or network problems can interrupt access. Where possible we give notice of planned downtime.",
    "Mock scores do not guarantee real-exam results. To the extent permitted by law, we are not liable for indirect or consequential losses arising from use of the site.",
  ]],
  ["9. Changes to these terms", [
    "We may update these terms as the product evolves. The date at the top of this page shows the latest revision, and material changes are flagged on the site.",
    "Continuing to use NimCuet after an update means you accept the revised terms.",
  ]],
  ["10. Contact", [
    "Questions about these terms: abhayincodingworld@gmail.com or +91-74250-97293. We usually reply within 2 working days.",
  ]],
];

export default function TermsPage() {
  return <LegalPage title="Terms & Conditions" updated="October 2026" sections={SECTIONS} />;
}
