import { expect, test } from "@playwright/test";
import { passwordAuth, resetRateLimits, setRole } from "./helpers";

test.beforeEach(resetRateLimits);
const run = `p${Date.now().toString(36)}`;

test("sign up, log out, wrong password, log in", async ({ page }) => {
  const email = `pw-${run}@e2e.test`;
  const password = "আমার-বাইক-লাল-২০২৬";
  await page.goto("/login?next=/report");
  await expect(page.getByRole("tab", { name: "লগইন" })).toHaveAttribute("aria-selected", "true");

  // Weak password and mismatch are explained
  await page.getByRole("tab", { name: "নতুন অ্যাকাউন্ট" }).click();
  await page.getByLabel("ইমেইল ঠিকানা").fill(email);
  await page.getByLabel("পাসওয়ার্ড", { exact: true }).fill("1234567890");
  await page.getByLabel("পাসওয়ার্ড আবার লিখুন").fill("1234567890");
  await page.getByRole("button", { name: "অ্যাকাউন্ট খুলুন" }).click();
  await expect(page.getByText("পাসওয়ার্ডটি খুব সহজ — অন্য কিছু দিন।")).toBeVisible();
  await page.getByLabel("পাসওয়ার্ড", { exact: true }).fill(password);
  await page.getByLabel("পাসওয়ার্ড আবার লিখুন").fill(password + "x");
  await page.getByRole("button", { name: "অ্যাকাউন্ট খুলুন" }).click();
  await expect(page.getByText("দুটি পাসওয়ার্ড মেলেনি।")).toBeVisible();

  // Show/hide toggle
  await page.getByRole("button", { name: "পাসওয়ার্ড দেখুন" }).click();
  await expect(page.getByLabel("পাসওয়ার্ড", { exact: true })).toHaveAttribute("type", "text");

  await passwordAuth(page, "signup", email, password);
  await expect(page).toHaveURL(/\/report$/); // honours ?next=
  await page.getByRole("button", { name: /লগআউট/ }).first().click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/login");
  await passwordAuth(page, "login", email, "ভুল-পাসওয়ার্ড-১২৩৪৫");
  await expect(page.getByText("ইমেইল বা পাসওয়ার্ড ভুল।")).toBeVisible();
  await passwordAuth(page, "login", email, password);
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("cannot sign up over an existing account or a staff account", async ({ page }) => {
  const email = `taken-${run}@e2e.test`;
  await page.goto("/login");
  await passwordAuth(page, "signup", email, "প্রথম-জনের-পাসওয়ার্ড-১");
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("button", { name: /লগআউট/ }).first().click();
  await expect(page).toHaveURL(/\/$/);

  // Someone else tries the same email → refused, switched to the login tab
  await page.goto("/login");
  await passwordAuth(page, "signup", email, "অন্য-জনের-পাসওয়ার্ড-২");
  await expect(page.getByText("এই ইমেইলে আগে থেকেই অ্যাকাউন্ট আছে। লগইন করুন।")).toBeVisible();
  await expect(page.getByRole("tab", { name: "লগইন" })).toHaveAttribute("aria-selected", "true");

  // A reviewer created from the CLI has no password; a public sign-up must not claim it
  const staff = `staff-${run}@e2e.test`;
  setRole(staff, "REVIEWER");
  await passwordAuth(page, "signup", staff, "দখল-করার-চেষ্টা-৩৩৩");
  await expect(page.getByText("এই ইমেইলে আগে থেকেই অ্যাকাউন্ট আছে। লগইন করুন।")).toBeVisible();
  await passwordAuth(page, "login", staff, "দখল-করার-চেষ্টা-৩৩৩");
  await expect(page.getByText("ইমেইল বা পাসওয়ার্ড ভুল।")).toBeVisible();
});

test("too many wrong passwords are slowed down", async ({ page }) => {
  const email = `brute-${run}@e2e.test`;
  await page.goto("/login");
  await passwordAuth(page, "signup", email, "সঠিক-পাসওয়ার্ড-৯৯৯");
  await page.getByRole("button", { name: /লগআউট/ }).first().click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/login");
  for (let i = 0; i < 10; i++) {
    await passwordAuth(page, "login", email, `ভুল-${i}-পাসওয়ার্ড`);
    await expect(page.getByText(/ইমেইল বা পাসওয়ার্ড ভুল।|অনেকবার ভুল চেষ্টা/)).toBeVisible();
  }
  await passwordAuth(page, "login", email, "সঠিক-পাসওয়ার্ড-৯৯৯");
  await expect(page.getByText(/অনেকবার ভুল চেষ্টা হয়েছে/)).toBeVisible(); // even the right password waits
});
