import { describe, expect, it } from "vitest";
import { sniffEvidenceMime } from "@/lib/evidence";
import { safeNextPath } from "@/lib/safe-path";
import { newTrackingId } from "@/lib/server/claims";
import { base32Decode, base32Encode, hotp, verifyTotp } from "@/lib/server/totp";

describe("TOTP (RFC 6238)", () => {
  // RFC 6238 appendix B test secret, SHA-1.
  const secret = base32Encode(Buffer.from("12345678901234567890"));

  it("matches the RFC test vectors (last 6 digits)", () => {
    const at = (seconds: number) => hotp(base32Decode(secret), Math.floor(seconds / 30));
    expect(at(59)).toBe("287082");
    expect(at(1111111109)).toBe("081804");
    expect(at(1234567890)).toBe("005924");
    expect(at(2000000000)).toBe("279037");
  });

  it("accepts one step of drift, rejects two", () => {
    const now = 1234567890_000;
    const code = hotp(base32Decode(secret), Math.floor(1234567890 / 30));
    expect(verifyTotp(secret, code, { now: now + 30_000 })).not.toBeNull();
    expect(verifyTotp(secret, code, { now: now + 90_000 })).toBeNull();
  });

  it("refuses to accept the same code twice", () => {
    const now = 1234567890_000;
    const code = hotp(base32Decode(secret), Math.floor(1234567890 / 30));
    const step = verifyTotp(secret, code, { now });
    expect(step).not.toBeNull();
    expect(verifyTotp(secret, code, { now, lastStep: step })).toBeNull();
  });

  it("rejects malformed codes", () => {
    expect(verifyTotp(secret, "12345")).toBeNull();
    expect(verifyTotp(secret, "abcdef")).toBeNull();
  });

  it("base32 round-trips", () => {
    const buf = Buffer.from([0, 1, 2, 250, 251, 255, 7]);
    expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true);
  });
});

describe("evidence type sniffing", () => {
  it("recognises PDF, JPEG and PNG by magic bytes", () => {
    expect(sniffEvidenceMime(new TextEncoder().encode("%PDF-1.7 ..."))).toBe("application/pdf");
    expect(sniffEvidenceMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]))).toBe("image/jpeg");
    expect(sniffEvidenceMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
  });

  it("rejects everything else, whatever the file is called", () => {
    expect(sniffEvidenceMime(new TextEncoder().encode("<html><script>"))).toBeNull();
    expect(sniffEvidenceMime(new TextEncoder().encode("MZ\x90\x00"))).toBeNull();
    expect(sniffEvidenceMime(new Uint8Array([]))).toBeNull();
  });
});

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/report")).toBe("/report");
    expect(safeNextPath("/admin/claims/x?y=1")).toBe("/admin/claims/x?y=1");
  });

  it("blocks open redirects", () => {
    for (const bad of ["https://evil.test", "//evil.test", String.raw`/\evil.test`, "javascript:alert(1)", "", null, "/login?next=/x"]) {
      expect(safeNextPath(bad)).toBe("/dashboard");
    }
  });
});

it("tracking IDs are unambiguous and dated", () => {
  const id = newTrackingId(new Date("2026-11-20T10:00:00Z"));
  expect(id).toMatch(/^CLM-261120-[0-9A-HJKMNP-TV-Z]{6}$/);
  expect(new Set(Array.from({ length: 200 }, () => newTrackingId())).size).toBe(200);
});

describe("clientIp", async () => {
  const { clientIp } = await import("@/lib/server/rate-limit");
  const h = new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9", "x-real-ip": "1.1.1.1", "cf-connecting-ip": "2.2.2.2" });

  it("reads only the configured header", () => {
    expect(clientIp(h, "x-forwarded-for")).toBe("203.0.113.9"); // right-most = added by our proxy
    expect(clientIp(h, "x-real-ip")).toBe("1.1.1.1");
    expect(clientIp(h, "cf-connecting-ip")).toBe("2.2.2.2");
  });

  it("does not fall back to other, client-controlled headers", () => {
    expect(clientIp(new Headers({ "x-real-ip": "1.1.1.1" }), "x-forwarded-for")).toBe("unknown");
  });
});
