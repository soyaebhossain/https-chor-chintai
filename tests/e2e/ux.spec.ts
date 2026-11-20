import { expect, test } from "@playwright/test";
import { fillReport, imeiBody, makeImei, passwordAuth, resetRateLimits } from "./helpers";

test.beforeEach(resetRateLimits);
const run = `u${Date.now().toString(36)}`;

test("report form refuses a SIM number; owner sees own pending report in search, others don't", async ({ browser }) => {
  const owner = await (await browser.newContext()).newPage();
  await owner.goto("/login?next=/report");
  await passwordAuth(owner, "signup", `owner-${run}@e2e.test`, "মালিকের-পাসওয়ার্ড-১২৩");
  await expect(owner).toHaveURL(/\/report$/);

  // A mobile (SIM) number typed as the IMEI is explained, not stored
  await owner.getByLabel("পণ্যের ধরন").selectOption("মোবাইল ও ট্যাব");
  await owner.getByLabel("IMEI নম্বর").fill("01716573526");
  await owner.getByRole("button", { name: "রিপোর্ট জমা দিন" }).click();
  await expect(owner.getByText(/এটি মোবাইল \(সিম\) নম্বর, IMEI নয়/)).toBeVisible();

  // 14-digit IMEI (check digit left off) is accepted and stored as the full IMEI
  const full = makeImei();
  await owner.goto("/report");
  await fillReport(owner, { model: `PEND-${run}`, imei: imeiBody(full) });

  // The owner searching it sees "your report is under review"
  await owner.goto("/");
  await owner.getByPlaceholder("Serial / IMEI / VIN লিখুন").fill(full);
  await owner.getByRole("button", { name: "রেজিস্ট্রি যাচাই" }).click();
  await expect(owner.getByText("আপনার রিপোর্টটি যাচাইয়ের অপেক্ষায়")).toBeVisible();
  await expect(owner.getByText("এই বার্তাটি শুধু আপনি দেখছেন")).toBeVisible();

  // Anyone else still sees nothing until a reviewer approves it
  const stranger = await (await browser.newContext()).newPage();
  await stranger.goto("/");
  await stranger.getByPlaceholder("Serial / IMEI / VIN লিখুন").fill(full);
  await stranger.getByRole("button", { name: "রেজিস্ট্রি যাচাই" }).click();
  await expect(stranger.getByText("বর্তমানে কোনো রিপোর্ট পাওয়া যায়নি")).toBeVisible();
  await expect(stranger.getByText("আপনার রিপোর্টটি যাচাইয়ের অপেক্ষায়")).toHaveCount(0);

  // Searching a SIM number warns instead of saying "no record"
  await stranger.getByPlaceholder("Serial / IMEI / VIN লিখুন").fill("01716573526");
  await stranger.getByRole("button", { name: "রেজিস্ট্রি যাচাই" }).click();
  await expect(stranger.getByText(/এটি মোবাইল \(সিম\) নম্বর, IMEI নয়/)).toBeVisible();

  // A number plate in Bengali gets a clear explanation
  await stranger.getByPlaceholder("Serial / IMEI / VIN লিখুন").fill("ঢাকা মেট্রো-ল ১২-৩৪৫৬");
  await stranger.getByRole("button", { name: "রেজিস্ট্রি যাচাই" }).click();
  await expect(stranger.getByText(/গাড়ির নম্বর প্লেট দিয়ে খোঁজা যায় না/)).toBeVisible();
});

test("sign-up suggests a fix for a mistyped email domain", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("tab", { name: "নতুন অ্যাকাউন্ট" }).click();
  await page.getByLabel("ইমেইল ঠিকানা").fill(`karim-${run}@gmial.com`);
  await page.getByLabel("পাসওয়ার্ড", { exact: true }).click(); // blur
  await expect(page.getByText(`karim-${run}@gmail.com`)).toBeVisible();
  await page.getByRole("button", { name: "হ্যাঁ, ঠিক করুন" }).click();
  await expect(page.getByLabel("ইমেইল ঠিকানা")).toHaveValue(`karim-${run}@gmail.com`);
});
