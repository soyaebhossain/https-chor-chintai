export type IdentifierType = "IMEI" | "VIN" | "SERIAL";

export const identifierLabels: Record<IdentifierType, string> = {
  IMEI: "IMEI",
  VIN: "VIN / Chassis",
  SERIAL: "Serial / Service Tag",
};

/** Uppercase and strip spaces, dashes, dots and slashes people often type. */
export function normalizeIdentifier(value: string): string {
  return value.normalize("NFKC").toUpperCase().replace(/[\s\-./]/g, "");
}

export function luhnValid(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export type ParsedIdentifier =
  | { ok: true; type: IdentifierType; value: string }
  | { ok: false; error: string };

/**
 * Work out what kind of number the person typed so they don't have to pick a
 * type first. 15 digits = IMEI (checked with Luhn), 17 letters/digits without
 * I/O/Q = VIN, anything else of a sensible length = serial number.
 */
export function parseIdentifier(input: string): ParsedIdentifier {
  const value = normalizeIdentifier(input);
  if (!value) return { ok: false, error: "একটি নম্বর লিখুন।" };
  if (!/^[A-Z0-9]+$/.test(value)) return { ok: false, error: "শুধু ইংরেজি অক্ষর ও সংখ্যা ব্যবহার করুন।" };
  if (/^\d{14}$/.test(value) || /^\d{16}$/.test(value)) {
    // IMEI without its check digit (14) or IMEISV (16): matched on the first 14 digits.
    return { ok: true, type: "IMEI", value };
  }
  if (/^\d{15}$/.test(value)) {
    if (!luhnValid(value)) return { ok: false, error: "IMEI নম্বরটি সঠিক নয়। ফোনে *#06# ডায়াল করে আবার মিলিয়ে দেখুন।" };
    return { ok: true, type: "IMEI", value };
  }
  if (value.length === 17 && /^[A-HJ-NPR-Z0-9]{17}$/.test(value) && /[A-Z]/.test(value)) {
    return { ok: true, type: "VIN", value };
  }
  if (value.length < 5) return { ok: false, error: "নম্বরটি খুব ছোট। পুরো নম্বর লিখুন।" };
  if (value.length > 40) return { ok: false, error: "নম্বরটি খুব বড়।" };
  return { ok: true, type: "SERIAL", value };
}

/** IMEIs are matched on their first 14 digits so IMEI/IMEISV variants line up. */
export function matchKey(type: IdentifierType, value: string): string {
  return type === "IMEI" ? `IMEI:${value.slice(0, 14)}` : `${type}:${value}`;
}

export function maskIdentifier(last4: string): string {
  return `•••• ${last4}`;
}
