"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { reportSchema, type FieldErrors, type ReportInput } from "@/lib/report-schema";
import { getSession } from "@/lib/server/auth";
import { readEvidence, submitReport } from "@/lib/server/claims";
import { clientIp, formatRetry, rateLimit } from "@/lib/server/rate-limit";
import { TURNSTILE_ERROR, TURNSTILE_FIELD, verifyTurnstile } from "@/lib/server/turnstile";

export type ReportState = { errors?: FieldErrors; formError?: string; trackingId?: string };

const FIELDS = ["category", "brand", "model", "identifier", "identifier2", "incidentType", "incidentDate", "location", "policeReference", "description", "attest"] as const;

export async function submitReportAction(_prev: ReportState, form: FormData): Promise<ReportState> {
  const session = await getSession();
  if (!session) redirect("/login?next=/report");

  const limit = await rateLimit("report-submit", session.user.id, 5, 24 * 3600);
  if (!limit.ok) return { formError: `আজ অনেকগুলো রিপোর্ট জমা দেওয়া হয়েছে। ${formatRetry(limit.retryAfterSeconds)} পর আবার চেষ্টা করুন।` };

  if (!(await verifyTurnstile(form.get(TURNSTILE_FIELD), clientIp(await headers())))) return { formError: TURNSTILE_ERROR };

  const raw = Object.fromEntries(FIELDS.map((k) => [k, typeof form.get(k) === "string" ? (form.get(k) as string) : undefined]));
  const parsed = reportSchema.safeParse(raw);
  const errors: FieldErrors = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof ReportInput;
      errors[key] ??= issue.message;
    }
  }
  const files = form.getAll("evidence").filter((f): f is File => f instanceof File);
  const evidence = await readEvidence(files, { required: true });
  if (!evidence.ok) errors.evidence = evidence.error;
  if (!parsed.success || !evidence.ok) return { errors };

  const result = await submitReport({ id: session.user.id, email: session.user.email }, parsed.data, evidence.items);
  if (!result.ok) return { formError: result.error };
  revalidatePath("/dashboard");
  return { trackingId: result.trackingId };
}
