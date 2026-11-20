import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { ShieldCheck } from "lucide-react";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import MfaForm from "@/components/mfa-form";
import { Title } from "@/components/page-bits";
import PageFrame from "@/components/page-frame";
import { safeNextPath } from "@/lib/safe-path";
import { isStaff, requireUser } from "@/lib/server/auth";
import { decryptField, encryptField } from "@/lib/server/crypto";
import { getEnv } from "@/lib/server/env";
import { generateTotpSecret, otpauthUri } from "@/lib/server/totp";

export const metadata: Metadata = { title: "দুই-ধাপ যাচাই — চোর ছিনতাই", robots: { index: false } };

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const session = await requireUser("/account/mfa");
  const next = safeNextPath((await searchParams).next, isStaff(session.user.role) ? "/admin" : "/dashboard");
  const card = "rounded-[2rem] border border-emerald-950/10 bg-white p-6 shadow-xl shadow-emerald-950/5 md:p-8";

  if (session.user.mfaEnabled && session.mfaVerified) {
    return <PageFrame><section className="mx-auto max-w-md"><Title eyebrow="নিরাপত্তা" title="দুই-ধাপ যাচাই চালু আছে" />
      <div className={`${card} text-center`}><ShieldCheck className="mx-auto size-12 text-emerald-600" /><p className="mt-3 text-slate-600">এই সেশনটি যাচাই করা হয়েছে।</p><Link href={next} className="mt-6 inline-block rounded-xl bg-emerald-900 px-5 py-3 text-sm font-bold text-white">এগিয়ে যান</Link></div>
    </section></PageFrame>;
  }

  if (session.user.mfaEnabled) {
    return <PageFrame><section className="mx-auto max-w-md">
      <Title eyebrow="নিরাপত্তা" title="দুই-ধাপ যাচাই" text="যাচাই কনসোলে ঢুকতে Authenticator অ্যাপের কোড দিন।" />
      <div className={card}><MfaForm next={next} label="যাচাই করুন" /></div>
    </section></PageFrame>;
  }

  // Enrollment: create (or reuse) a pending secret. It only becomes active once a valid code is entered.
  const env = getEnv();
  const db = getDb();
  const [row] = await db.select({ secret: users.mfaSecretEncrypted }).from(users).where(eq(users.id, session.user.id));
  let secret: string;
  if (row?.secret) {
    secret = decryptField(env.FIELD_ENCRYPTION_KEY, row.secret);
  } else {
    secret = generateTotpSecret();
    await db.update(users).set({ mfaSecretEncrypted: encryptField(env.FIELD_ENCRYPTION_KEY, secret) }).where(eq(users.id, session.user.id));
  }
  const uri = otpauthUri(secret, session.user.email ?? session.user.id);
  const qrSvg = await QRCode.toString(uri, { type: "svg", margin: 1, errorCorrectionLevel: "M" });

  return <PageFrame><section className="mx-auto max-w-lg">
    <Title eyebrow="নিরাপত্তা" title="দুই-ধাপ যাচাই চালু করুন" text={isStaff(session.user.role) ? "যাচাইকারী ও অ্যাডমিনদের জন্য এটি বাধ্যতামূলক।" : "আপনার অ্যাকাউন্টকে আরও সুরক্ষিত করুন।"} />
    <div className={`${card} grid gap-6`}>
      <ol className="grid gap-2 text-sm leading-6 text-slate-600"><li>১. Google Authenticator, Microsoft Authenticator বা 1Password খুলুন।</li><li>২. নিচের QR কোডটি স্ক্যান করুন।</li><li>৩. অ্যাপে দেখানো ৬ অঙ্কের কোডটি লিখুন।</li></ol>
      <div className="mx-auto w-52 rounded-2xl border border-slate-200 bg-white p-3" role="img" aria-label="Authenticator QR কোড" dangerouslySetInnerHTML={{ __html: qrSvg }} />
      <details className="text-xs text-slate-500"><summary className="cursor-pointer font-bold">QR স্ক্যান করা যাচ্ছে না?</summary><p className="mt-2 break-all font-mono text-sm text-emerald-950">{secret.match(/.{1,4}/g)?.join(" ")}</p></details>
      <MfaForm next={next} label="চালু করুন" />
    </div>
  </section></PageFrame>;
}
