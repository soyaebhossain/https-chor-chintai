import { execSync } from "node:child_process";
import { createHmac, randomInt } from "node:crypto";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

export const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);

export function makeImei() {
  const body = `35${Array.from({ length: 12 }, () => randomInt(10)).join("")}`;
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    let n = Number(body[body.length - 1 - i]);
    if (i % 2 === 0) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return body + ((10 - (sum % 10)) % 10);
}

const step = () => Math.floor(Date.now() / 30_000);

function totpAt(secretBase32: string, counter: number) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0;
  const bytes: number[] = [];
  for (const ch of secretBase32.replace(/\s/g, "")) {
    value = (value << 5) | alphabet.indexOf(ch);
    bits += 5;
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", Buffer.from(bytes)).update(msg).digest();
  const offset = mac[mac.length - 1] & 15;
  return ((mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
}

/** A TOTP code for a time step later than `usedStep` (the server rejects replays); waits if needed. */
export async function freshTotp(secretBase32: string, usedStep = -1): Promise<{ code: string; step: number }> {
  while (step() <= usedStep) await new Promise((r) => setTimeout(r, 1000));
  const s = step();
  return { code: totpAt(secretBase32, s), step: s };
}

const mailFile = (email: string) => path.join(process.cwd(), ".dev-mail", `${email}.txt`);

export async function requestCode(page: Page, email: string) {
  rmSync(mailFile(email), { force: true });
  await page.getByLabel("ইমেইল ঠিকানা").fill(email);
  await page.getByRole("button", { name: "কোড পাঠান" }).click();
  await expect(page.getByLabel("লগইন কোড")).toBeVisible();
  return readCode(email);
}

export async function readCode(email: string) {
  await expect.poll(() => existsSync(mailFile(email)), { timeout: 15_000 }).toBe(true);
  return /^Subject: (\d{6})/.exec(readFileSync(mailFile(email), "utf8"))![1];
}

export async function login(page: Page, email: string) {
  const code = await requestCode(page, email);
  await page.getByLabel("লগইন কোড").fill(code);
  await page.getByRole("button", { name: "লগইন করুন" }).click();
}

export function setRole(email: string, role: "USER" | "REVIEWER" | "ADMIN") {
  execSync(`npm run user:role -- ${email} ${role}`, { stdio: "pipe" });
}

export async function fillReport(page: Page, o: { model: string; imei: string; withFile?: boolean }) {
  await page.getByLabel("পণ্যের ধরন").selectOption("মোবাইল ও ট্যাব");
  await page.getByLabel("ব্র্যান্ড").fill("Xiaomi");
  await page.getByLabel("মডেল").fill(o.model);
  await page.getByLabel("IMEI নম্বর").fill(o.imei);
  await page.getByText("চুরি", { exact: true }).click();
  await page.getByLabel("তারিখ").fill("2026-11-05");
  await page.locator('input[name="location"]').fill("মোহাম্মদপুর, ঢাকা");
  await page.getByLabel("সংক্ষেপে বিবরণ").fill("রাতে বাসার জানালা দিয়ে ফোনটি চুরি হয়েছে, পরদিন সকালে টের পাই।");
  await page.getByLabel(/আমি নিশ্চিত করছি/).check();
  if (o.withFile !== false) await page.locator('input[name="evidence"]').setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "রিপোর্ট জমা দিন" }).click();
  await expect(page.getByText("রিপোর্ট গ্রহণ করা হয়েছে")).toBeVisible({ timeout: 30_000 });
  return (await page.locator("b.font-mono").textContent())!.trim();
}

export async function search(page: Page, query: string) {
  const res = await page.request.post("/api/v1/search", { data: { query } });
  return (await res.json()).status as string;
}

/** All test traffic comes from one IP, so per-IP limits would trip across tests; each test starts fresh. */
export async function resetRateLimits() {
  const postgres = (await import("postgres")).default;
  try { process.loadEnvFile(); } catch {}
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  try { await sql`delete from rate_limits`; } finally { await sql.end(); }
}
