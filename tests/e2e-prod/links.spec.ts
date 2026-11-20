import { expect, test } from "@playwright/test";

const PAGES = ["/", "/login", "/privacy", "/terms", "/takedown"];

test("every link on every public page leads somewhere that works", async ({ page, request, baseURL }) => {
  const seen = new Map<string, string>();
  for (const path of PAGES) {
    await page.goto(path);
    const hrefs = await page.locator("a[href]").evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
    for (const href of hrefs) if (!seen.has(href)) seen.set(href, path);
  }
  const problems: string[] = [];
  for (const [href, from] of seen) {
    const url = new URL(href);
    if (url.protocol === "mailto:" || url.protocol === "tel:") continue;
    const internal = url.origin === new URL(baseURL!).origin;
    const res = await request.get(href, { maxRedirects: 0, failOnStatusCode: false, timeout: 20_000 }).catch((e) => e as Error);
    if (res instanceof Error) { problems.push(`${from} → ${href}: ${res.message}`); continue; }
    const status = res.status();
    const loc = res.headers()["location"] ?? "";
    const ok = status < 400 || (!internal && [401, 403, 405, 429].includes(status));
    if (!ok) problems.push(`${from} → ${href}: HTTP ${status}`);
    if (internal && status >= 300 && status < 400 && !/\/login\?next=/.test(loc)) problems.push(`${from} → ${href}: unexpected redirect to ${loc}`);
    // In-page anchors (/#faq) must point at an element that exists.
    if (internal && url.hash) {
      await page.goto(url.pathname);
      if (!(await page.locator(url.hash).count())) problems.push(`${from} → ${href}: no element ${url.hash}`);
    }
  }
  console.log(`checked ${seen.size} distinct links`);
  for (const [href] of seen) console.log("  ", href.replace(baseURL!, ""));
  expect(problems).toEqual([]);
});

test("every button on public pages responds", async ({ page }, info) => {
  await page.goto("/");
  // Mobile menu (only rendered as a toggle on small screens)
  if (info.project.name === "mobile") {
    await page.getByLabel("মেনু").click();
    await expect(page.getByRole("link", { name: "প্রশ্নোত্তর" }).last()).toBeVisible();
    await page.getByLabel("মেনু").click();
  }
  // Every FAQ item opens
  const summaries = page.locator("#faq summary");
  const n = await summaries.count();
  for (let i = 0; i < n; i++) {
    const item = page.locator("#faq details").nth(i);
    const wasOpen = await item.evaluate((d) => (d as HTMLDetailsElement).open);
    await summaries.nth(i).click();
    expect(await item.evaluate((d) => (d as HTMLDetailsElement).open), `FAQ ${i + 1}`).toBe(!wasOpen);
  }
  console.log(`FAQ items toggled: ${n}`);
  // Search button (one request only — the rate limit is shared with other tests)
  await page.getByPlaceholder("Serial / IMEI / VIN লিখুন").fill("AB1");
  await page.getByRole("button", { name: "রেজিস্ট্রি যাচাই" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "৪ থেকে ৬৪" })).toBeVisible(); // validated in the browser, no request
  // Report CTA buttons on the home page
  for (const name of [/আমার পণ্য রিপোর্ট করুন/, /রিপোর্ট শুরু করুন/]) {
    await page.goto("/");
    await page.getByRole("link", { name }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Freport/);
  }
  // Login page button
  await page.goto("/login");
  await page.getByRole("link", { name: "পণ্য যাচাই করুন" }).click();
  await expect(page).toHaveURL(/\/$/);
});
