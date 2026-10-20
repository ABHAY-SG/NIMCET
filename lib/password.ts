// One password policy for every surface (web signup, password reset). Keeping
// the checks and the user-facing copy together prevents the reset page from
// silently drifting to a different rule than signup.

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const PASSWORD_RULE =
  "8+ characters with an uppercase letter, a number and a special character.";
export const PASSWORD_PLACEHOLDER =
  "Min. 8 chars, 1 uppercase, 1 number, 1 symbol";

export type PasswordChecks = {
  length: boolean;
  upper: boolean;
  number: boolean;
  special: boolean;
  ok: boolean;
};

export function passwordChecks(password: string): PasswordChecks {
  const value = typeof password === "string" ? password : "";
  const length = value.length >= PASSWORD_MIN_LENGTH;
  const upper = /[A-Z]/.test(value);
  const number = /\d/.test(value);
  const special = /[^A-Za-z0-9]/.test(value);
  return {
    length,
    upper,
    number,
    special,
    ok: length && upper && number && special,
  };
}

/** Human-readable reason the password is rejected, or null when it passes. */
export function passwordProblem(password: string): string | null {
  if (passwordChecks(password).ok) return null;
  return `Password needs ${PASSWORD_RULE}`;
}
