import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import type { IdentifierType } from "@/lib/identifiers";

/** Deterministic lookup key. The type is part of the input so an IMEI and a serial never collide. */
export function identifierHmac(secret: string, type: IdentifierType, normalizedValue: string): string {
  return createHmac("sha256", secret).update(`${type}:${normalizedValue}`).digest("hex");
}

/** AES-256-GCM; output is `v1.<iv>.<tag>.<ciphertext>` in base64url. */
export function encryptField(base64Key: string, plaintext: string): string {
  const key = Buffer.from(base64Key, "base64");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), ciphertext].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

export function decryptField(base64Key: string, payload: string): string {
  const [version, iv, tag, ciphertext] = payload.split(".");
  if (version !== "v1" || !iv || !tag || ciphertext === undefined) throw new Error("Unrecognised ciphertext format");
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(base64Key, "base64"), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

/** Binary AES-256-GCM for evidence files: [version=1][iv 12][tag 16][ciphertext]. */
export function encryptBuffer(base64Key: string, plaintext: Uint8Array): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(base64Key, "base64"), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([Buffer.from([1]), iv, cipher.getAuthTag(), ciphertext]);
}

export function decryptBuffer(base64Key: string, payload: Uint8Array): Buffer {
  const buf = Buffer.from(payload);
  if (buf[0] !== 1 || buf.length < 29) throw new Error("Unrecognised encrypted file format");
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(base64Key, "base64"), buf.subarray(1, 13));
  decipher.setAuthTag(buf.subarray(13, 29));
  return Buffer.concat([decipher.update(buf.subarray(29)), decipher.final()]);
}

/** Keyed hash for values that must be compared or counted but never stored (IPs, emails in rate-limit keys, login codes). */
export function keyedHash(secret: string, purpose: string, value: string): string {
  return createHmac("sha256", secret).update(`${purpose}:${value}`).digest("hex");
}
