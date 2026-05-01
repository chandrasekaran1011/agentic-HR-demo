import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: () => ({ get: () => undefined }),
}));

import { signSession, verifySession, validateCredentials } from "./auth";

describe("auth helpers", () => {
  beforeEach(() => {
    process.env.AUTH_SESSION_SECRET = "test-secret-32-bytes-minimum-length-xx";
    process.env.AUTH_USERS = JSON.stringify([
      { username: "hr", password: "acme2026", name: "HR User" },
    ]);
  });

  it("signs and verifies a session token", () => {
    const token = signSession({ username: "hr", name: "HR User" });
    const session = verifySession(token);
    expect(session?.username).toBe("hr");
    expect(session?.name).toBe("HR User");
  });

  it("rejects a tampered token", () => {
    const token = signSession({ username: "hr", name: "HR User" });
    const tampered = token.slice(0, -2) + "xx";
    expect(verifySession(tampered)).toBeNull();
  });

  it("validates correct credentials", () => {
    const u = validateCredentials("hr", "acme2026");
    expect(u?.username).toBe("hr");
  });

  it("rejects wrong password", () => {
    expect(validateCredentials("hr", "wrong")).toBeNull();
  });
});
