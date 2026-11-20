"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { safeNextPath } from "@/lib/safe-path";
import { bootstrapFirstAdmin, createSession, isStaff } from "@/lib/server/auth";
import { burnPasswordCheck, hashPassword, passwordProblem, PASSWORD_MAX, verifyPassword } from "@/lib/server/password";
import { clientIp, formatRetry, rateLimit } from "@/lib/server/rate-limit";
import { TURNSTILE_ERROR, TURNSTILE_FIELD, verifyTurnstile } from "@/lib/server/turnstile";

export type PasswordState = { mode: "login" | "signup"; email?: string; error?: string };

const Email = z.string().trim().toLowerCase().email().max(254);
const WRONG = "ইমেইল বা পাসওয়ার্ড ভুল।";

export async function passwordAuthAction(prev: PasswordState, form: FormData): Promise<PasswordState> {
  const mode = form.get("mode") === "signup" ? "signup" : "login";
  const ip = clientIp(await headers());
  const parsed = Email.safeParse(form.get("email"));
  if (!parsed.success) return { mode, error: "একটি সঠিক ইমেইল ঠিকানা লিখুন।" };
  const email = parsed.data;
  const password = String(form.get("password") ?? "").slice(0, PASSWORD_MAX + 1);
  const db = getDb();

  if (mode === "signup") {
    const limit = await rateLimit("signup-ip", ip, 5, 3600);
    if (!limit.ok) return { mode, email, error: `অনেকগুলো অ্যাকাউন্ট খোলার চেষ্টা হয়েছে। ${formatRetry(limit.retryAfterSeconds)} পর আবার চেষ্টা করুন।` };
    if (!(await verifyTurnstile(form.get(TURNSTILE_FIELD), ip))) return { mode, email, error: TURNSTILE_ERROR };
    const problem = passwordProblem(password, email);
    if (problem) return { mode, email, error: problem };
    if (password !== String(form.get("confirm") ?? "")) return { mode, email, error: "দুটি পাসওয়ার্ড মেলেনি।" };

    const [existing] = await db
      .select({ id: users.id, role: users.role, passwordHash: users.passwordHash, lastLoginAt: users.lastLoginAt })
      .from(users)
      .where(eq(users.email, email));
    // Email ownership is not verified (no mail service yet), so never let a sign-up take over an account
    // someone already uses, and never hand a password to a reviewer/admin account created from the CLI.
    if (existing && (existing.passwordHash || existing.lastLoginAt || existing.role !== "USER")) {
      return { mode: "login", email, error: "এই ইমেইলে আগে থেকেই অ্যাকাউন্ট আছে। লগইন করুন।" };
    }
    const passwordHash = await hashPassword(password);
    let user: { id: string; role: "USER" | "REVIEWER" | "ADMIN" };
    if (existing) {
      await db.update(users).set({ passwordHash }).where(eq(users.id, existing.id));
      user = { id: existing.id, role: existing.role };
    } else {
      const inserted = await db.insert(users).values({ email, passwordHash }).onConflictDoNothing({ target: users.email }).returning({ id: users.id, role: users.role });
      if (!inserted[0]) return { mode: "login", email, error: "এই ইমেইলে আগে থেকেই অ্যাকাউন্ট আছে। লগইন করুন।" };
      user = inserted[0];
    }
    user = await bootstrapFirstAdmin(user, email);
    await db.insert(auditLogs).values({ actorId: user.id, action: "SIGNUP", entityType: "user", entityId: user.id, metadata: { method: "password" } });
    await createSession(user.id, user.role);
    redirect(safeNextPath(form.get("next"), isStaff(user.role) ? "/admin" : "/dashboard"));
  }

  // Login
  const ipLimit = await rateLimit("password-login-ip", ip, 20, 900);
  const emailLimit = await rateLimit("password-login-email", email, 10, 900);
  const blocked = !ipLimit.ok ? ipLimit : !emailLimit.ok ? emailLimit : null;
  if (blocked) return { mode, email, error: `অনেকবার ভুল চেষ্টা হয়েছে। ${formatRetry(blocked.retryAfterSeconds)} পর আবার চেষ্টা করুন।` };
  if (!(await verifyTurnstile(form.get(TURNSTILE_FIELD), ip))) return { mode, email, error: TURNSTILE_ERROR };

  const [row] = await db.select({ id: users.id, role: users.role, passwordHash: users.passwordHash }).from(users).where(eq(users.email, email));
  const ok = row?.passwordHash ? await verifyPassword(password, row.passwordHash) : await burnPasswordCheck(password);
  if (!row || !ok) return { mode, email, error: WRONG };

  const user = await bootstrapFirstAdmin({ id: row.id, role: row.role }, email);
  await createSession(user.id, user.role);
  await db.insert(auditLogs).values({ actorId: user.id, action: "LOGIN", entityType: "user", entityId: user.id, metadata: { method: "password" } });
  redirect(safeNextPath(form.get("next"), isStaff(user.role) ? "/admin" : "/dashboard"));
}
