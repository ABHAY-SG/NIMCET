import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { MathText } from "../math-text";

describe("MathText — mixed text and LaTeX rendering", () => {
  it("renders plain text unchanged when there are no math delimiters", () => {
    const { container } = render(<MathText>Hello world</MathText>);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
    expect(container.querySelector(".katex")).toBeNull();
  });

  it("renders inline math \\( ... \\) as KaTeX, not raw LaTeX source", () => {
    const { container } = render(<MathText>{"If \\(y = x^2\\) then find y"}</MathText>);
    expect(screen.getByText("If", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("then find y", { exact: false })).toBeInTheDocument();
    expect(container.querySelector(".katex")).not.toBeNull();
    expect(screen.queryByText("\\(")).not.toBeInTheDocument();
    const visibleText = document.body.textContent ?? "";
    expect(visibleText).not.toContain("\\(");
  });

  it("renders display math \\[ ... \\] as a block", () => {
    const { container } = render(<MathText>{"\\[x = 0\\]"}</MathText>);
    expect(container.querySelectorAll(".katex").length).toBe(1);
    expect(container.querySelector(".katex-display")).not.toBeNull();
  });

  it("renders $...$ inline math", () => {
    const { container } = render(<MathText>{"Price is $5.99$ each"}</MathText>);
    expect(container.querySelector(".katex")).not.toBeNull();
    expect(screen.getByText("Price is", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("each", { exact: false })).toBeInTheDocument();
  });

  it("renders $$...$$ display math", () => {
    const { container } = render(<MathText>{"$$E = mc^2$$"}</MathText>);
    expect(container.querySelector(".katex-display")).not.toBeNull();
  });

  it("mixes multiple inline math expressions with surrounding text", () => {
    const { container } = render(
      <MathText>{"a = \\(1\\) and b = \\(2\\), so a + b = \\(3\\)"}</MathText>
    );
    expect(container.querySelectorAll(".katex").length).toBe(3);
    expect(screen.getByText("a =", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("and b =", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("so a + b =", { exact: false })).toBeInTheDocument();
  });

  it("renders the exact example from the task with fractions and superscripts", () => {
    const text =
      'If \\(y = \\frac{{12\\tan x\\;-\\;4\\tan^3 x}}{{9\\;-\\;27\\tan^2 x}}\\) then find \\(\\frac{d^2y}{dx^2}\\)?';
    const { container } = render(<MathText>{text}</MathText>);

    expect(screen.getByText("If", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("then find", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("?", { exact: false })).toBeInTheDocument();

    // Fractions render with proper horizontal fraction bars
    const fractions = container.querySelectorAll(".mfrac");
    expect(fractions.length).toBeGreaterThanOrEqual(2);

    // Superscripts appear for d^2, x^2, tan^3, tan^2 — check the HTML string
    // because jsdom may not expose MathML class selectors reliably.
    expect(container.innerHTML).toContain("msup");
  });

  it("renders derivatives with stacked numerator and denominator", () => {
    const { container } = render(<MathText>{"\\(\\frac{d^2y}{dx^2}\\)"}</MathText>);
    const mfrac = container.querySelector(".mfrac");
    expect(mfrac).not.toBeNull();
    const children = Array.from(mfrac!.children);
    expect(children.length).toBeGreaterThanOrEqual(1);
  });

  it("renders nested fractions", () => {
    const { container } = render(<MathText>{"\\(\\frac{1}{\\frac{2}{3}}\\)"}</MathText>);
    const fractions = container.querySelectorAll(".mfrac");
    expect(fractions.length).toBeGreaterThanOrEqual(2);
  });

  it("renders trigonometric functions and subscripts", () => {
    const { container } = render(<MathText>{"\\(\\sin(\\theta) + \\log_a x\\)"}</MathText>);
    // KaTeX renders operator names (sin, log) and subscripts; assert via HTML
    // since jsdom's MathML class selectors can be unreliable.
    expect(container.innerHTML).toContain("katex");
    expect(container.innerHTML).toContain("msub");
  });

  it("does not crash on malformed LaTeX — renders fallback output", () => {
    // Rendering must not throw. KaTeX with throwOnError:false returns a
    // katex-error span instead of crashing; the component still mounts.
    const { container } = render(<MathText>{"\\(broken { latex\\)"}</MathText>);
    expect(
      container.querySelector(".katex") ??
        container.querySelector(".katex-error") ??
        container.querySelector(".math-fallback")
    ).not.toBeNull();
  });

  it("does not crash on unmatched delimiters", () => {
    const { container } = render(<MathText>{"\\(incomplete"}</MathText>);
    // No closing \), so the whole string renders as literal text
    expect(container.textContent).toContain("\\(incomplete");
  });

  it("leaves stray backslashes outside math untouched", () => {
    const { container } = render(<MathText>{"Just a \\backslash here"}</MathText>);
    expect(container.textContent).toContain("Just a \\backslash here");
  });

  it("renders display math as a block", () => {
    const { container } = render(<MathText inline={false}>{"\\[x = 1\\]"}</MathText>);
    expect(container.querySelector(".katex-display")).not.toBeNull();
  });
});
