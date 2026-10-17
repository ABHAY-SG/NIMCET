"use client";
import { usePathname } from "next/navigation";
import Navbar from "@/components/navbar";
import ContactStrip from "@/components/contact";
import Footer from "@/components/footer";

const BARE = ["/login", "/signup", "/dashboard", "/auth", "/login-choice", "/reset-password", "/admin/login", "/admin", "/terms", "/privacy"];

function useBare() {
  const path = usePathname();
  return BARE.some((p) => path === p || path.startsWith(p + "/"));
}

export function NavGate() {
  const bare = useBare();
  if (bare) return null;
  return <Navbar />;
}

export default function Chrome() {
  const bare = useBare();
  if (bare) return null;
  return (
    <>
      <ContactStrip />
      <Footer />
    </>
  );
}
