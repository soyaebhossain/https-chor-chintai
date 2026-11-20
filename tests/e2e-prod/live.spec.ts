import { expect, test } from "@playwright/test";
const shot = (name: string) => `test-results/prod/${name}.png`;

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/status of 422/.test(m.text())) errors.push(m.text()); });
  (page as unknown as { _errors: string[] })._errors = errors;
});
test.afterEach(async ({ page }) => {
  expect((page as unknown as { _errors: string[] })._errors, "browser console errors").toEqual([]);
});

test("home page renders with real stats and no demo content", async ({ page }, info) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("কেনার আগে নম্বরটি");
  await expect(page.getByText("যাচাইকৃত সক্রিয় রিপোর্ট")).toBeVisible();
  await expect(page.getByText(/ডেমো|MVP|Demo record/)).toHaveCount(0);
  await page.screenshot({ path: shot("home-" + info.project.name), fullPage: true });
});

test("search: clear, typo, Bengali digits", async ({ page }, info) => {
  await page.goto("/");
  const box = page.getByPlaceholder("Serial / IMEI / VIN লিখুন");
  await box.fill("490154203237518");
  await page.getByRole("button", { name: "রেজিস্ট্রি যাচাই" }).click();
  await expect(page.getByText("বর্তমানে কোনো রিপোর্ট পাওয়া যায়নি")).toBeVisible();
  await page.screenshot({ path: shot("search-clear-" + info.project.name) });
  await box.fill("490154203237519");
  await page.getByRole("button", { name: "রেজিস্ট্রি যাচাই" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "IMEI" })).toContainText("IMEI নম্বরটি সঠিক নয়");
  await page.screenshot({ path: shot("search-typo-" + info.project.name) });
  await box.fill("৪৯০১৫৪২০৩২৩৭৫১৮");
  await page.getByRole("button", { name: "রেজিস্ট্রি যাচাই" }).click();
  await expect(page.getByText("বর্তমানে কোনো রিপোর্ট পাওয়া যায়নি")).toBeVisible();
});

test("FAQ opens and closes", async ({ page }) => {
  await page.goto("/");
  const q = page.getByText("হারানো পণ্য ফেরত পেলে কী করব?");
  await q.scrollIntoViewIfNeeded();
  await q.click();
  await expect(page.getByText(/পণ্যটি ফেরত পেয়েছি/).first()).toBeVisible();
});

test("navigation: header links, footer links, report button", async ({ page }, info) => {
  await page.goto("/");
  if (info.project.name === "mobile") {
    await page.getByLabel("মেনু").click();
    await expect(page.getByRole("link", { name: "রিপোর্ট করুন" }).last()).toBeVisible();
    await page.screenshot({ path: shot("menu-mobile") });
    await page.getByRole("link", { name: "লগইন" }).last().click();
  } else {
    await page.getByRole("link", { name: /^লগইন/ }).first().click();
  }
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText("লগইন শিগগিরই চালু হবে")).toBeVisible();
  await page.screenshot({ path: shot("login-" + info.project.name) });

  await page.goto("/");
  await page.getByRole("link", { name: /আমার পণ্য রিপোর্ট করুন/ }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Freport/);
});

for (const path of ["/privacy", "/terms", "/takedown"]) {
  test("legal page " + path, async ({ page }, info) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.screenshot({ path: shot(path.slice(1) + "-" + info.project.name), fullPage: true });
  });
}

test("no horizontal scroll", async ({ page }) => {
  for (const path of ["/", "/login", "/privacy", "/terms", "/takedown"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
});
