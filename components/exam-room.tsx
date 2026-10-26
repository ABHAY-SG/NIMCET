"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import MockDemo, { type SubmitResult } from "@/components/mockdemo";
import MockExam from "@/components/mock-exam";
import { getSupabase } from "@/lib/supabase";
import { parseParts, type ExamPart } from "@/lib/exam-parts";
import { toMock, type BankRow } from "@/lib/question-bank";
import { isFullMockTemplate } from "@/lib/nimcet-full-mock";

type TestRow = {
  id: string;
  title: string;
  exam: string;
  minutes: number;
  question_ids: string[];
  sections?: unknown;
  template?: string;
};

type Loaded =
  | { kind: "template"; test: TestRow }
  | {
      kind: "practice";
      test: TestRow;
      rows: BankRow[];
      parts?: ExamPart[];
      minutes: number;
    };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Only these dashboard destinations may be used as the "Back to mocks"
// target. The value is read from the URL, so an allow-list prevents an open
// redirect if someone edits the query string.
const RETURN_TARGETS = new Set([
  "/dashboard?view=mock",
  "/dashboard?view=nimcet-pyq",
  "/dashboard?view=cuet-mock",
  "/dashboard?view=cuet-pyq",
  "/dashboard?view=history",
]);

function safeReturnTo(): string {
  try {
    const raw = new URLSearchParams(window.location.search).get("returnTo");
    return raw && RETURN_TARGETS.has(raw) ? raw : "/dashboard?view=mock";
  } catch {
    return "/dashboard?view=mock";
  }
}

function toTest(raw: Record<string, unknown>): TestRow {
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? "Mock test"),
    exam: String(raw.exam ?? ""),
    minutes: Number(raw.minutes) || 0,
    question_ids: Array.isArray(raw.question_ids)
      ? (raw.question_ids as unknown[]).filter((x): x is string => typeof x === "string")
      : [],
    sections: raw.sections,
    template: typeof raw.template === "string" ? raw.template : "",
  };
}

function StateScreen({
  title,
  detail,
  busy = false,
  onExit,
}: {
  title: string;
  detail: string;
  busy?: boolean;
  onExit?: () => void;
}) {
  return (
    <div className="cbt cbt-state-screen" data-cbt-root>
      <div className="cbt-state-card" role={busy ? "status" : "alert"}>
        <div className="cbt-state-icon" aria-hidden>
          {busy ? <Loader2 size={22} className="cbt-spin" /> : <AlertTriangle size={22} />}
        </div>
        <h1>{title}</h1>
        <p>{detail}</p>
        {onExit && (
          <button type="button" className="cbt-btn cbt-btn-primary" onClick={onExit}>
            <ArrowLeft size={16} /> Back to mocks
          </button>
        )}
      </div>
    </div>
  );
}

export default function ExamRoom({ testId }: { testId: string }) {
  const router = useRouter();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const exit = useCallback(() => {
    router.push(safeReturnTo());
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      if (!UUID.test(testId)) {
        setError("This test link is not valid. Open a published test from the mock-test catalogue.");
        setLoading(false);
        return;
      }
      try {
        const sb = getSupabase();
        const { data, error: testError } = await sb
          .from("tests")
          .select("*")
          .eq("id", testId)
          .eq("published", true)
          .maybeSingle();
        if (testError) throw testError;
        if (!data) {
          throw new Error("This test is not published or is no longer available.");
        }
        const test = toTest(data as Record<string, unknown>);
        if (isFullMockTemplate(test.template)) {
          if (!cancelled) setLoaded({ kind: "template", test });
          return;
        }

        const ids = test.question_ids.slice(0, 300);
        const rowsById = new Map<string, BankRow>();
        for (let i = 0; i < ids.length; i += 150) {
          const chunk = ids.slice(i, i + 150);
          if (chunk.length === 0) continue;
          const r = await fetch(`/api/student/questions?ids=${chunk.join(",")}`, {
            credentials: "same-origin",
          });
          const j = (await r.json()) as { error?: string; rows?: BankRow[] };
          if (!r.ok) throw new Error(j.error || "Could not load this test's questions.");
          for (const q of j.rows ?? []) rowsById.set(q.id, q);
        }
        const rows = test.question_ids
          .map((id) => rowsById.get(id))
          .filter((q): q is BankRow => !!q);
        if (rows.length === 0) {
          throw new Error("This test has no available questions.");
        }
        const parts = parseParts(test.sections, rows.length) ?? undefined;
        const minutes = parts ? parts.reduce((sum, p) => sum + p.minutes, 0) : test.minutes;
        if (!cancelled) setLoaded({ kind: "practice", test, rows, parts, minutes });
      } catch (e) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message.trim() : "";
          setError(message || "Could not open this test. Check your connection and try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [testId]);

  if (loading) {
    return (
      <StateScreen
        busy
        title="Opening your exam room"
        detail="Checking the published paper and restoring your server-timed session."
      />
    );
  }

  if (error || !loaded) {
    return (
      <StateScreen
        title="This exam could not be opened"
        detail={error || "The test is not available."}
        onExit={exit}
      />
    );
  }

  if (loaded.kind === "template") {
    return <MockExam testId={loaded.test.id} title={loaded.test.title} onExit={exit} />;
  }

  const { test, rows, parts, minutes } = loaded;
  const questions = rows.map(toMock);
  const onSubmit = async (picks: Record<number, number>): Promise<SubmitResult> => {
    const r = await fetch("/api/student/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        test: test.title,
        testId: test.id,
        answers: questions.map((q, i) => ({ id: q.qid ?? "", answer: picks[i] ?? null })),
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error((j as { error?: string }).error || "Submit failed.");
    return j as SubmitResult;
  };

  return (
    <div className="cbt cbt-practice" data-cbt-root>
      <MockDemo
        key={`${test.id}-${rows.length}`}
        fullscreen
        autoStart
        questions={questions}
        title={test.title.toUpperCase()}
        minutes={minutes}
        testName={`${test.title} (${rows.length}Q)`}
        parts={parts}
        onSubmit={onSubmit}
        onExit={exit}
      />
    </div>
  );
}
