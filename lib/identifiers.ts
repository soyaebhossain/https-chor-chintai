/**
 * Identifier normalisation and format checks. Pure functions, safe to use on
 * both client (instant feedback) and server (the authoritative check).
 */

export const IDENTIFIER_TYPES = ["IMEI", "SERIAL", "VIN", "SERVICE_TAG"] as const;
/** SERVICE_TAG stays in the DB enum for compatibility, but new data uses SERIAL (a Service Tag is a serial). */
export type IdentifierType = (typeof IDENTIFIER_TYPES)[number];
const BENGALI_DIGITS = "০১২৩৪৫৬৭৮৯";

/** Bengali digits → ASCII, uppercase, strip spaces, hyphens, dots and slashes, and a copied "IMEI" label. */
export function normalizeIdentifier(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[০-৯]/g, (d) => String(BENGALI_DIGITS.indexOf(d)))
    .toUpperCase()
    .replace(/[\s\-./]/g, "")
    .replace(/^\+/, "") // "+880…": a leading plus is never part of an IMEI or serial
    // People often copy the label too ("IMEI: 3569…", "IMEI1 3569…"). An IMEI is digits only, so a leading
    // "IMEI" (optionally numbered, with ":" or "#") followed by digits is never part of the number itself.
    .replace(/^IMEI[12]?[:#]*(?=\d)/, "");
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

/** The 15th digit that makes a 14-digit IMEI body Luhn-valid. */
export function imeiCheckDigit(body14: string): string {
  for (let d = 0; d <= 9; d++) if (luhnValid(body14 + d)) return String(d);
  throw new Error("unreachable");
}

export const isValidImei = (v: string) => /^\d{15}$/.test(v) && luhnValid(v);
/** 17 characters, letters I, O and Q are never used in a VIN. */
export const isValidVin = (v: string) => /^[A-HJ-NPR-Z0-9]{17}$/.test(v);
const isGenericSerial = (v: string) => /^[A-Z0-9]{4,64}$/.test(v);

/** A Bangladeshi mobile (SIM) number, with or without the 88 country code — often typed where an IMEI belongs. */
export const looksLikeBdPhoneNumber = (v: string) => /^(?:88)?01[3-9]\d{8}$/.test(v);

/**
 * The IMEI a phone owner most likely meant, from the common ways it gets written:
 *  - 15 digits                        → as is (if the check digit is right)
 *  - 14 digits (check digit left off) → add the check digit
 *  - 16 digits (IMEISV: IMEI body + 2-digit software version, shown by some phones) → first 14 + check digit
 *  - letter O for zero, I/L for one   → only if that yields a valid 15-digit IMEI
 */
export function imeiFrom(value: string): string | null {
  const v = /^[0-9OIL]{15}$/.test(value) && /[OIL]/.test(value) ? value.replace(/O/g, "0").replace(/[IL]/g, "1") : value;
  if (/^\d{15}$/.test(v)) return luhnValid(v) ? v : null;
  if (/^\d{14}$/.test(v)) return v + imeiCheckDigit(v);
  if (/^\d{16}$/.test(v)) return v.slice(0, 14) + imeiCheckDigit(v.slice(0, 14));
  return null;
}

export type IdentifierError =
  | "EMPTY"
  | "BAD_CHARACTERS"
  | "BENGALI_TEXT"
  | "LENGTH"
  | "IMEI_CHECKSUM"
  | "VIN_FORMAT"
  | "NOT_IMEI"
  | "PHONE_NUMBER";

export type IdentifierCheck =
  | { ok: true; value: string }
  | { ok: false; error: IdentifierError };

/** Shared first checks: empty, Bengali letters (e.g. a number plate), other symbols. */
function basicProblem(value: string): IdentifierError | null {
  if (!value) return "EMPTY";
  if (/[ঀ-৿]/.test(value)) return "BENGALI_TEXT";
  if (!/^[A-Z0-9]+$/.test(value)) return "BAD_CHARACTERS";
  return null;
}

/** Validate a value whose type the user chose explicitly. */
export function validateIdentifier(type: IdentifierType, raw: string): IdentifierCheck {
  const value = normalizeIdentifier(raw);
  const problem = basicProblem(value);
  if (problem) return { ok: false, error: problem };
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

export type SearchCandidate = { type: IdentifierType; value: string };
export type SearchPlan =
  | { ok: true; value: string; candidates: SearchCandidate[]; warning?: "IMEI_CHECKSUM" | "PHONE_NUMBER" }
  | { ok: false; error: IdentifierError };

/**
 * Work out what a free-text search could match. The public search box has
 * one input, so the value is looked up under every reading it plausibly has
 * (as typed → serial; as an IMEI, including 14/16-digit and O-for-0 forms;
 * as a VIN). Warnings mark inputs where "no record" would mislead: a
 * mistyped IMEI, or a mobile (SIM) number typed instead of an IMEI.
 */
export function planSearch(raw: string): SearchPlan {
  const value = normalizeIdentifier(raw);
  const problem = basicProblem(value);
  if (problem) return { ok: false, error: problem };
  if (!isGenericSerial(value)) return { ok: false, error: "LENGTH" };

  const candidates: SearchCandidate[] = [];
  const imei = imeiFrom(value);
  if (imei) candidates.push({ type: "IMEI", value: imei });
  if (isValidVin(value)) candidates.push({ type: "VIN", value });
  candidates.push({ type: "SERIAL", value });

  if (!imei && /^\d{15}$/.test(value)) return { ok: true, value, candidates, warning: "IMEI_CHECKSUM" };
  if (looksLikeBdPhoneNumber(value)) return { ok: true, value, candidates, warning: "PHONE_NUMBER" };
  return { ok: true, value, candidates };
}

export type ProductKind = "phone" | "vehicle" | "other";

/**
 * The report form asks for the number only — the type follows from the
 * product kind and the number's shape, so owners never have to know what
 * "IMEI" or "VIN" means:
 *  - phone + digits     → IMEI (14/15/16-digit forms accepted, Luhn-checked)
 *  - vehicle + 17 chars → VIN
 *  - anything else      → SERIAL
 */
export type Classified = { ok: true; value: string; type: IdentifierType } | { ok: false; error: IdentifierError };

export function classifyForReport(kind: ProductKind, raw: string): Classified {
  const value = normalizeIdentifier(raw);
  const problem = basicProblem(value);
  if (problem) return { ok: false, error: problem };
  if (kind === "phone") {
    const imei = imeiFrom(value);
    if (imei) return { ok: true, value: imei, type: "IMEI" };
    if (/^\d{15}$/.test(value)) return { ok: false, error: "IMEI_CHECKSUM" };
    // Phone serials are alphanumeric (R58M…, F2LX…). A digits-only value of any other length is almost
    // always a mistake — most often the owner's own mobile number.
    if (/^\d+$/.test(value)) return { ok: false, error: looksLikeBdPhoneNumber(value) ? "PHONE_NUMBER" : "NOT_IMEI" };
  }
  if (kind === "vehicle" && isValidVin(value)) return { ok: true, value, type: "VIN" };
  return isGenericSerial(value) ? { ok: true, value, type: "SERIAL" } : { ok: false, error: "LENGTH" };
}

export const IDENTIFIER_ERROR_MESSAGES: Record<IdentifierError, string> = {
  EMPTY: "একটি Serial, IMEI বা VIN লিখুন।",
  BAD_CHARACTERS: "শুধু ইংরেজি অক্ষর ও সংখ্যা ব্যবহার করুন।",
  BENGALI_TEXT: "বাংলা লেখা দিয়ে খোঁজা যায় না। IMEI, চেসিস (VIN) বা সিরিয়াল নম্বর ইংরেজি অক্ষর ও সংখ্যায় লিখুন। গাড়ির নম্বর প্লেট দিয়ে খোঁজা যায় না—রেজিস্ট্রেশন কাগজের চেসিস নম্বর দিন।",
  LENGTH: "নম্বরটি ৪ থেকে ৬৪ অক্ষরের হতে হবে (IMEI ১৫ অঙ্ক, VIN ১৭ অক্ষর)।",
  IMEI_CHECKSUM: "এই ১৫ অঙ্কের IMEI নম্বরটি সঠিক নয় — আবার মিলিয়ে দেখুন (*#06# ডায়াল করলে IMEI দেখা যায়)।",
  VIN_FORMAT: "VIN-এ I, O বা Q অক্ষর থাকে না — নম্বরটি আবার মিলিয়ে দেখুন।",
  NOT_IMEI: "মোবাইলের IMEI সবসময় ১৫ অঙ্কের হয়। ফোনে *#06# ডায়াল করে নম্বরটি দেখুন।",
  PHONE_NUMBER: "এটি মোবাইল (সিম) নম্বর, IMEI নয়। IMEI ১৫ অঙ্কের — ফোনে *#06# ডায়াল করলে বা বক্সের গায়ে দেখা যায়।",
};

/** What the public is allowed to see of an identifier. */
export function lastFour(value: string): string {
  return value.slice(-4);
}
