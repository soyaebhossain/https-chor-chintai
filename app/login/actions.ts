"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { safeNextPath } from "@/lib/safe-path";
import { createSession, isStaff } from "@/lib/server/auth";
import { consumeLoginCode, issueLoginCode, recentCodeCount } from "@/lib/server/login-codes";
import { sendMail } from "@/lib/server/mailer";
import { clientIp, formatRetry, rateLimit } from "@/lib/server/rate-limit";
import { TURNSTILE_ERROR, TURNSTILE_FIELD, verifyTurnstile } from "@/lib/server/turnstile";

export type LoginState = { step: "email" | "code"; email?: string; error?: string };

const Email = z.string().trim().toLowerCase().email().max(254);

export async function loginAction(prev: LoginState, form: FormData): Promise<LoginState> {
  const ip = clientIp(await headers());
  const intent = form.get("intent");
  const parsedEmail = Email.safeParse(form.get("email"));
  if (!parsedEmail.success) return { step: "email", error: "একটি সঠিক ইমেইল ঠিকানা লিখুন।" };
  const email = parsedEmail.data;

  if (intent === "send") {
    const ipLimit = await rateLimit("login-send-ip", ip, 10, 3600);
    if (!ipLimit.ok) return { step: "email", email, error: `অনেকবার চেষ্টা হয়েছে। ${formatRetry(ipLimit.retryAfterSeconds)} পর আবার চেষ্টা করুন।` };
    if (!(await verifyTurnstile(form.get(TURNSTILE_FIELD), ip))) return { step: prev.step, email, error: TURNSTILE_ERROR };
    if ((await recentCodeCount(email)) >= 5) return { step: "email", email, error: "এই ইমেইলে গত এক ঘণ্টায় অনেকগুলো কোড পাঠানো হয়েছে। একটু পরে চেষ্টা করুন।" };

    const code = await issueLoginCode(email);
    try {
      await sendMail({
        to: email,
        subject: `${code} — চোর ছিনতাই লগইন কোড`,
        text: `আপনার লগইন কোড: ${code}\n\nকোডটি ১০ মিনিট কার্যকর থাকবে। আপনি অনুরোধ না করে থাকলে এই ইমেইল উপেক্ষা করুন।\nকেউ ফোন বা মেসেজে এই কোড চাইলে দেবেন না।\n\n— চোর ছিনতাই`,
      });
    } catch (error) {
      console.error("login code delivery failed:", error instanceof Error ? error.message : error);
      return { step: "email", email, error: "ইমেইল পাঠানো যায়নি। কিছুক্ষণ পর আবার চেষ্টা করুন।" };
    }
    return { step: "code", email };
  }

  if (intent === "verify") {
    const ipLimit = await rateLimit("login-verify-ip", ip, 30, 900);
    if (!ipLimit.ok) return { step: "code", email, error: `অনেকবার ভুল চেষ্টা হয়েছে। ${formatRetry(ipLimit.retryAfterSeconds)} পর আবার চেষ্টা করুন।` };
    const code = String(form.get("code") ?? "").replace(/\s/g, "");
    if (!(await consumeLoginCode(email, code))) {
      return { step: "code", email, error: "কোডটি ভুল বা মেয়াদোত্তীর্ণ। নতুন কোড চাইতে পারেন।" };
    }

    const db = getDb();
    await db.insert(users).values({ email }).onConflictDoNothing({ target: users.email });
    const [user] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.email, email));
    await createSession(user.id, user.role);
    await db.insert(auditLogs).values({ actorId: user.id, action: "LOGIN", entityType: "user", entityId: user.id });

    const next = safeNextPath(form.get("next"), isStaff(user.role) ? "/admin" : "/dashboard");
    redirect(next);
  }

  return prev;
}

