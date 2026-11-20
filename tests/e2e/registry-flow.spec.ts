import { execSync } from "node:child_process";
import { createHmac, randomInt } from "node:crypto";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { resetRateLimits } from "./helpers";

test.beforeEach(resetRateLimits);

const run = Date.now().toString(36);
const reporter = `reporter-${run}@e2e.test`;
const reviewer = `reviewer-${run}@e2e.test`;
const outsider = `user-${run}@e2e.test`;
const model = `E2E-${run}`;
const imei = makeImei();
const imei2 = makeImei();

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);

function makeImei() {
  const body = `35${Array.from({ length: 12 }, () => randomInt(10)).join("")}`;
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    let n = Number(body[body.length - 1 - i]);
    if (i % 2 === 0) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return body + ((10 - (sum % 10)) % 10);
}

function totp(secretBase32: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0;
  const bytes: number[] = [];
  for (const ch of secretBase32.replace(/\s/g, "")) {
    value = (value << 5) | alphabet.indexOf(ch);
    bits += 5;
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const mac = createHmac("sha1", Buffer.from(bytes)).update(msg).digest();
  const offset = mac[mac.length - 1] & 15;
  return ((mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
}

const mailFile = (email: string) => path.join(process.cwd(), ".dev-mail", `${email}.txt`);

async function login(page: Page, email: string) {
  rmSync(mailFile(email), { force: true });
  const toCode = page.getByRole("button", { name: "পাসওয়ার্ড ছাড়া, ইমেইলে কোড দিয়ে লগইন" });
  if (await toCode.isVisible().catch(() => false)) await toCode.click();
  await page.getByLabel("ইমেইল ঠিকানা").fill(email);
  await page.getByRole("button", { name: "কোড পাঠান" }).click();
  await expect(page.getByLabel("লগইন কোড")).toBeVisible();
  await expect.poll(() => existsSync(mailFile(email)), { timeout: 15_000 }).toBe(true);
  const code = /^Subject: (\d{6})/.exec(readFileSync(mailFile(email), "utf8"))![1];
  await page.getByLabel("লগইন কোড").fill(code);
  await page.getByRole("button", { name: "লগইন করুন" }).click();
}

async function search(page: Page, query: string) {
  const res = await page.request.post("/api/v1/search", { data: { query } });
  return res.json();
}

test("report (dual IMEI) → MFA reviewer approves → search → appeal → recovery", async ({ browser }) => {
  // --- Reporter
  const reporterPage = await (await browser.newContext()).newPage();
  await reporterPage.goto("/report");
  await expect(reporterPage).toHaveURL(/\/login\?next=%2Freport/);
  await login(reporterPage, reporter);
  await expect(reporterPage).toHaveURL(/\/report$/);

  await reporterPage.getByLabel("পণ্যের ধরন").selectOption("মোবাইল ও ট্যাব");
  await reporterPage.getByLabel("ব্র্যান্ড").fill("Samsung");
  await reporterPage.getByLabel("মডেল").fill(model);
  await reporterPage.getByLabel("IMEI নম্বর").fill(imei); // label follows the category; no type picker
  await reporterPage.getByLabel(/দ্বিতীয় IMEI/).fill(imei2);
  await reporterPage.getByText("ছিনতাই", { exact: true }).click();
  await reporterPage.getByLabel("তারিখ").fill("2026-11-01");
  await reporterPage.locator('input[name="location"]').fill("মিরপুর, ঢাকা");
  await reporterPage.getByLabel(/থানার জিডি/).fill("মিরপুর থানা জিডি ৪৫৬");
  await reporterPage.getByLabel("সংক্ষেপে বিবরণ").fill("সন্ধ্যায় বাসায় ফেরার পথে মোটরসাইকেলে এসে দুইজন ফোনটি ছিনিয়ে নেয়।");
  await reporterPage.getByLabel(/আমি নিশ্চিত করছি/).check();

  // A file that only *claims* to be a PNG is rejected server-side.
  const fileInput = reporterPage.locator('input[name="evidence"]');
  await fileInput.setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: Buffer.from("<html><script>alert(1)</script>") });
  await reporterPage.getByRole("button", { name: "রিপোর্ট জমা দিন" }).click();
  await expect(reporterPage.getByText(/PDF, JPG বা PNG নয়/)).toBeVisible();
  await expect(reporterPage.getByLabel("মডেল")).toHaveValue(model); // the form kept its values

  await reporterPage.getByRole("button", { name: /receipt\.png সরান/ }).click();
  await fileInput.setInputFiles({ name: "box-photo.png", mimeType: "image/png", buffer: PNG });
  await reporterPage.getByRole("button", { name: "রিপোর্ট জমা দিন" }).click();
  await expect(reporterPage.getByText("রিপোর্ট গ্রহণ করা হয়েছে")).toBeVisible({ timeout: 30_000 });
  const trackingId = (await reporterPage.locator("b.font-mono").textContent())!.trim();
  expect(trackingId).toMatch(/^CLM-\d{6}-[0-9A-Z]{6}$/);

  // Not public until a human approves it.
  expect((await search(reporterPage, imei)).status).toBe("clear");

  // --- Reviewer: role granted from the CLI, MFA enrolment forced before the console opens.
  execSync(`npm run user:role -- ${reviewer} REVIEWER`, { stdio: "pipe" });
  const reviewerPage = await (await browser.newContext()).newPage();
  await reviewerPage.goto("/admin");
  await login(reviewerPage, reviewer);
  await expect(reviewerPage).toHaveURL(/\/account\/mfa\?next=%2Fadmin/);
  await reviewerPage.getByText("QR স্ক্যান করা যাচ্ছে না?").click();
  const secret = (await reviewerPage.locator("details p.font-mono").textContent())!;
  await reviewerPage.getByLabel(/Authenticator অ্যাপের/).fill(totp(secret));
  await reviewerPage.getByRole("button", { name: "চালু করুন" }).click();
  await expect(reviewerPage).toHaveURL(/\/admin$/);

  const row = reviewerPage.getByRole("row").filter({ hasText: trackingId });
  await expect(row).toBeVisible();
  await row.getByRole("link", { name: /পর্যালোচনা/ }).click();
  await expect(reviewerPage.getByText(imei)).toBeVisible(); // full number visible to reviewer (audited)

  const docHref = await reviewerPage.getByRole("link", { name: /ফাইল ১/ }).getAttribute("href");
  const doc = await reviewerPage.request.get(docHref!);
  expect(doc.status()).toBe(200);
  expect(doc.headers()["content-type"]).toBe("image/png");
  expect(Buffer.compare(await doc.body(), PNG)).toBe(0); // decrypted bytes match the upload

  await reviewerPage.getByLabel("অনুমোদন ও প্রকাশ").check();
  await reviewerPage.getByRole("button", { name: "সিদ্ধান্ত সংরক্ষণ করুন" }).click();
  await expect(reviewerPage).toHaveURL(/\/admin\?decided=/);
  await expect(reviewerPage.getByText(`${trackingId}-এ সিদ্ধান্ত সংরক্ষিত হয়েছে।`)).toBeVisible();

  // --- Public
  const result = await search(reviewerPage, imei);
  expect(result.status).toBe("reported");
  expect(result.record).toMatchObject({ model, lastFour: imei.slice(-4), identifierType: "IMEI" });
  expect(JSON.stringify(result)).not.toContain(imei); // full number never leaves the server
  expect((await search(reviewerPage, imei2)).status).toBe("reported"); // dual-SIM: the second IMEI works too

  const anon = await (await browser.newContext()).newPage();
  await anon.goto("/");
  await expect(anon.getByText(`Samsung ${model}`)).toBeVisible();

  await reporterPage.goto("/dashboard");
  await expect(reporterPage.getByText("অনুমোদিত · প্রকাশিত")).toBeVisible();

  // Reporting the same IMEI from another account is blocked.
  const other = await (await browser.newContext()).newPage();
  await other.goto("/login?next=/report");
  await login(other, outsider);
  await other.getByLabel("পণ্যের ধরন").selectOption("মোবাইল ও ট্যাব");
  await other.getByLabel("ব্র্যান্ড").fill("Samsung");
  await other.getByLabel("মডেল").fill("Other");
  await other.getByLabel("IMEI নম্বর").fill(imei);
  await other.getByText("চুরি", { exact: true }).click();
  await other.getByLabel("তারিখ").fill("2026-11-02");
  await other.locator('input[name="location"]').fill("উত্তরা, ঢাকা");
  await other.getByLabel("সংক্ষেপে বিবরণ").fill("এটি একটি পরীক্ষামূলক ডুপ্লিকেট রিপোর্ট, যা আটকে যাওয়া উচিত।");
  await other.getByLabel(/আমি নিশ্চিত করছি/).check();
  await other.locator('input[name="evidence"]').setInputFiles({ name: "r.png", mimeType: "image/png", buffer: PNG });
  await other.getByRole("button", { name: "রিপোর্ট জমা দিন" }).click();
  await expect(other.getByText(/অন্য একজন ব্যবহারকারীর রিপোর্ট আগে থেকেই আছে/)).toBeVisible({ timeout: 30_000 });

  // --- Appeal: the outsider says they bought it legitimately.
  await other.goto("/dispute");
  await other.getByLabel(/যে নম্বরটি/).fill(imei2);
  await other.getByText("আমি পণ্যটি বৈধভাবে কিনেছি").click();
  await other.getByLabel("বিস্তারিত").fill("আমি ১০ নভেম্বর বসুন্ধরা সিটির একটি দোকান থেকে রসিদসহ ফোনটি কিনেছি।");
  await other.locator('input[name="evidence"]').setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: PNG });
  await other.getByLabel(/মিথ্যা আপত্তির/).check();
  await other.getByRole("button", { name: "আপত্তি জমা দিন" }).click();
  await expect(other.getByText("আপত্তি গ্রহণ করা হয়েছে")).toBeVisible({ timeout: 30_000 });
  expect((await search(other, imei)).status).toBe("reported"); // filing alone does not soften the alert

  // Reviewer marks it "under appeal" → the public sees the softer warning.
  await reviewerPage.goto("/admin");
  await reviewerPage.locator("li").filter({ hasText: trackingId }).getByRole("link", { name: "দেখুন →" }).click();
  await expect(reviewerPage).toHaveURL(/\/admin\/disputes\//);
  await expect(reviewerPage.getByText("আমি পণ্যটি বৈধভাবে কিনেছি")).toBeVisible();
  await reviewerPage.getByText("প্রাথমিকভাবে যুক্তিসঙ্গত").click();
  await reviewerPage.getByRole("button", { name: "সিদ্ধান্ত সংরক্ষণ করুন" }).click();
  await expect(reviewerPage).toHaveURL(/decided=APL-/);
  expect((await search(other, imei)).status).toBe("disputed");

  // ...then dismisses it with a reason → back to "reported"; both parties see the outcome.
  await reviewerPage.locator("li").filter({ hasText: trackingId }).getByRole("link", { name: "দেখুন →" }).click();
  await expect(reviewerPage).toHaveURL(/\/admin\/disputes\//);
  await reviewerPage.getByText("আপত্তি খারিজ", { exact: true }).click();
  await reviewerPage.getByRole("button", { name: "সিদ্ধান্ত সংরক্ষণ করুন" }).click();
  await expect(reviewerPage.getByText(/কারণ লিখুন/)).toBeVisible(); // a reason is mandatory
  await reviewerPage.getByText("আপত্তি খারিজ", { exact: true }).click();
  await reviewerPage.getByLabel(/^কারণ/).fill("রসিদের IMEI রিপোর্টের সাথে মেলে না; মালিকের জিডি বৈধ।");
  await reviewerPage.getByRole("button", { name: "সিদ্ধান্ত সংরক্ষণ করুন" }).click();
  await expect(reviewerPage).toHaveURL(/decided=APL-/);
  expect((await search(other, imei)).status).toBe("reported");
  await other.goto("/dashboard");
  await expect(other.getByText("খারিজ", { exact: true })).toBeVisible();
  await expect(other.getByText(/রসিদের IMEI রিপোর্টের সাথে মেলে না/)).toBeVisible();

  // --- Recovery: owner got the phone back → alert disappears for both IMEIs.
  await reporterPage.goto("/dashboard");
  await reporterPage.getByRole("button", { name: "পণ্যটি ফেরত পেয়েছি" }).click();
  await reporterPage.getByRole("button", { name: "হ্যাঁ, ফেরত পেয়েছি" }).click();
  await expect(reporterPage.getByText(/সতর্কতাটি সরিয়ে নেওয়া হয়েছে/)).toBeVisible();
  expect((await search(reporterPage, imei)).status).toBe("clear");
  expect((await search(reporterPage, imei2)).status).toBe("clear");
  await reporterPage.reload();
  await expect(reporterPage.getByText("ফেরত পাওয়া গেছে")).toBeVisible();
  await anon.goto("/");
  await expect(anon.getByText(`Samsung ${model}`)).toHaveCount(0);
});

test("moderation surface is closed to everyone but MFA-verified staff", async ({ browser, request }) => {
  const anon = await (await browser.newContext()).newPage();
  await anon.goto("/admin");
  await expect(anon).toHaveURL(/\/login\?next=%2Fadmin/);
  await anon.goto("/dashboard");
  await expect(anon).toHaveURL(/\/login\?next=%2Fdashboard/);

  expect((await request.get("/admin/documents/00000000-0000-4000-8000-000000000000")).status()).toBe(404);

  // A logged-in ordinary user gets a 404, not a hint that the console exists.
  const user = await (await browser.newContext()).newPage();
  await user.goto("/login");
  await login(user, `plain-${run}@e2e.test`);
  await expect(user).toHaveURL(/\/dashboard$/); // session cookie is set before we probe
  const res = await user.goto("/admin");
  expect(res?.status()).toBe(404);
  expect((await user.request.get("/admin/claims/00000000-0000-4000-8000-000000000000")).status()).toBe(404);
  await expect(user.getByRole("link", { name: "যাচাই কনসোল" })).toHaveCount(0);
});

test("INITIAL_ADMIN_EMAIL bootstraps exactly one admin, then goes inert", async ({ browser }) => {
  const postgres = (await import("postgres")).default;
  try { process.loadEnvFile(); } catch {}
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  try {
    await sql`delete from users where email = 'first-admin@e2e.test'`;
    await sql`delete from login_codes where email = 'first-admin@e2e.test'`; // fixed address: don't trip the per-email code limit across runs
    const [{ n }] = await sql`select count(*)::int as n from users where role = 'ADMIN'`;

    const page = await (await browser.newContext()).newPage();
    await page.goto("/login");
    await login(page, "first-admin@e2e.test");
    if (n === 0) {
      await expect(page).toHaveURL(/\/account\/mfa/); // admin, but MFA is still required before the console
      const [row] = await sql`select role from users where email = 'first-admin@e2e.test'`;
      expect(row.role).toBe("ADMIN");
    } else {
      await expect(page).toHaveURL(/\/dashboard$/);
      const [row] = await sql`select role from users where email = 'first-admin@e2e.test'`;
      expect(row.role).toBe("USER"); // an admin already exists: the setting does nothing
    }

    // A second, different email never becomes admin through this path.
    const other = await (await browser.newContext()).newPage();
    await other.goto("/login");
    await login(other, `not-admin-${run}@e2e.test`);
    await expect(other).toHaveURL(/\/dashboard$/);
    const [r2] = await sql`select role from users where email = ${`not-admin-${run}@e2e.test`}`;
    expect(r2.role).toBe("USER");
  } finally {
    await sql`update users set role = 'USER' where email = 'first-admin@e2e.test'`;
    await sql.end();
  }
});
