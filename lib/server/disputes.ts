import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { claimDocuments, claims, disputes, products, users } from "@/db/schema";
import { planSearch } from "@/lib/identifiers";
import type { DisputeInput } from "@/lib/report-schema";
import { audit, documentRows, findPublished, removeAll, uploadAll, type Actor, type Evidence } from "@/lib/server/claims";
import { sendMailSafely } from "@/lib/server/mailer";

const OPEN = ["OPEN", "UNDER_REVIEW"] as const;

/**
 * Anyone shown a "reported" result (typically a buyer or seller who says it's
 * a mistake) can appeal with evidence. Filing does NOT change the public
 * status by itself — otherwise a thief could soften every genuine alert just
 * by complaining. A reviewer decides whether to show it as "under appeal".
 */
export async function fileDispute(user: Actor, input: DisputeInput, evidence: Evidence[]): Promise<{ ok: true; reference: string } | { ok: false; error: string }> {
  const plan = planSearch(input.identifier);
  if (!plan.ok) return { ok: false, error: "নম্বরটি সঠিক নয়।" };
  const db = getDb();
  const hit = await findPublished(db, plan.candidates);
  if (!hit) return { ok: false, error: "এই নম্বরে কোনো প্রকাশিত রিপোর্ট নেই—আপত্তির প্রয়োজন নেই।" };
  if (hit.ownerId === user.id) return { ok: false, error: "এটি আপনার নিজের রিপোর্ট। পণ্য ফেরত পেলে ড্যাশবোর্ড থেকে “ফেরত পেয়েছি” চাপুন।" };

  const [already] = await db
    .select({ id: disputes.id })
    .from(disputes)
    .where(and(eq(disputes.claimId, hit.claim.id), eq(disputes.raisedBy, user.id), inArray(disputes.status, [...OPEN])))
    .limit(1);
  if (already) return { ok: false, error: "এই রিপোর্টে আপনার একটি আপত্তি ইতিমধ্যে পর্যালোচনাধীন। ড্যাশবোর্ডে অবস্থা দেখুন।" };

  const disputeId = randomUUID();
  const keys = await uploadAll(hit.claim.id, evidence);
  try {
    await db.transaction(async (tx) => {
      await tx.insert(disputes).values({ id: disputeId, claimId: hit.claim.id, raisedBy: user.id, reason: `${input.reason}\n\n${input.details.trim()}` });
      if (evidence.length) await tx.insert(claimDocuments).values(documentRows(hit.claim.id, user.id, evidence, keys, disputeId));
      await audit(tx, user.id, "DISPUTE_FILED", "claim", hit.claim.id, { disputeId, reason: input.reason, documents: evidence.length });
    });
  } catch (error) {
    await removeAll(keys);
    throw error;
  }

  const reference = `APL-${disputeId.slice(0, 8).toUpperCase()}`;
  if (user.email) {
    await sendMailSafely({
      to: user.email,
      subject: `আপনার আপত্তি গ্রহণ করা হয়েছে — ${reference}`,
      text: `${hit.brand} ${hit.model}-এর রিপোর্টের বিরুদ্ধে আপনার আপত্তি আমরা পেয়েছি (রেফারেন্স ${reference})।\nএকজন যাচাইকারী উভয় পক্ষের প্রমাণ দেখে সিদ্ধান্ত জানাবেন। আপনার পরিচয় রিপোর্টকারীকে জানানো হবে না।\n\n— চুরি-ছিন্তাই`,
    });
  }
  return { ok: true, reference };
}

export type DisputeDecision = "UNDER_REVIEW" | "UPHOLD" | "DISMISS";

export async function decideDispute(reviewer: Actor, disputeId: string, decision: DisputeDecision, note: string): Promise<{ ok: boolean; error?: string }> {
  if ((decision === "UPHOLD" || decision === "DISMISS") && note.trim().length < 10) {
    return { ok: false, error: "চূড়ান্ত সিদ্ধান্তের কারণ লিখুন (কমপক্ষে ১০ অক্ষর)—উভয় পক্ষকে জানানো হবে।" };
  }
  const db = getDb();
  const outcome = await db.transaction(async (tx) => {
    const [d] = await tx
      .select({ id: disputes.id, status: disputes.status, raisedBy: disputes.raisedBy, claimId: disputes.claimId, reporterId: claims.reporterId, productId: claims.productId, trackingId: claims.trackingId })
      .from(disputes)
      .innerJoin(claims, eq(claims.id, disputes.claimId))
      .where(eq(disputes.id, disputeId))
      .for("update");
    if (!d) return { ok: false as const, error: "আপত্তিটি পাওয়া যায়নি।" };
    if (d.raisedBy === reviewer.id || d.reporterId === reviewer.id) return { ok: false as const, error: "যে বিষয়ে আপনি নিজে পক্ষ, তার সিদ্ধান্ত আপনি নিতে পারবেন না।" };
    if (d.status !== "OPEN" && d.status !== "UNDER_REVIEW") return { ok: false as const, error: "এই আপত্তিতে আগেই সিদ্ধান্ত হয়ে গেছে।" };

    const now = new Date();
    if (decision === "UNDER_REVIEW") {
      await tx.update(disputes).set({ status: "UNDER_REVIEW" }).where(eq(disputes.id, disputeId));
      await tx.update(products).set({ status: "DISPUTED" }).where(and(eq(products.id, d.productId), eq(products.status, "REPORTED")));
    } else if (decision === "UPHOLD") {
      // The report was wrong: take it down and close every other appeal on it.
      await tx.update(disputes).set({ status: "UPHELD", resolvedBy: reviewer.id, resolvedAt: now, resolutionNote: note.trim() }).where(eq(disputes.id, disputeId));
      await tx
        .update(disputes)
        .set({ status: "UPHELD", resolvedBy: reviewer.id, resolvedAt: now, resolutionNote: "একই রিপোর্টের অন্য আপত্তি গৃহীত হয়েছে।" })
        .where(and(eq(disputes.claimId, d.claimId), ne(disputes.id, disputeId), inArray(disputes.status, [...OPEN])));
      await tx.update(claims).set({ reviewStatus: "REJECTED", reviewNote: `আপত্তির পর রিপোর্ট প্রত্যাহার: ${note.trim()}`, reviewedBy: reviewer.id, reviewedAt: now }).where(eq(claims.id, d.claimId));
      await tx.update(products).set({ status: "REJECTED" }).where(eq(products.id, d.productId));
    } else {
      await tx.update(disputes).set({ status: "DISMISSED", resolvedBy: reviewer.id, resolvedAt: now, resolutionNote: note.trim() }).where(eq(disputes.id, disputeId));
      const [stillOpen] = await tx
        .select({ id: disputes.id })
        .from(disputes)
        .where(and(eq(disputes.claimId, d.claimId), eq(disputes.status, "UNDER_REVIEW")))
        .limit(1);
      if (!stillOpen) await tx.update(products).set({ status: "REPORTED" }).where(and(eq(products.id, d.productId), eq(products.status, "DISPUTED")));
    }
    await audit(tx, reviewer.id, `DISPUTE_${decision}`, "claim", d.claimId, { disputeId, ...(note.trim() ? { note: note.trim() } : {}) });
    return { ok: true as const, raisedBy: d.raisedBy, reporterId: d.reporterId, trackingId: d.trackingId };
  });
  if (!outcome.ok) return outcome;

  if (decision !== "UNDER_REVIEW") {
    const people = await db.select({ id: users.id, email: users.email }).from(users).where(inArray(users.id, [outcome.raisedBy, outcome.reporterId]));
    const emailOf = (id: string) => people.find((p) => p.id === id)?.email;
    const upheld = decision === "UPHOLD";
    const disputer = emailOf(outcome.raisedBy);
    const reporter = emailOf(outcome.reporterId);
    if (disputer) {
      await sendMailSafely({
        to: disputer,
        subject: upheld ? "আপনার আপত্তি গৃহীত হয়েছে" : "আপনার আপত্তি খারিজ হয়েছে",
        text: `${upheld ? "যাচাইকারী আপনার আপত্তি গ্রহণ করেছেন এবং রিপোর্টটি সরিয়ে নেওয়া হয়েছে।" : "যাচাইকারী আপত্তিটি খারিজ করেছেন; রিপোর্টটি বহাল আছে।"}\n\nকারণ:\n${note.trim()}\n\n— চুরি-ছিন্তাই`,
      });
    }
    if (reporter) {
      await sendMailSafely({
        to: reporter,
        subject: `আপনার রিপোর্ট ${outcome.trackingId}-এর বিরুদ্ধে আপত্তির সিদ্ধান্ত`,
        text: `${upheld ? "আপনার রিপোর্টের বিরুদ্ধে করা আপত্তি গৃহীত হয়েছে, তাই রিপোর্টটি প্রকাশ থেকে সরানো হয়েছে।" : "আপনার রিপোর্টের বিরুদ্ধে করা আপত্তি খারিজ হয়েছে; রিপোর্টটি প্রকাশিত আছে।"}\n\nকারণ:\n${note.trim()}\n\nপ্রশ্ন থাকলে এই ইমেইলের উত্তর দিন।\n\n— চুরি-ছিন্তাই`,
      });
    }
  }
  return { ok: true };
}

export async function disputeQueue() {
  return getDb()
    .select({
      id: disputes.id,
      status: disputes.status,
      createdAt: disputes.createdAt,
      reason: disputes.reason,
      trackingId: claims.trackingId,
      brand: products.brand,
      model: products.model,
    })
    .from(disputes)
    .innerJoin(claims, eq(claims.id, disputes.claimId))
    .innerJoin(products, eq(products.id, claims.productId))
    .where(inArray(disputes.status, [...OPEN]))
    .orderBy(asc(disputes.createdAt))
    .limit(200);
}

export async function disputeForReview(disputeId: string) {
  const db = getDb();
  const [row] = await db
    .select({ dispute: disputes, claim: claims, product: products, disputerEmail: users.email })
    .from(disputes)
    .innerJoin(claims, eq(claims.id, disputes.claimId))
    .innerJoin(products, eq(products.id, claims.productId))
    .innerJoin(users, eq(users.id, disputes.raisedBy))
    .where(eq(disputes.id, disputeId))
    .limit(1);
  if (!row) return null;
  const docs = await db.select().from(claimDocuments).where(eq(claimDocuments.disputeId, disputeId)).orderBy(asc(claimDocuments.createdAt));
  return { ...row, documents: docs };
}

export async function listMyDisputes(userId: string) {
  return getDb()
    .select({
      id: disputes.id,
      status: disputes.status,
      createdAt: disputes.createdAt,
      resolutionNote: disputes.resolutionNote,
      brand: products.brand,
      model: products.model,
    })
    .from(disputes)
    .innerJoin(claims, eq(claims.id, disputes.claimId))
    .innerJoin(products, eq(products.id, claims.productId))
    .where(and(eq(disputes.raisedBy, userId), isNotNull(disputes.id)))
    .orderBy(desc(disputes.createdAt));
}
