/**
 * Identifier normalisation and format checks. Pure functions, safe to use on
 * both client (instant feedback) and server (the authoritative check).
 */

export const IDENTIFIER_TYPES = ["IMEI", "SERIAL", "VIN", "SERVICE_TAG"] as const;
/** SERVICE_TAG stays in the DB enum for compatibility, but new data uses SERIAL (a Service Tag is a serial). */
export type IdentifierType = (typeof IDENTIFIER_TYPES)[number];
const BENGALI_DIGITS = "০১২৩৪৫৬৭৮৯";

/** Bengali digits → ASCII, uppercase, strip spaces, hyphens, dots and slashes. */
export function normalizeIdentifier(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[০-৯]/g, (d) => String(BENGALI_DIGITS.indexOf(d)))
    .toUpperCase()
    .replace(/[\s\-./]/g, "");
}

/** Luhn checksum, as used by the 15th (check) digit of an IMEI. */
export function luhnValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let n = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

export const isValidImei = (v: string) => /^\d{15}$/.test(v) && luhnValid(v);
/** 17 characters, letters I, O and Q are never used in a VIN. */
export const isValidVin = (v: string) => /^[A-HJ-NPR-Z0-9]{17}$/.test(v);
const isGenericSerial = (v: string) => /^[A-Z0-9]{4,64}$/.test(v);

export type IdentifierError = "EMPTY" | "BAD_CHARACTERS" | "LENGTH" | "IMEI_CHECKSUM" | "VIN_FORMAT";

export type IdentifierCheck =
  | { ok: true; value: string }
  | { ok: false; error: IdentifierError };

/** Validate a value whose type the user chose explicitly (report form). */
export function validateIdentifier(type: IdentifierType, raw: string): IdentifierCheck {
  const value = normalizeIdentifier(raw);
  if (!value) return { ok: false, error: "EMPTY" };
  if (!/^[A-Z0-9]+$/.test(value)) return { ok: false, error: "BAD_CHARACTERS" };
  switch (type) {
    case "IMEI":
      if (!/^\d{15}$/.test(value)) return { ok: false, error: "LENGTH" };
      return luhnValid(value) ? { ok: true, value } : { ok: false, error: "IMEI_CHECKSUM" };
    case "VIN":
      if (value.length !== 17) return { ok: false, error: "LENGTH" };
      return isValidVin(value) ? { ok: true, value } : { ok: false, error: "VIN_FORMAT" };
    default:
      return isGenericSerial(value) ? { ok: true, value } : { ok: false, error: "LENGTH" };
  }
}

export type SearchPlan =
  | { ok: true; value: string; types: IdentifierType[]; warning?: "IMEI_CHECKSUM" }
  | { ok: false; error: IdentifierError };

/**
 * Work out which identifier types a free-text search could be. The public
 * search box has one input, so we look the value up under every type it could
 * plausibly be. A 15-digit number that fails Luhn cannot be an IMEI but may
 * still be a serial (a camera or laptop), so it is searched as a serial; if
 * nothing matches, the caller tells the user the IMEI looks mistyped.
 */
export function planSearch(raw: string): SearchPlan {
  const value = normalizeIdentifier(raw);
  if (!value) return { ok: false, error: "EMPTY" };
  if (!/^[A-Z0-9]+$/.test(value)) return { ok: false, error: "BAD_CHARACTERS" };
  if (!isGenericSerial(value)) return { ok: false, error: "LENGTH" };

  if (/^\d{15}$/.test(value)) {
    return luhnValid(value) ? { ok: true, value, types: ["IMEI", "SERIAL"] } : { ok: true, value, types: ["SERIAL"], warning: "IMEI_CHECKSUM" };
  }
  return { ok: true, value, types: isValidVin(value) ? ["VIN", "SERIAL"] : ["SERIAL"] };
}

export type ProductKind = "phone" | "vehicle" | "other";

/**
 * The report form asks for the number only — the type follows from the
 * product kind and the number's shape, so owners never have to know what
 * "IMEI" or "VIN" means:
 *  - phone + 15 digits  → IMEI (Luhn-checked, so typos are caught)
 *  - vehicle + 17 chars → VIN
 *  - anything else      → SERIAL
 */
export type Classified = { ok: true; value: string; type: IdentifierType } | { ok: false; error: IdentifierError };

export function classifyForReport(kind: ProductKind, raw: string): Classified {
  const value = normalizeIdentifier(raw);
  if (!value) return { ok: false, error: "EMPTY" };
  if (!/^[A-Z0-9]+$/.test(value)) return { ok: false, error: "BAD_CHARACTERS" };
  if (kind === "phone" && /^\d{15}$/.test(value)) {
    return luhnValid(value) ? { ok: true, value, type: "IMEI" } : { ok: false, error: "IMEI_CHECKSUM" };
  }
  if (kind === "vehicle" && isValidVin(value)) return { ok: true, value, type: "VIN" };
  return isGenericSerial(value) ? { ok: true, value, type: "SERIAL" } : { ok: false, error: "LENGTH" };
}

export const IDENTIFIER_ERROR_MESSAGES: Record<IdentifierError, string> = {
  EMPTY: "একটি Serial, IMEI বা VIN লিখুন।",
  BAD_CHARACTERS: "শুধু ইংরেজি অক্ষর ও সংখ্যা ব্যবহার করুন।",
  LENGTH: "নম্বরটি ৪ থেকে ৬৪ অক্ষরের হতে হবে (IMEI ১৫ অঙ্ক, VIN ১৭ অক্ষর)।",
  IMEI_CHECKSUM: "এই ১৫ অঙ্কের IMEI নম্বরটি সঠিক নয় — আবার মিলিয়ে দেখুন (*#06# ডায়াল করলে IMEI দেখা যায়)।",
  VIN_FORMAT: "VIN-এ I, O বা Q অক্ষর থাকে না — নম্বরটি আবার মিলিয়ে দেখুন।",
};

/** What the public is allowed to see of an identifier. */
export function lastFour(value: string): string {
  return value.slice(-4);
}
