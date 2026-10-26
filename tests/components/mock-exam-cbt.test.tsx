import "@testing-library/jest-dom";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import MockExam from "@/components/mock-exam";
import { templateParts, templateSections } from "@/lib/nimcet-full-mock";

jest.mock("@/components/math-text", () => ({
  MathText: ({ children }: { children: string }) => children,
}));

const SESSION_ID = "00000000-0000-4000-8000-000000001000";

const QUESTIONS = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    section: "Mathematics",
    stem: "First question stem",
    options: ["Alpha", "Beta", "Gamma", "Delta"],
    plus: 12,
    minus: -3,
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    section: "Mathematics",
    stem: "Second question stem",
    options: ["One", "Two", "Three", "Four"],
    plus: 12,
    minus: -3,
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    section: "Mathematics",
    stem: "Third question stem",
    options: ["Red", "Green", "Blue", "Black"],
    plus: 12,
    minus: -3,
  },
];

const RESULT = {
  score: 12,
  correct: 1,
  wrong: 0,
  skipped: 2,
  maxMarks: 1000,
  testName: "NIMCET 2026 Full Mock",
  sections: [
    {
      key: "maths",
      label: "Mathematics",
      count: 3,
      correct: 1,
      wrong: 0,
      skipped: 2,
      score: 12,
      maxMarks: 36,
    },
  ],
  details: [],
};

type StartOverride = {
  resumed?: boolean;
  remainingSec?: number;
};

type PartOverride = {
  remainingSec?: number;
  picks?: Array<{ id: string; answer: number | null }>;
  finished?: boolean;
};

const json = (data: unknown, ok = true) =>
  Promise.resolve({
    ok,
    status: ok ? 200 : 400,
    json: async () => data,
  } as Response);

const originalFetch = global.fetch;
let fetchMock: jest.Mock;
let completeCalls = 0;
let partCalls = 0;
let startOverride: StartOverride;
let partOverride: PartOverride;

beforeEach(() => {
  window.sessionStorage.clear();
  completeCalls = 0;
  partCalls = 0;
  startOverride = {};
  partOverride = {};
  fetchMock = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/student/attempt/start")) {
      return json({
        sessionId: SESSION_ID,
        resumed: startOverride.resumed ?? false,
        parts: templateParts(),
        sections: templateSections(),
        index: 0,
        section: "maths",
        remainingSec: startOverride.remainingSec ?? 3600,
        serverNow: Date.now(),
      });
    }
    if (url.includes("/api/student/attempt/part")) {
      partCalls += 1;
      if (partOverride.finished || (startOverride.remainingSec === 0 && partCalls > 1)) {
        return json({ finished: true, serverNow: Date.now() });
      }
      return json({
        index: 0,
        section: "maths",
        label: "Mathematics",
        partLabel: templateParts()[0].label,
        sections: templateSections(),
        questions: QUESTIONS,
        picks: partOverride.picks ?? [],
        remainingSec: partOverride.remainingSec ?? 3600,
        serverNow: Date.now(),
      });
    }
    if (url.includes("/api/student/attempt/answers")) {
      return json({ ok: true, saved: 1, serverNow: Date.now() });
    }
    if (url.includes("/api/student/attempt/complete")) {
      completeCalls += 1;
      return json({ result: RESULT, recorded: true, serverNow: Date.now() });
    }
    return json({});
  });
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
  global.fetch = originalFetch;
});

async function renderExam() {
  render(<MockExam testId="test-1" title="NIMCET 2026 Full Mock" onExit={jest.fn()} />);
  await screen.findByText("First question stem");
}

describe("full-screen NIMCET CBT", () => {
  it("renders a dedicated full-viewport shell with a server timer and locked future sections", async () => {
    await renderExam();

    const root = document.querySelector("[data-cbt-root]");
    expect(root).not.toBeNull();
    expect(root).toHaveClass("cbt");
    expect(screen.getByRole("main")).toHaveClass("cbt-body");
    expect(screen.getByRole("timer")).toHaveAttribute(
      "aria-label",
      expect.stringContaining("Time remaining in Mathematics")
    );

    expect(
      screen.getByRole("button", {
        name: /Mathematics: 50 questions, 70 minutes, current section/i,
      })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: /Analytical Ability & Logical Reasoning: 40 questions, 30 minutes, locked until/i,
      })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: /Computer Awareness: 20 questions, 20 minutes, locked until/i,
      })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: /General English: 10 questions, 20 minutes, locked until/i,
      })
    ).toBeDisabled();
  });

  it("selects, clears and marks answers while preserving answers across navigation", async () => {
    await renderExam();

    const alpha = screen.getByRole("radio", { name: "Alpha" });
    fireEvent.click(alpha);
    expect(alpha).toBeChecked();
    expect(
      screen.getByRole("button", { name: "Question 1, answered, current question" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear answer" }));
    expect(screen.getByRole("radio", { name: "Alpha" })).not.toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: "Beta" }));
    fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    await screen.findByText("Second question stem");

    fireEvent.click(screen.getByRole("radio", { name: "Three" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous question" }));
    await screen.findByText("First question stem");

    fireEvent.click(screen.getByRole("button", { name: "Clear answer" }));
    fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    await screen.findByText("Second question stem");
    expect(screen.getByRole("radio", { name: "Three" })).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Previous question" }));
    await screen.findByText("First question stem");
    fireEvent.click(screen.getByRole("button", { name: "Mark" }));
    expect(screen.getByRole("button", { name: "Unmark" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(
      screen.getByRole("button", {
        name: "Question 1, marked for review, current question",
      })
    ).toBeInTheDocument();
  });

  it("restores a resumed server session and its saved answer", async () => {
    startOverride = { resumed: true, remainingSec: 1200 };
    partOverride = {
      remainingSec: 1200,
      picks: [{ id: QUESTIONS[0].id, answer: 1 }],
    };

    await renderExam();

    expect(screen.getByText(/Resumed — the server clock kept running/i)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Beta" })).toBeChecked();
    expect(screen.getByRole("timer")).toHaveTextContent("20:00");
  });

  it("submits once when the clock expires and the transition fires repeatedly", async () => {
    startOverride = { remainingSec: 0 };
    partOverride = { remainingSec: 0 };

    await renderExam();
    await waitFor(() => expect(completeCalls).toBe(1), { timeout: 4000 });
    expect(await screen.findByText("FULL MOCK · RESULT")).toBeInTheDocument();

    // The timer used to keep ticking after completion; wait past several ticks
    // and prove the completion endpoint was still called exactly once.
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(completeCalls).toBe(1);
  });
});
