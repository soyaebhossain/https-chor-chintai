import "server-only";
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Password hashing with scrypt (memory-hard; built into Node, no native
 * dependency). Stored as `scrypt$N$r$p$salt$hash` so parameters can be
 * raised later without breaking existing hashes.
 */
const N = 32768; // 2^15
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 64 * 1024 * 1024;

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

const scrypt = (password: string, salt: Buffer, keylen: number, opts: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) => scryptCb(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key))));

// NFKC so the same password typed on different keyboards (e.g. Bengali digits vs. ASCII width) still matches.
const prepare = (password: string) => password.normalize("NFKC");

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(prepare(password), salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return ["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const key = await scrypt(prepare(password), Buffer.from(salt, "base64url"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: MAXMEM,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

let dummy: Promise<string> | undefined;

/** Run a real hash comparison even when the account does not exist, so response time does not reveal which emails are registered. */
export async function burnPasswordCheck(password: string): Promise<false> {
  dummy ??= hashPassword(randomBytes(12).toString("hex"));
  await verifyPassword(password, await dummy);
  return false;
}

/** Plain-language checks shown to the user. */
export function passwordProblem(password: string, email: string): string | null {
  if (password.length < PASSWORD_MIN) return `পাসওয়ার্ড কমপক্ষে ${PASSWORD_MIN.toLocaleString("bn-BD")} অক্ষরের হতে হবে।`;
  if (password.length > PASSWORD_MAX) return `পাসওয়ার্ড সর্বোচ্চ ${PASSWORD_MAX.toLocaleString("bn-BD")} অক্ষরের হতে পারে।`;
  if (/^(.)\1+$/.test(password) || /^(?:0123456789|1234567890|password\d*|qwerty\w*)$/i.test(password)) return "পাসওয়ার্ডটি খুব সহজ — অন্য কিছু দিন।";
  if (password.toLowerCase().includes(email.split("@")[0].toLowerCase()) && email.split("@")[0].length >= 4) return "পাসওয়ার্ডে ইমেইলের নাম রাখবেন না।";
  return null;
}
