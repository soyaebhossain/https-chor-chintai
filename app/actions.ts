"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { safeEqual } from "@/lib/crypto";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import {
  createReport,
  decideReport,
  linkReportToReporter,
  markRecovered,
  searchRegistry,
  type EvidenceFile,
  type SearchResult,
} from "@/lib/reports";
import { clientIp, currentReporterId, endAdminSession, ensureReporterId, isAdmin, startAdminSession } from "@/lib/session";
import { MAX_FILE_BYTES, MAX_FILES, MAX_TOTAL_BYTES, reportInput, sniffMime } from "@/lib/validation";

const TOO_MANY = "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।";

export async function searchAction(_prev: SearchResult | null, form: FormData): Promise<SearchResult> {
  if (!rateLimit(`search:${await clientIp()}`, 30, 60_000)) return { status: "invalid", error: TOO_MANY };
  return searchRegistry(await getDb(), String(form.get("q") ?? ""));
}

export type ReportState =
  | { ok: true; trackingId: string }
  | { ok: false; error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> }
  | null;

export async function submitReportAction(_prev: ReportState, form: FormData): Promise<ReportState> {
  const values = Object.fromEntries(
    [...form.entries()].filter(([, v]) => typeof v === "string").map(([k, v]) => [k, v as string]),
  );
  if (!rateLimit(`report:${await clientIp()}`, 5, 60 * 60_000)) return { ok: false, error: TOO_MANY, values };

  const parsed = reportInput.safeParse(values);
  const fieldErrors: Record<string, string> = {};
  if (!parsed.success) for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;

  const uploads = form.getAll("evidence").filter((f): f is File => f instanceof File && f.size > 0);
  const files: EvidenceFile[] = [];
  if (uploads.length > MAX_FILES) fieldErrors.evidence = `সর্বোচ্চ ${MAX_FILES}টি ফাইল দেওয়া যাবে।`;
  else if (uploads.reduce((n, f) => n + f.size, 0) > MAX_TOTAL_BYTES) fieldErrors.evidence = "সব ফাইল মিলিয়ে সর্বোচ্চ 10MB।";
  else {
    for (const file of uploads) {
      if (file.size > MAX_FILE_BYTES) {
        fieldErrors.evidence = `"${file.name}" 5MB-এর বেশি।`;
        break;
      }
      const data = Buffer.from(await file.arrayBuffer());
      const mimeType = sniffMime(data);
      if (!mimeType) {
        fieldErrors.evidence = `"${file.name}" — শুধু PDF, JPG, PNG বা WEBP দেওয়া যাবে।`;
        break;
      }
      files.push({ name: file.name, mimeType, data });
    }
  }
  if (!files.length && !values.policeReference?.trim() && !fieldErrors.evidence)
    fieldErrors.evidence = "জিডি নম্বর অথবা অন্তত একটি প্রমাণ (রসিদ/বক্সের ছবি) দিন।";

  if (!parsed.success || Object.keys(fieldErrors).length) return { ok: false, fieldErrors, values };

  try {
    const result = await createReport(await getDb(), await ensureReporterId(), parsed.data, files);
    if (!result.ok) return { ok: false, error: result.error, values };
    revalidatePath("/dashboard");
    return { ok: true, trackingId: result.trackingId };
  } catch (error) {
    if (error instanceof Error && /নম্বর/.test(error.message)) return { ok: false, fieldErrors: { identifier: error.message }, values };
    throw error;
  }
}

export async function linkReportAction(_prev: string | null, form: FormData): Promise<string | null> {
  if (!rateLimit(`link:${await clientIp()}`, 10, 60 * 60_000)) return TOO_MANY;
  const ok = await linkReportToReporter(await getDb(), await ensureReporterId(), String(form.get("trackingId") ?? ""), String(form.get("phone") ?? ""));
  if (!ok) return "Tracking ID ও মোবাইল নম্বর মেলেনি।";
  revalidatePath("/dashboard");
  return "রিপোর্টটি এই ডিভাইসে যোগ হয়েছে।";
}

export async function markRecoveredAction(form: FormData) {
  const reporterId = await currentReporterId();
  const id = z.string().uuid().safeParse(form.get("reportId"));
  if (!reporterId || !id.success) return;
  await markRecovered(await getDb(), reporterId, id.data);
  revalidatePath("/dashboard");
  revalidatePath("/");
}

export async function adminLoginAction(_prev: string | null, form: FormData): Promise<string | null> {
  const password = env().ADMIN_PASSWORD;
  if (!password) return "ADMIN_PASSWORD সেট করা নেই। .env ফাইলে যোগ করুন।";
  if (!rateLimit(`admin-login:${await clientIp()}`, 5, 15 * 60_000)) return TOO_MANY;
  if (!safeEqual(String(form.get("password") ?? ""), password)) return "পাসওয়ার্ড সঠিক নয়।";
  await startAdminSession();
  redirect("/admin");
}

export async function adminLogoutAction() {
  await endAdminSession();
  redirect("/admin");
}

const decisionInput = z.object({
  reportId: z.string().uuid(),
  decision: z.enum(["APPROVED", "REJECTED", "NEEDS_INFO"]),
  note: z.string().trim().max(500).optional().transform((v) => v || null),
});

export async function decideAction(form: FormData) {
  if (!(await isAdmin())) redirect("/admin");
  const input = decisionInput.safeParse(Object.fromEntries(form));
  if (!input.success) return;
  await decideReport(await getDb(), input.data.reportId, input.data.decision, input.data.note);
  revalidatePath("/admin");
  revalidatePath("/");
}
