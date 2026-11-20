"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { disputeSchema, type DisputeFieldErrors, type DisputeInput } from "@/lib/report-schema";
import { getSession } from "@/lib/server/auth";
import { readEvidence } from "@/lib/server/claims";
import { fileDispute } from "@/lib/server/disputes";
import { formatRetry, rateLimit } from "@/lib/server/rate-limit";

export type DisputeState = { errors?: DisputeFieldErrors; formError?: string; reference?: string };

export async function fileDisputeAction(_prev: DisputeState, form: FormData): Promise<DisputeState> {
  const session = await getSession();
  if (!session) redirect("/login?next=/dispute");

  const limit = await rateLimit("dispute-file", session.user.id, 3, 24 * 3600);
  if (!limit.ok) return { formError: `আজ অনেকগুলো আপত্তি জমা দেওয়া হয়েছে। ${formatRetry(limit.retryAfterSeconds)} পর আবার চেষ্টা করুন।` };

  const raw = Object.fromEntries((["identifier", "reason", "details", "attest"] as const).map((k) => [k, typeof form.get(k) === "string" ? (form.get(k) as string) : undefined]));
  const parsed = disputeSchema.safeParse(raw);
  const errors: DisputeFieldErrors = {};
  if (!parsed.success) for (const issue of parsed.error.issues) errors[issue.path[0] as keyof DisputeInput] ??= issue.message;
  const evidence = await readEvidence(form.getAll("evidence").filter((f): f is File => f instanceof File), { required: false });
  if (!evidence.ok) errors.evidence = evidence.error;
  if (!parsed.success || !evidence.ok) return { errors };

  const result = await fileDispute({ id: session.user.id, email: session.user.email }, parsed.data, evidence.items);
  if (!result.ok) return { formError: result.error };
  revalidatePath("/dashboard");
  return { reference: result.reference };
}
