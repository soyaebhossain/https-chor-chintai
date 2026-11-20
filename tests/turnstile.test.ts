import { afterEach, describe, expect, it, vi } from "vitest";

const env = { TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA" as string | undefined };
vi.mock("@/lib/server/env", () => ({ getEnv: () => env }));

const { verifyTurnstile } = await import("@/lib/server/turnstile");

afterEach(() => { vi.unstubAllGlobals(); env.TURNSTILE_SECRET_KEY = "1x0000000000000000000000000000000AA"; });

describe("verifyTurnstile", () => {
  it("skips the check when no secret is configured (development only — env.ts enforces it in production)", async () => {
    env.TURNSTILE_SECRET_KEY = undefined;
    expect(await verifyTurnstile(undefined)).toBe(true);
  });

  it("rejects a missing or oversized token without calling Cloudflare", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await verifyTurnstile(null)).toBe(false);
    expect(await verifyTurnstile("")).toBe(false);
    expect(await verifyTurnstile("x".repeat(3000))).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts only when Cloudflare says success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ success: true })));
    expect(await verifyTurnstile("token", "203.0.113.5")).toBe(true);
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ success: false, "error-codes": ["invalid-input-response"] })));
    expect(await verifyTurnstile("token")).toBe(false);
  });

  it("fails closed when Cloudflare cannot be reached", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    expect(await verifyTurnstile("token")).toBe(false);
  });
});
