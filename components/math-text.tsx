"use client";

import katex from "katex";
import "katex/dist/katex.min.css";

type MathTextProps = {
  children: string;
  className?: string;
  /** When false the whole block renders as a block-level box. Defaults to inline flow. */
  inline?: boolean;
};

/**
 * Splits a mixed text/math string into tokens.
 *
 * Supported delimiters (matched in this order so longer forms win):
 *   `\( ... \)`   inline LaTeX
 *   `\[ ... \]`   display LaTeX
 *   `$$ ... $$`   display math
 *   `$ ... $`     inline math
 *
 * Nothing outside a matched pair is touched — no blind backslash replacement,
 * no global string mutation. Stored strings flow through unchanged.
 */
const MATH_DELIMITER = /\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$|\$([\s\S]*?)\$/g;

type Token = { kind: "text" | "math"; content: string; display: boolean };

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let lastIndex = 0;
  const regex = MATH_DELIMITER;
  regex.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ kind: "text", content: text.slice(lastIndex, match.index), display: false });
    }
    let content = "";
    let display = false;
    if (match[1] !== undefined) {
      content = match[1]; // \( ... \)
    } else if (match[2] !== undefined) {
      content = match[2];
      display = true; // \[ ... \]
    } else if (match[3] !== undefined) {
      content = match[3];
      display = true; // $$ ... $$
    } else if (match[4] !== undefined) {
      content = match[4]; // $ ... $
    }
    tokens.push({ kind: "math", content, display });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    tokens.push({ kind: "text", content: text.slice(lastIndex), display: false });
  }
  return tokens;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c));
}

/**
 * Renders mixed prose + mathematics. Each `\( ... \)`, `\[ ... \]`, `$...$` or
 * `$$...$$` span is typeset by KaTeX; everything else stays as normal text.
 *
 * Malformed expressions are caught and rendered as escaped plain text so a
 * bad question string can never crash the exam or review screen.
 */
export function MathText({ children, className, inline = true }: MathTextProps) {
  const tokens = tokenize(children);
  return (
    <span className={className} style={{ display: inline ? "inline" : "block" }}>
      {tokens.map((t, i) => {
        if (t.kind === "text") {
          return <span key={i}>{t.content}</span>;
        }
        let html = "";
        try {
          html = katex.renderToString(t.content, {
            throwOnError: false,
            displayMode: t.display,
          });
        } catch {
          html = `<span class="math-fallback">${escapeHtml(t.content)}</span>`;
        }
        // KaTeX already escapes its output; when throwOnError is false an
        // unparseable expression renders as its own error HTML, never script.
        return (
          <span
            key={i}
            style={{ display: t.display ? "block" : "inline-block", verticalAlign: t.display ? "middle" : "0.25em" }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </span>
  );
}
