"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { safeNextPath } from "@/lib/safe-path";
import { getSession, isStaff, markSessionMfaVerified } from "@/lib/server/auth";
import { decryptField } from "@/lib/server/crypto";
import { getEnv } from "@/lib/server/env";
import { formatRetry, rateLimit } from "@/lib/server/rate-limit";
import { verifyTotp } from "@/lib/server/totp";

export type MfaState = { error?: string };

export async function verifyMfaAction(_prev: MfaState, form: FormData): Promise<MfaState> {
  const session = await getSession();
  if (!session) redirect("/login?next=/account/mfa");

  const limit = await rateLimit("mfa-verify", session.user.id, 10, 900);
  if (!limit.ok) return { error: `অনেকবার ভুল কোড দেওয়া হয়েছে। ${formatRetry(limit.retryAfterSeconds)} পর আবার চেষ্টা করুন।` };

  const db = getDb();
  const [user] = await db
    .select({ secret: users.mfaSecretEncrypted, enabledAt: users.mfaEnabledAt, lastStep: users.mfaLastStep, role: users.role })
    .from(users)
    .where(eq(users.id, session.user.id));
  if (!user?.secret) return { error: "প্রথমে পাতা রিফ্রেশ করে QR কোডটি স্ক্যান করুন।" };

  const code = String(form.get("code") ?? "").replace(/\s/g, "");
  const step = verifyTotp(decryptField(getEnv().FIELD_ENCRYPTION_KEY, user.secret), code, { lastStep: user.lastStep });
  if (step === null) return { error: "কোডটি সঠিক নয়। অ্যাপে দেখানো সর্বশেষ ৬ অঙ্কের কোড দিন।" };

  const enrolling = user.enabledAt === null;
  await db.transaction(async (tx) => {
    await tx.update(users).set({ mfaLastStep: step, ...(enrolling ? { mfaEnabledAt: new Date() } : {}) }).where(eq(users.id, session.user.id));
    await tx.insert(auditLogs).values({ actorId: session.user.id, action: enrolling ? "MFA_ENROLLED" : "MFA_VERIFIED", entityType: "user", entityId: session.user.id });
  });
  await markSessionMfaVerified(session.id);
  redirect(safeNextPath(form.get("next"), isStaff(user.role) ? "/admin" : "/dashboard"));
}
