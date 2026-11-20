import { describe, expect, it } from "vitest";
import { resolveDatabaseUrl } from "@/lib/database-url.mjs";

describe("resolveDatabaseUrl", () => {
  it("prefers DATABASE_URL", () => {
    expect(resolveDatabaseUrl({ DATABASE_URL: "postgres://a", NEON_URL: "postgres://b" })).toBe("postgres://a");
  });

  it("falls back to the Neon-prefixed variable when DATABASE_URL is empty", () => {
    expect(resolveDatabaseUrl({ DATABASE_URL: "", NEON_URL: "postgres://neon" })).toBe("postgres://neon");
    expect(resolveDatabaseUrl({ DATABASE_URL: "  ", NEON_POSTGRES_URL: "postgres://neon2" })).toBe("postgres://neon2");
  });

  it("uses the unpooled URL for migrations when asked", () => {
    const env = { NEON_URL: "postgres://pooled", NEON_URL_UNPOOLED: "postgres://direct" };
    expect(resolveDatabaseUrl(env, { direct: true })).toBe("postgres://direct");
    expect(resolveDatabaseUrl(env)).toBe("postgres://pooled");
  });

  it("returns undefined when nothing is set", () => {
    expect(resolveDatabaseUrl({})).toBeUndefined();
  });
});
