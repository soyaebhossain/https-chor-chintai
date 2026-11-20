"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/server/auth";
import { decideClaim, type Decision } from "@/lib/server/claims";
import { decideDispute, type DisputeDecision } from "@/lib/server/disputes";

const DECISIONS: Decision[] = ["APPROVE", "REJECT", "NEEDS_INFO"];

export async function decideAction(form: FormData) {
  const claimId = String(form.get("claimId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(claimId)) redirect("/admin");
  // Re-check role + MFA on every mutation, not just when the page was rendered.
  const session = await requireStaff(`/admin/claims/${claimId}`);

  const decision = String(form.get("decision") ?? "") as Decision;
  if (!DECISIONS.includes(decision)) redirect(`/admin/claims/${claimId}?error=${encodeURIComponent("একটি সিদ্ধান্ত বেছে নিন।")}`);
  const note = String(form.get("note") ?? "").slice(0, 2000);

  const result = await decideClaim({ id: session.user.id, email: session.user.email }, claimId, decision, note);
  if (!result.ok) redirect(`/admin/claims/${claimId}?error=${encodeURIComponent(result.error ?? "সিদ্ধান্ত সংরক্ষণ করা যায়নি।")}`);
  revalidatePath("/admin");
  revalidatePath("/");
  redirect(`/admin?decided=${encodeURIComponent(String(form.get("trackingId") ?? ""))}`);
}

const DISPUTE_DECISIONS: DisputeDecision[] = ["UNDER_REVIEW", "UPHOLD", "DISMISS"];

export async function decideDisputeAction(form: FormData) {
  const disputeId = String(form.get("disputeId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(disputeId)) redirect("/admin");
  const session = await requireStaff(`/admin/disputes/${disputeId}`);
  const decision = String(form.get("decision") ?? "") as DisputeDecision;
  if (!DISPUTE_DECISIONS.includes(decision)) redirect(`/admin/disputes/${disputeId}?error=${encodeURIComponent("একটি সিদ্ধান্ত বেছে নিন।")}`);
  const result = await decideDispute({ id: session.user.id, email: session.user.email }, disputeId, decision, String(form.get("note") ?? "").slice(0, 2000));
  if (!result.ok) redirect(`/admin/disputes/${disputeId}?error=${encodeURIComponent(result.error ?? "সিদ্ধান্ত সংরক্ষণ করা যায়নি।")}`);
  revalidatePath("/admin");
  revalidatePath("/");
  redirect(`/admin?decided=${encodeURIComponent(`APL-${disputeId.slice(0, 8).toUpperCase()}`)}`);
}
