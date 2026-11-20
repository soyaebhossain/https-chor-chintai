import "server-only";
import { createHmac, randomBytes } from "node:crypto";

/** RFC 6238 TOTP (SHA-1, 30 s, 6 digits) — what Google Authenticator, Authy and 1Password use. */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_PERIOD = 30;

export function base32Encode(buf: Uint8Array): string {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, "").replace(/\s/g, "").toUpperCase();
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error("Invalid base32");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function hotp(secret: Uint8Array, counter: number, digits = 6): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", secret).update(msg).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const code = (mac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits;
  return code.toString().padStart(digits, "0");
}

export const generateTotpSecret = () => base32Encode(randomBytes(20));

/**
 * Returns the matched time step, or null. Accepts one step of clock drift
 * either way and rejects any step at or before `lastStep` (replay protection).
 */
export function verifyTotp(secretBase32: string, code: string, opts: { now?: number; lastStep?: number | null } = {}): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const secret = base32Decode(secretBase32);
  const current = Math.floor((opts.now ?? Date.now()) / 1000 / TOTP_PERIOD);
  for (const step of [current - 1, current, current + 1]) {
    if (opts.lastStep != null && step <= opts.lastStep) continue;
    if (hotp(secret, step) === code) return step;
  }
  return null;
}

export function otpauthUri(secretBase32: string, account: string, issuer = "Chor Chintai"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${TOTP_PERIOD}`;
}
