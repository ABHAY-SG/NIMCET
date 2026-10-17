import type { Metadata } from "next";
import LegalPage from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What NimCuet stores, why, and how to get it removed.",
  alternates: { canonical: "/privacy" },
};

const SECTIONS: Array<[string, string[]]> = [
  ["1. Data we collect", [
    "Theme preference — stored only in your own browser (localStorage), never sent to us.",
    "Attempt history — attempts taken while signed in are stored on our servers so your dashboard can show them; they are visible only to you and the NimCuet admin team. Sample-mock attempts taken without an account stay in your browser.",
    "Account details — the name, email and optional profile photo you provide when registering.",
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
  return <LegalPage title="Privacy Policy" updated="October 2026" sections={SECTIONS} />;
}
