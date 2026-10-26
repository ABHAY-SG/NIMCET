import { Suspense } from "react";
import type { Metadata } from "next";
import { Loader2 } from "lucide-react";
import ExamRoom from "@/components/exam-room";

// This route intentionally blocks on the server: the exam shell must not be
// prerendered without its auth-gated, runtime-only test id. Next 16's cache
// components validation otherwise flags the root chrome's usePathname() hook.
export const instant = false;

export const metadata: Metadata = {
  title: "Exam room · NimCuet",
  robots: { index: false, follow: false },
};

// The dashboard route already sits behind the student auth gate in proxy.ts.
// This page is deliberately outside the dashboard page component: it renders
// only the full-viewport CBT, with no sidebar, header or dashboard cards.
export default function ExamPage({ params }: { params: Promise<{ testId: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="cbt cbt-state-screen" data-cbt-root>
          <div className="cbt-state-card" role="status">
            <div className="cbt-state-icon" aria-hidden>
              <Loader2 size={22} className="cbt-spin" />
            </div>
            <h1>Opening your exam room</h1>
            <p>Preparing the full-screen CBT.</p>
          </div>
        </div>
      }
    >
      <ExamRoomLoader params={params} />
    </Suspense>
  );
}

async function ExamRoomLoader({ params }: { params: Promise<{ testId: string }> }) {
  const { testId } = await params;
  return <ExamRoom testId={testId} />;
}
