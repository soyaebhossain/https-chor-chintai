import { describe, expect, it } from "vitest";
import { classifyForReport, isValidImei, isValidVin, lastFour, luhnValid, normalizeIdentifier, planSearch, validateIdentifier } from "@/lib/identifiers";

describe("normalizeIdentifier", () => {
  it("strips separators and uppercases", () => {
    expect(normalizeIdentifier(" 35-693803 5643809 ")).toBe("356938035643809");
    expect(normalizeIdentifier("abc.12/3")).toBe("ABC123");
  });

  it("converts Bengali digits", () => {
    expect(normalizeIdentifier("৩৫৬৯৩৮০৩৫৬৪৩৮০৯")).toBe("356938035643809");
  });

  it("folds full-width characters", () => {
    expect(normalizeIdentifier("ＡＢＣ１２３")).toBe("ABC123");
  });
});

describe("Luhn / IMEI", () => {
  it("accepts valid IMEIs", () => {
    expect(isValidImei("356938035643809")).toBe(true);
    expect(isValidImei("490154203237518")).toBe(true);
  });

  it("rejects a single-digit typo", () => {
    expect(isValidImei("356938035643808")).toBe(false);
    expect(luhnValid("356938035643808")).toBe(false);
  });

  it("rejects wrong length and non-digits", () => {
    expect(isValidImei("35693803564380")).toBe(false);
    expect(isValidImei("35693803564380A")).toBe(false);
    expect(luhnValid("")).toBe(false);
  });
});

describe("VIN", () => {
  it("accepts 17 characters without I/O/Q", () => {
    expect(isValidVin("1HGCM82633A004352")).toBe(true);
  });

  it("rejects I, O, Q and wrong length", () => {
    expect(isValidVin("1HGCM82633A00435O")).toBe(false);
    expect(isValidVin("1HGCM82633A00435")).toBe(false);
  });
});

describe("validateIdentifier (explicit type)", () => {
  it("reports the specific problem", () => {
    expect(validateIdentifier("IMEI", "356938035643808")).toEqual({ ok: false, error: "IMEI_CHECKSUM" });
    expect(validateIdentifier("IMEI", "12345")).toEqual({ ok: false, error: "LENGTH" });
    expect(validateIdentifier("VIN", "1HGCM82633A00435Q")).toEqual({ ok: false, error: "VIN_FORMAT" });
    expect(validateIdentifier("SERIAL", "")).toEqual({ ok: false, error: "EMPTY" });
    expect(validateIdentifier("SERIAL", "ab#12")).toEqual({ ok: false, error: "BAD_CHARACTERS" });
  });

  it("returns the normalized value", () => {
    expect(validateIdentifier("SERIAL", "c02-xk1 23")).toEqual({ ok: true, value: "C02XK123" });
  });
});

describe("planSearch (free-text search box)", () => {
  it("searches a valid IMEI as IMEI and serial", () => {
    expect(planSearch("356938035643809")).toEqual({ ok: true, value: "356938035643809", types: ["IMEI", "SERIAL"] });
  });

  it("searches a 15-digit non-IMEI as a serial, flagging a likely IMEI typo", () => {
    expect(planSearch("356938035643808")).toEqual({ ok: true, value: "356938035643808", types: ["SERIAL"], warning: "IMEI_CHECKSUM" });
  });

  it("includes VIN only for VIN-shaped values", () => {
    expect(planSearch("1HGCM82633A004352")).toMatchObject({ ok: true, types: ["VIN", "SERIAL"] });
    expect(planSearch("5CG1234XYZ")).toMatchObject({ ok: true, types: ["SERIAL"] });
  });

  it("rejects too short, too long and odd characters", () => {
    expect(planSearch("AB1")).toEqual({ ok: false, error: "LENGTH" });
    expect(planSearch("A".repeat(65))).toEqual({ ok: false, error: "LENGTH" });
    expect(planSearch("abc<script>")).toEqual({ ok: false, error: "BAD_CHARACTERS" });
  });
});

it("lastFour exposes only the tail", () => {
  expect(lastFour("356938035643809")).toBe("3809");
});

describe("classifyForReport (owner never picks a type)", () => {
  it("phones: 15 digits become a Luhn-checked IMEI", () => {
    expect(classifyForReport("phone", "35-693803-564380-9")).toEqual({ ok: true, value: "356938035643809", type: "IMEI" });
    expect(classifyForReport("phone", "356938035643808")).toEqual({ ok: false, error: "IMEI_CHECKSUM" });
  });

  it("phones without cellular (Wi-Fi tablets) fall back to serial", () => {
    expect(classifyForReport("phone", "DMPXK1234ABC")).toEqual({ ok: true, value: "DMPXK1234ABC", type: "SERIAL" });
  });

  it("vehicles: a valid 17-char VIN is a VIN, an engine number is a serial", () => {
    expect(classifyForReport("vehicle", "1HGCM82633A004352")).toMatchObject({ ok: true, type: "VIN" });
    expect(classifyForReport("vehicle", "E3T5E1234567")).toMatchObject({ ok: true, type: "SERIAL" });
  });

  it("a 15-digit laptop serial is not mistaken for an IMEI", () => {
    expect(classifyForReport("other", "356938035643808")).toMatchObject({ ok: true, type: "SERIAL" });
  });
});
