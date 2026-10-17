import type { Metadata } from "next";
import LegalPage from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What NimCuet stores, why, and how to get it removed.",
  alternates: { canonical: "/privacy" },
};

const SECTIONS: Array<[string, string[]]> = [
  ["1. Who we are", [
    "NimCuet is an independent mock-test platform for NIMCET and CUET PG (MCA) aspirants, available at nimcet-eta.vercel.app. This policy explains what we collect when you use the site, why we need it, and the choices you have.",
    "It covers the website only — not any external site you may reach through a link.",
  ]],
  ["2. Data we collect", [
    "Account details — the name, email address and optional profile photo you provide when you register. Passwords are handled by our authentication provider and are never stored in plain text.",
    "Attempt history — attempts taken while signed in are stored on our servers so your dashboard can show scores, answers, timings and resume points. They are visible only to you and the NimCuet admin team. Sample-mock attempts taken without an account stay in your browser.",
    "Theme preference — stored only in your own browser (localStorage) and never sent to us.",
    "Contact messages — your email or phone when you write or call, used only to reply to you.",
    "Payment confirmations — the UPI reference and email used to activate your plan. We do not collect or store card numbers, UPI PINs or bank credentials.",
    "Technical logs — basic information such as IP address and browser type recorded by our hosting provider, used for security and reliability.",
  ]],
  ["3. How we use it", [
    "To run the site: keep you signed in, remember your theme, save attempt history, restore mocks and generate scorecards and analytics.",
    "To activate paid plans, answer support messages, investigate reported question errors, prevent abuse and keep the service secure.",
    "We never sell personal data, never run third-party advertising trackers, and never share your data for marketing.",
  ]],
  ["4. Storage, security and retention", [
    "Data you send us is stored with standard safeguards — encrypted in transit and access restricted to the admin team. Browser-only data never leaves your device.",
    "We keep account and attempt data while your account is active, and for a reasonable period afterwards where we need it for support, accounting or legal records. After that it is deleted or anonymised.",
  ]],
  ["5. Cookies and local storage", [
    "NimCuet uses no advertising cookies. The site uses browser storage for functional preferences such as your theme choice.",
    "Our authentication provider uses session storage or cookies to keep you signed in. Clearing your browser storage signs you out and removes locally kept preferences and guest attempts instantly.",
  ]],
  ["6. Third-party services", [
    "We use trusted infrastructure providers — Supabase for authentication and database storage, and Vercel for hosting — that process data on our behalf under their own data-processing terms.",
    "We do not sell your data or share it with anyone else except when required by law.",
  ]],
  ["7. Your rights and choices", [
    "You can ask for a copy, correction or deletion of anything you shared with us at any time — write to abhayincodingworld@gmail.com and we act within 7 days.",
    "If you ask us to delete your account, we remove your account and attempt data within 7 days, except records we are required to keep for legal or accounting purposes.",
    "Clearing your browser storage removes locally kept preferences and demo history instantly.",
  ]],
  ["8. Children", [
    "NimCuet is built for MCA aspirants, generally 18 and older. Younger users should use it with the involvement of a parent or guardian.",
  ]],
  ["9. Changes to this policy", [
    "We may update this policy as the product evolves. The date at the top shows the latest revision, and material changes are noted on the site.",
  ]],
  ["10. Contact", [
    "Privacy questions: abhayincodingworld@gmail.com or +91-74250-97293. Policy updates will carry a new date above.",
  ]],
];

export default function PrivacyPage() {
  return <LegalPage title="Privacy Policy" updated="October 2026" sections={SECTIONS} />;
}
