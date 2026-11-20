import { expect, test, type Browser, type Page } from "@playwright/test";
import { fillReport, freshTotp, login, makeImei, PNG, readCode, requestCode, resetRateLimits, search, setRole } from "./helpers";

test.beforeEach(resetRateLimits);

const run = `b${Date.now().toString(36)}`;
const newPage = async (browser: Browser) => (await browser.newContext()).newPage();

test("account buttons: resend code, empty dashboard, logout", async ({ browser }) => {
  const page = await newPage(browser);
  const email = `acct-${run}@e2e.test`;
  await page.goto("/login");
  const first = await requestCode(page, email);

  // "নতুন কোড পাঠান" issues a new code and invalidates the old one.
  await page.getByRole("button", { name: "নতুন কোড পাঠান" }).click();
  await expect.poll(async () => readCode(email), { timeout: 15_000 }).not.toBe(first);
  const second = await readCode(email);
  await page.getByLabel("লগইন কোড").fill(first);
  await page.getByRole("button", { name: "লগইন করুন" }).click();
  await expect(page.getByText(/কোডটি ভুল বা মেয়াদোত্তীর্ণ/)).toBeVisible();
  await page.getByLabel("লগইন কোড").fill(second);
  await page.getByRole("button", { name: "লগইন করুন" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // Empty dashboard → "রিপোর্ট করুন"
  await page.getByRole("main").getByRole("link", { name: /রিপোর্ট করুন/ }).last().click();
  await expect(page).toHaveURL(/\/report$/);

  // Header email link and "লগআউট"
  await page.getByRole("link", { name: email }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("button", { name: /লগআউট/ }).first().click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/); // session really ended
});

test("review buttons: needs-info → answer → reject → re-report; appeal upheld; recovery cancel; MFA on re-login", async ({ browser }) => {
  test.setTimeout(180_000);
  const reporterEmail = `rep-${run}@e2e.test`;
  const reviewerEmail = `rev-${run}@e2e.test`;
  const outsiderEmail = `out-${run}@e2e.test`;

  // Reporter files report #1
  const reporter = await newPage(browser);
  await reporter.goto("/login?next=/report");
  await login(reporter, reporterEmail);
  const imei1 = makeImei();
  const t1 = await fillReport(reporter, { model: `NI-${run}`, imei: imei1 });
  await reporter.getByRole("link", { name: "আমার রিপোর্ট দেখুন" }).click();
  await expect(reporter).toHaveURL(/\/dashboard$/);

  // Reviewer enrols MFA
  setRole(reviewerEmail, "REVIEWER");
  const reviewer = await newPage(browser);
  await reviewer.goto("/admin");
  await login(reviewer, reviewerEmail);
  await expect(reviewer).toHaveURL(/\/account\/mfa/);
  await reviewer.getByText("QR স্ক্যান করা যাচ্ছে না?").click();
  const secret = (await reviewer.locator("details p.font-mono").textContent())!;
  let totp = await freshTotp(secret);
  await reviewer.getByLabel(/Authenticator অ্যাপের/).fill(totp.code);
  await reviewer.getByRole("button", { name: "চালু করুন" }).click();
  await expect(reviewer).toHaveURL(/\/admin$/);

  const openClaim = async (page: Page, trackingId: string) => {
    await page.goto("/admin");
    await page.getByRole("row").filter({ hasText: trackingId }).getByRole("link", { name: /পর্যালোচনা/ }).click();
  };
  const decide = async (page: Page, label: string, note?: string) => {
    await page.getByLabel(label, { exact: true }).check();
    if (note !== undefined) await page.getByLabel(/রিপোর্টকারীর জন্য মন্তব্য/).fill(note);
    await page.getByRole("button", { name: "সিদ্ধান্ত সংরক্ষণ করুন" }).click();
  };

  // "আরও তথ্য চাই" without a note is refused, with a note it goes through
  await openClaim(reviewer, t1);
  await decide(reviewer, "আরও তথ্য চাই");
  await expect(reviewer.getByRole("alert").filter({ hasText: "কারণ লিখুন" })).toBeVisible();
  await decide(reviewer, "আরও তথ্য চাই", "বক্সের ছবি দিন যেখানে IMEI দেখা যায়।");
  await expect(reviewer).toHaveURL(/decided=CLM-/);

  // Reporter sees the request and answers with "তথ্য পাঠান"
  await reporter.goto("/dashboard");
  await expect(reporter.getByText("আপনার উত্তর প্রয়োজন")).toBeVisible();
  await expect(reporter.getByText("বক্সের ছবি দিন যেখানে IMEI দেখা যায়।")).toBeVisible();
  await reporter.getByLabel("যাচাইকারীর জন্য উত্তর").fill("বক্সের ছবি যুক্ত করলাম।");
  await reporter.locator('form input[name="evidence"]').setInputFiles({ name: "box.png", mimeType: "image/png", buffer: PNG });
  await reporter.getByRole("button", { name: "তথ্য পাঠান" }).click();
  // The dashboard refreshes: the card leaves "needs info" and is back in the review queue.
  const card1 = reporter.locator("article").filter({ hasText: t1 });
  await expect(card1.getByText("যাচাই চলছে")).toBeVisible();
  await expect(card1.getByText("আপনার উত্তর প্রয়োজন")).toHaveCount(0);

  // Reviewer sees the answer + both files, opens a file, then rejects
  await openClaim(reviewer, t1);
  await expect(reviewer.getByText("বক্সের ছবি যুক্ত করলাম।")).toBeVisible();
  await expect(reviewer.getByRole("link", { name: /ফাইল ২/ })).toBeVisible();
  const [file] = await Promise.all([reviewer.waitForEvent("popup"), reviewer.getByRole("link", { name: /ফাইল ১/ }).click()]);
  await file.waitForLoadState();
  expect(await file.evaluate(() => document.contentType)).toBe("image/png");
  await file.close();
  await decide(reviewer, "প্রত্যাখ্যান", "রসিদের নাম ও অ্যাকাউন্টের নাম মেলে না।");
  await expect(reviewer).toHaveURL(/decided=CLM-/);

  // Reporter: rejected, reason shown, "নতুন করে রিপোর্ট" works
  await reporter.goto("/dashboard");
  await expect(reporter.getByText("প্রত্যাখ্যাত")).toBeVisible();
  await expect(reporter.getByText("রসিদের নাম ও অ্যাকাউন্টের নাম মেলে না।")).toBeVisible();
  await reporter.getByRole("link", { name: "নতুন করে রিপোর্ট" }).click();
  await expect(reporter).toHaveURL(/\/report$/);
  expect(await search(reporter, imei1)).toBe("own"); // reporter sees their rejected report
  expect(await search(await newPage(browser), imei1)).toBe("clear"); // the public sees nothing

  // Report #2 approved → outsider appeals → reviewer upholds → alert removed
  const imei2 = makeImei();
  const t2 = await fillReport(reporter, { model: `UP-${run}`, imei: imei2 });
  await openClaim(reviewer, t2);
  await decide(reviewer, "অনুমোদন ও প্রকাশ");
  await expect(reviewer).toHaveURL(/decided=CLM-/);
  expect(await search(reporter, imei2)).toBe("reported");

  const outsider = await newPage(browser);
  await outsider.goto("/login?next=/dispute");
  await login(outsider, outsiderEmail);
  await outsider.getByLabel(/যে নম্বরটি/).fill(imei2);
  await outsider.getByText("এটি আমার নিজের পণ্য, চুরি হয়নি").click();
  await outsider.getByLabel("বিস্তারিত").fill("ফোনটি আমার নামে কেনা, রসিদ ও বক্স আমার কাছে আছে, কখনো চুরি হয়নি।");
  await outsider.getByLabel(/মিথ্যা আপত্তির/).check();
  await outsider.getByRole("button", { name: "আপত্তি জমা দিন" }).click();
  await expect(outsider.getByText("আপত্তি গ্রহণ করা হয়েছে")).toBeVisible({ timeout: 30_000 });
  await outsider.getByRole("link", { name: "ড্যাশবোর্ডে অবস্থা দেখুন" }).click();
  await expect(outsider.getByText("জমা হয়েছে")).toBeVisible();

  await reviewer.goto("/admin");
  await reviewer.locator("li").filter({ hasText: t2 }).getByRole("link", { name: "দেখুন →" }).click();
  await expect(reviewer).toHaveURL(/\/admin\/disputes\//);
  const disputeUrl = reviewer.url();
  await reviewer.getByRole("link", { name: /রিপোর্টকারীর প্রমাণ ও পুরো ইতিহাস/ }).click(); // link to the claim
  await expect(reviewer).toHaveURL(/\/admin\/claims\//);
  await expect(reviewer.getByRole("link", { name: /APL-/ })).toBeVisible(); // the claim links back to its appeal
  await reviewer.goto(disputeUrl);
  await reviewer.getByText("আপত্তি সঠিক — রিপোর্ট সরান").click();
  await reviewer.getByLabel(/^কারণ/).fill("আপত্তিকারীর রসিদ ও বক্স যাচাই করা হয়েছে, রিপোর্টটি ভুল ছিল।");
  await reviewer.getByRole("button", { name: "সিদ্ধান্ত সংরক্ষণ করুন" }).click();
  await expect(reviewer).toHaveURL(/decided=APL-/);
  expect(await search(await newPage(browser), imei2)).toBe("clear"); // removed from public search
  expect(await search(reporter, imei2)).toBe("own"); // the reporter still sees it as rejected
  await outsider.reload();
  await expect(outsider.getByText("গৃহীত — রিপোর্ট সরানো হয়েছে")).toBeVisible();

  // Report #3 approved → "ফেরত পেয়েছি" then "বাতিল" keeps the alert live
  const imei3 = makeImei();
  await reporter.goto("/report");
  const t3 = await fillReport(reporter, { model: `RC-${run}`, imei: imei3 });
  await openClaim(reviewer, t3);
  await decide(reviewer, "অনুমোদন ও প্রকাশ");
  await expect(reviewer).toHaveURL(/decided=CLM-/);
  await reporter.goto("/dashboard");
  const card = reporter.locator("article").filter({ hasText: t3 });
  await card.getByRole("button", { name: "পণ্যটি ফেরত পেয়েছি" }).click();
  await expect(card.getByRole("button", { name: "হ্যাঁ, ফেরত পেয়েছি" })).toBeVisible();
  await card.getByRole("button", { name: "বাতিল" }).click();
  await expect(card.getByRole("button", { name: "পণ্যটি ফেরত পেয়েছি" })).toBeVisible();
  expect(await search(reporter, imei3)).toBe("reported");

  // Reviewer logs out and back in: MFA "যাচাই করুন" (already enrolled) opens the console
  await reviewer.getByRole("button", { name: /লগআউট/ }).first().click();
  await expect(reviewer).toHaveURL(/\/$/);
  await reviewer.goto("/admin");
  await login(reviewer, reviewerEmail);
  await expect(reviewer).toHaveURL(/\/account\/mfa/);
  totp = await freshTotp(secret, totp.step);
  await reviewer.getByLabel(/Authenticator অ্যাপের/).fill(totp.code);
  await reviewer.getByRole("button", { name: "যাচাই করুন" }).click();
  await expect(reviewer).toHaveURL(/\/admin$/);
});
