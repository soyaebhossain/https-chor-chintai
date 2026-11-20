import { describe, expect, it } from "vitest";
import { luhnValid, matchKey, normalizeIdentifier, parseIdentifier } from "@/lib/identifiers";
import { normalizeBdPhone, sniffMime } from "@/lib/validation";

describe("identifiers", () => {
  it("normalizes spaces, dashes and case", () => {
    expect(normalizeIdentifier(" 35-693803 564.3809 ")).toBe("356938035643809");
    expect(normalizeIdentifier("c02x-abc")).toBe("C02XABC");
  });

  it("validates IMEI check digits", () => {
    expect(luhnValid("356938035643809")).toBe(true);
    expect(parseIdentifier("356938035643809")).toEqual({ ok: true, type: "IMEI", value: "356938035643809" });
    expect(parseIdentifier("356938035643808").ok).toBe(false);
  });

  it("matches IMEI and IMEISV on the first 14 digits", () => {
    const imei = parseIdentifier("356938035643809");
    const imeisv = parseIdentifier("3569380356438012");
    expect(imei.ok && imeisv.ok).toBe(true);
    if (imei.ok && imeisv.ok) expect(matchKey(imei.type, imei.value)).toBe(matchKey(imeisv.type, imeisv.value));
  });

  it("detects VINs and falls back to serial numbers", () => {
    expect(parseIdentifier("1HGCM82633A004352")).toMatchObject({ ok: true, type: "VIN" });
    expect(parseIdentifier("C02XL0GTJGH5")).toMatchObject({ ok: true, type: "SERIAL" });
    expect(parseIdentifier("ab").ok).toBe(false);
    expect(parseIdentifier("abc$123").ok).toBe(false);
  });
});

describe("validation helpers", () => {
  it("normalizes Bangladeshi mobile numbers", () => {
    expect(normalizeBdPhone("01712345678")).toBe("01712345678");
    expect(normalizeBdPhone("+880 1712-345678")).toBe("01712345678");
    expect(normalizeBdPhone("8801712345678")).toBe("01712345678");
    expect(normalizeBdPhone("01212345678")).toBeNull();
    expect(normalizeBdPhone("12345")).toBeNull();
  });

  it("detects file types from content, not the name", () => {
    expect(sniffMime(Buffer.from("%PDF-1.7"))).toBe("application/pdf");
    expect(sniffMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffMime(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBe("image/png");
    expect(sniffMime(Buffer.from("<svg onload=alert(1)>"))).toBeNull();
  });
});
