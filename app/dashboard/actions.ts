"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/server/auth";
import { addInformation, markRecovered, readEvidence } from "@/lib/server/claims";
import { formatRetry, rateLimit } from "@/lib/server/rate-limit";

export type AddInfoState = { error?: string; done?: boolean };

export async function addInfoAction(_prev: AddInfoState, form: FormData): Promise<AddInfoState> {
  const session = await getSession();
  if (!session) redirect("/login?next=/dashboard");

  const limit = await rateLimit("claim-add-info", session.user.id, 20, 24 * 3600);
  if (!limit.ok) return { error: `অনেকবার চেষ্টা হয়েছে। ${formatRetry(limit.retryAfterSeconds)} পর আবার চেষ্টা করুন।` };

  const claimId = String(form.get("claimId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(claimId)) return { error: "রিপোর্টটি পাওয়া যায়নি।" };
  const message = String(form.get("message") ?? "").slice(0, 2000);
  const evidence = await readEvidence(form.getAll("evidence").filter((f): f is File => f instanceof File), { required: false });
  if (!evidence.ok) return { error: evidence.error };

  const result = await addInformation({ id: session.user.id, email: session.user.email }, claimId, message, evidence.items);
  if (!result.ok) return { error: result.error };
  revalidatePath("/dashboard");
  return { done: true };
}

export type RecoverState = { error?: string; done?: boolean };

export async function markRecoveredAction(_prev: RecoverState, form: FormData): Promise<RecoverState> {
  const session = await getSession();
  if (!session) redirect("/login?next=/dashboard");
  const claimId = String(form.get("claimId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(claimId)) return { error: "রিপোর্টটি পাওয়া যায়নি।" };
  const result = await markRecovered({ id: session.user.id, email: session.user.email }, claimId, String(form.get("note") ?? ""));
  if (!result.ok) return { error: result.error };
  revalidatePath("/dashboard");
  revalidatePath("/");
  return { done: true };
}
