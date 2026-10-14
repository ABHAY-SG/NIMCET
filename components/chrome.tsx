"use client";
import { usePathname } from "next/navigation";
import ContactStrip from "@/components/contact";
import Footer from "@/components/footer";

const BARE = ["/login", "/signup"];

export default function Chrome() {
  const path = usePathname();
  if (BARE.some((p) => path === p || path.startsWith(p + "/"))) return null;
  return (
    <>
      <ContactStrip />
      <Footer />
    </>
  );
}
