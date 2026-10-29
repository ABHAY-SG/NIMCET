import { parseAdminEmails } from "@/lib/admin";

describe("parseAdminEmails", () => {
  it("normalizes pasted allowlist values", () => {
    expect(parseAdminEmails(' Admin@Example.com, "ops@example.com" , Ops@Example.com ')).toEqual([
      "admin@example.com",
      "ops@example.com",
      "ops@example.com",
    ]);
  });

  it("treats an empty or missing value as not configured", () => {
    expect(parseAdminEmails("")).toEqual([]);
    expect(parseAdminEmails(" , , ")).toEqual([]);
    expect(parseAdminEmails(null)).toEqual([]);
    expect(parseAdminEmails(undefined)).toEqual([]);
  });
});
