/** @jest-environment node */

import {
  passwordChecks,
  passwordProblem,
} from "@/lib/password";

describe("password policy", () => {
  it("accepts a password that meets every rule", () => {
    const pw = "Nimcet2026!";
    expect(passwordChecks(pw).ok).toBe(true);
    expect(passwordProblem(pw)).toBeNull();
  });

  it.each([
    ["too short", "Ab1!xyz"],
    ["no uppercase", "nimcet2026!"],
    ["no number", "NimcetPass!"],
    ["no special character", "Nimcet2026"],
  ])("rejects %s", (_label, value) => {
    expect(passwordChecks(value).ok).toBe(false);
    expect(passwordProblem(value)).toMatch(/^Password needs /);
  });

  it("treats non-string input as an empty password", () => {
    expect(passwordChecks(undefined as unknown as string).ok).toBe(false);
    expect(passwordProblem(undefined as unknown as string)).not.toBeNull();
  });
});
