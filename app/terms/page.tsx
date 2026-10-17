import type { Metadata } from "next";
import LegalPage from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "The rules for using NimCuet mock tests, plans and content.",
  alternates: { canonical: "/terms" },
};

const SECTIONS: Array<[string, string[]]> = [
  ["1. What NimCuet offers", [
    "NimCuet provides online mock tests, previous-year-style question sets and performance reports for NIMCET and CUET PG (MCA).",
    "The sample mock works without an account. Creating a free account saves your attempt history and gives you custom mocks from the question bank; paid plans cover unlimited published mocks for their billing period.",
  ]],
  ["2. Plans and payments", [
    "Free — ₹0 forever: the sample mock, custom mocks from the bank and saved history. Monthly — ₹149 per month, unlimited published mocks and full analytics. Annual — ₹699 per year, 12 months full access.",
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
  return <LegalPage title="Terms & Conditions" updated="October 2026" sections={SECTIONS} />;
}
