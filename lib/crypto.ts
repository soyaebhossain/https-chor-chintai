import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "./env";

/** Keyed hash used for lookups, so raw identifiers and phone numbers are never queried or indexed. */
export function lookupHash(value: string): string {
  return createHmac("sha256", env().IDENTIFIER_HMAC_SECRET).update(value).digest("hex");
}

function encryptionKey() {
  return createHash("sha256").update(env().FIELD_ENCRYPTION_KEY).digest();
}

/** AES-256-GCM. Output: v1.<iv>.<tag>.<ciphertext> (base64url). */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), data].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

export function decrypt(payload: string): string {
  const [version, iv, tag, data] = payload.split(".");
  if (version !== "v1") throw new Error("Unknown ciphertext version");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

/** Signed, tamper-proof cookie value: <payload>.<signature>. */
export function sign(payload: string): string {
  const sig = createHmac("sha256", env().SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verify(token: string | undefined): string | null {
  if (!token) return null;
  const i = token.lastIndexOf(".");
  if (i <= 0) return null;
  const payload = token.slice(0, i);
  const expected = Buffer.from(sign(payload).slice(i + 1));
  const given = Buffer.from(token.slice(i + 1));
  return expected.length === given.length && timingSafeEqual(expected, given) ? payload : null;
}

export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

// Crockford-style alphabet without 0/O/1/I/L so IDs are easy to read out on the phone.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export function trackingId(): string {
  const bytes = randomBytes(8);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return `CC-${out.slice(0, 4)}-${out.slice(4)}`;
}
