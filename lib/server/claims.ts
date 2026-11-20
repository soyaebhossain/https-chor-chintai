import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, gte, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLogs, claimDocuments, claims, disputes, identifiers, products, recoveries, users } from "@/db/schema";
import { MAX_FILE_BYTES, MAX_FILES, MAX_TOTAL_BYTES, sniffEvidenceMime, type EvidenceMime } from "@/lib/evidence";
import { classifyForReport, lastFour, type IdentifierType } from "@/lib/identifiers";
import { INCIDENT_LABEL, KIND_OF, type ReportInput } from "@/lib/report-schema";
import { encryptField, identifierHmac } from "@/lib/server/crypto";
import { getEnv } from "@/lib/server/env";
import { sendMailSafely } from "@/lib/server/mailer";
import { deleteEvidence, putEvidence } from "@/lib/server/storage";

export type Db = ReturnType<typeof getDb>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type Actor = { id: string; email: string | null };
export type Evidence = { bytes: Uint8Array; mime: EvidenceMime; size: number; sha256: string };

const OPEN_STATUSES = ["PENDING", "NEEDS_INFO"] as const;
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function newTrackingId(now = new Date()): string {
  const date = now.toISOString().slice(2, 10).replace(/-/g, "");
  const rand = Array.from(randomBytes(6), (b) => CROCKFORD[b & 31]).join("");
  return `CLM-${date}-${rand}`;
}

/** Reads uploaded files, enforcing count, size and real (magic-byte) type. */
export async function readEvidence(files: File[], { required }: { required: boolean }): Promise<{ ok: true; items: Evidence[] } | { ok: false; error: string }> {
  const real = files.filter((f) => f.size > 0);
  if (required && real.length === 0) return { ok: false, error: "মালিকানার অন্তত একটি প্রমাণ (রসিদ, বক্সের ছবি বা জিডি) যুক্ত করুন।" };
  if (real.length > MAX_FILES) return { ok: false, error: `সর্বোচ্চ ${MAX_FILES.toLocaleString("bn-BD")}টি ফাইল দেওয়া যাবে।` };
  if (real.reduce((n, f) => n + f.size, 0) > MAX_TOTAL_BYTES) return { ok: false, error: "সব ফাইল মিলিয়ে 4MB-এর বেশি হয়ে গেছে। কম বা ছোট ফাইল দিন।" };
  const items: Evidence[] = [];
  for (const file of real) {
    if (file.size > MAX_FILE_BYTES) return { ok: false, error: `"${file.name}" অনেক বড় (সর্বোচ্চ 4MB)।` };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = sniffEvidenceMime(bytes);
    if (!mime) return { ok: false, error: `"${file.name}" PDF, JPG বা PNG নয়।` };
    items.push({ bytes, mime, size: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
  return { ok: true, items };
}

function riskScore(input: ReportInput, evidenceCount: number): number {
  let score = 0;
  if (!input.policeReference) score += 30;
  const days = (Date.now() - Date.parse(`${input.incidentDate}T00:00:00Z`)) / 86_400_000;
  if (days > 60) score += 20;
  if (evidenceCount < 2) score += 10;
  if (input.description.length < 60) score += 10;
  return Math.min(score, 100);
}

export const riskLabel = (score: number) => (score >= 50 ? "High" : score >= 25 ? "Medium" : "Low");

export async function audit(tx: Tx | Db, actorId: string | null, action: string, entityType: string, entityId: string, metadata?: Record<string, unknown>) {
  await tx.insert(auditLogs).values({ actorId, action, entityType, entityId, metadata: metadata ?? null });
}

function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

export async function uploadAll(claimId: string, items: Evidence[]): Promise<string[]> {
  const keys = items.map(() => `claims/${claimId}/${randomUUID()}`);
  await Promise.all(items.map((item, i) => putEvidence(keys[i], item.bytes)));
  return keys;
}

export async function removeAll(keys: string[]) {
  await Promise.allSettled(keys.map((k) => deleteEvidence(k)));
}

export function documentRows(claimId: string, uploadedBy: string, items: Evidence[], keys: string[], disputeId?: string) {
  return items.map((e, i) => ({ claimId, disputeId: disputeId ?? null, uploadedBy, storageKey: keys[i], mimeType: e.mime, sizeBytes: e.size, sha256: e.sha256 }));
}

/** Finds the published (REPORTED/DISPUTED) product an identifier points to, with its latest approved claim. */
export async function findPublished(db: Db, candidates: { type: IdentifierType; value: string }[]) {
  const secret = getEnv().IDENTIFIER_HMAC_SECRET;
  const [hit] = await db
    .select({ productId: products.id, ownerId: products.ownerId, status: products.status, brand: products.brand, model: products.model })
    .from(identifiers)
    .innerJoin(products, eq(products.id, identifiers.productId))
    .where(
      and(
        inArray(products.status, ["REPORTED", "DISPUTED"]),
        or(...candidates.map((c) => and(eq(identifiers.type, c.type), eq(identifiers.valueHmac, identifierHmac(secret, c.type, c.value))))),
      ),
    )
    .limit(1);
  if (!hit) return null;
  const [claim] = await db
    .select({ id: claims.id, trackingId: claims.trackingId, reporterId: claims.reporterId })
    .from(claims)
    .where(and(eq(claims.productId, hit.productId), eq(claims.reviewStatus, "APPROVED")))
    .orderBy(desc(claims.reviewedAt))
    .limit(1);
  return claim ? { ...hit, claim } : null;
}

export type SubmitResult = { ok: true; trackingId: string } | { ok: false; error: string };

export async function submitReport(reporter: Actor, input: ReportInput, evidence: Evidence[]): Promise<SubmitResult> {
  const env = getEnv();
  const db = getDb();
  const kind = KIND_OF[input.category];

  const ids: { type: IdentifierType; value: string; hmac: string }[] = [];
  for (const raw of [input.identifier, input.identifier2]) {
    if (!raw) continue;
    const c = classifyForReport(kind, raw);
    if (!c.ok) return { ok: false, error: "নম্বরটি সঠিক নয়।" };
    ids.push({ type: c.type, value: c.value, hmac: identifierHmac(env.IDENTIFIER_HMAC_SECRET, c.type, c.value) });
  }

  // Every number may already belong to a product (a re-report after recovery, or someone else's report).
  const existing = await db
    .select({ productId: products.id, ownerId: products.ownerId, status: products.status, type: identifiers.type, hmac: identifiers.valueHmac })
    .from(identifiers)
    .innerJoin(products, eq(products.id, identifiers.productId))
    .where(or(...ids.map((i) => and(eq(identifiers.type, i.type), eq(identifiers.valueHmac, i.hmac)))));

  const foreign = existing.find((e) => e.ownerId !== reporter.id);
  if (foreign) {
    await audit(db, reporter.id, "REPORT_BLOCKED_DUPLICATE", "product", foreign.productId);
    return { ok: false, error: "এই নম্বরে অন্য একজন ব্যবহারকারীর রিপোর্ট আগে থেকেই আছে। এটি ভুল হলে সার্চ ফলাফল থেকে “আপত্তি জানান” ব্যবহার করুন।" };
  }
  const productIds = [...new Set(existing.map((e) => e.productId))];
  if (productIds.length > 1) return { ok: false, error: "দুটি নম্বর আপনার আলাদা দুটি পুরোনো রিপোর্টের সাথে মিলেছে। প্রতিটি পণ্যের জন্য আলাদা রিপোর্ট করুন।" };
  const reuse = existing[0];
  if (reuse) {
    if (reuse.status === "REPORTED" || reuse.status === "DISPUTED") return { ok: false, error: "এই পণ্যটি আগেই রিপোর্ট ও প্রকাশিত হয়েছে।" };
    const [open] = await db.select({ id: claims.id }).from(claims).where(and(eq(claims.productId, reuse.productId), inArray(claims.reviewStatus, [...OPEN_STATUSES]))).limit(1);
    if (open) return { ok: false, error: "এই পণ্যের একটি রিপোর্ট ইতিমধ্যে পর্যালোচনাধীন। ড্যাশবোর্ডে অবস্থা দেখুন।" };
  }

  const claimId = randomUUID();
  const trackingId = newTrackingId();
  const keys = await uploadAll(claimId, evidence);

  try {
    await db.transaction(async (tx) => {
      let productId = reuse?.productId;
      if (productId) {
        await tx.update(products).set({ category: input.category, brand: input.brand, model: input.model, status: "UNDER_REVIEW" }).where(eq(products.id, productId));
      } else {
        const [product] = await tx
          .insert(products)
          .values({ ownerId: reporter.id, category: input.category, brand: input.brand, model: input.model, status: "UNDER_REVIEW" })
          .returning({ id: products.id });
        productId = product.id;
      }
      const known = new Set(existing.map((e) => `${e.type}:${e.hmac}`));
      const fresh = ids.filter((i) => !known.has(`${i.type}:${i.hmac}`));
      if (fresh.length) {
        await tx.insert(identifiers).values(
          fresh.map((i) => ({ productId: productId!, type: i.type, valueHmac: i.hmac, valueEncrypted: encryptField(env.FIELD_ENCRYPTION_KEY, i.value), lastFour: lastFour(i.value) })),
        );
      }
      await tx.insert(claims).values({
        id: claimId,
        trackingId,
        productId,
        reporterId: reporter.id,
        incidentType: input.incidentType,
        incidentAt: new Date(`${input.incidentDate}T00:00:00Z`),
        location: input.location,
        policeReference: input.policeReference ?? null,
        description: input.description,
        attestedAt: new Date(),
        riskScore: riskScore(input, evidence.length),
      });
      if (evidence.length) await tx.insert(claimDocuments).values(documentRows(claimId, reporter.id, evidence, keys));
      await audit(tx, reporter.id, "CLAIM_SUBMITTED", "claim", claimId, { trackingId, documents: evidence.length, identifiers: ids.length });
    });
  } catch (error) {
    await removeAll(keys);
    if (isUniqueViolation(error)) return { ok: false, error: "এই নম্বরে এইমাত্র আরেকটি রিপোর্ট জমা পড়েছে। কিছুক্ষণ পর ড্যাশবোর্ড দেখুন।" };
    throw error;
  }

  if (reporter.email) {
    await sendMailSafely({
      to: reporter.email,
      subject: `রিপোর্ট গ্রহণ করা হয়েছে — ${trackingId}`,
      text: `আপনার রিপোর্ট (${input.brand} ${input.model}) আমরা পেয়েছি।\nTracking ID: ${trackingId}\n\nএকজন যাচাইকারী প্রমাণ পর্যালোচনা করবেন। অনুমোদনের আগে কোনো তথ্য প্রকাশ করা হবে না।\nপণ্যটি ফেরত পেলে ড্যাশবোর্ড থেকে “ফেরত পেয়েছি” চাপুন—তাহলে সতর্কতা সরিয়ে নেওয়া হবে।\n\n— চোর ছিনতাই`,
    });
  }
  return { ok: true, trackingId };
}

/** Reporter answers a NEEDS_INFO request with more files and/or a note; the claim goes back to the queue. */
export async function addInformation(reporter: Actor, claimId: string, message: string, evidence: Evidence[]): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  const [claim] = await db.select({ id: claims.id, status: claims.reviewStatus }).from(claims).where(and(eq(claims.id, claimId), eq(claims.reporterId, reporter.id))).limit(1);
  if (!claim) return { ok: false, error: "রিপোর্টটি পাওয়া যায়নি।" };
  if (claim.status !== "NEEDS_INFO") return { ok: false, error: "এই রিপোর্টে এখন নতুন তথ্য যোগ করা যাবে না।" };
  if (!message.trim() && evidence.length === 0) return { ok: false, error: "একটি বার্তা লিখুন বা ফাইল যুক্ত করুন।" };

  const keys = await uploadAll(claimId, evidence);
  try {
    await db.transaction(async (tx) => {
      const updated = await tx
        .update(claims)
        .set({ reviewStatus: "PENDING" })
        .where(and(eq(claims.id, claimId), eq(claims.reviewStatus, "NEEDS_INFO")))
        .returning({ id: claims.id });
      if (updated.length !== 1) throw new Error("STATE_CHANGED");
      if (evidence.length) await tx.insert(claimDocuments).values(documentRows(claimId, reporter.id, evidence, keys));
      await audit(tx, reporter.id, "CLAIM_INFO_ADDED", "claim", claimId, { message: message.trim().slice(0, 2000), documents: evidence.length });
    });
  } catch (error) {
    await removeAll(keys);
    if (error instanceof Error && error.message === "STATE_CHANGED") return { ok: false, error: "রিপোর্টের অবস্থা বদলে গেছে। পাতা রিফ্রেশ করুন।" };
    throw error;
  }
  return { ok: true };
}

/**
 * The owner got the item back. The public alert disappears immediately — a
 * stale alert would wrongly flag the next legitimate buyer. No review needed:
 * an owner can only ever remove their own alert, never add one.
 */
export async function markRecovered(owner: Actor, claimId: string, note: string): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ productId: claims.productId, status: claims.reviewStatus, productStatus: products.status })
      .from(claims)
      .innerJoin(products, eq(products.id, claims.productId))
      .where(and(eq(claims.id, claimId), eq(claims.reporterId, owner.id), eq(products.ownerId, owner.id)))
      .for("update");
    if (!row) return { ok: false, error: "রিপোর্টটি পাওয়া যায়নি।" };
    if (row.status !== "APPROVED" || (row.productStatus !== "REPORTED" && row.productStatus !== "DISPUTED")) {
      return { ok: false, error: "শুধু প্রকাশিত রিপোর্টকে “ফেরত পাওয়া গেছে” চিহ্নিত করা যায়।" };
    }
    await tx.update(products).set({ status: "RECOVERED" }).where(eq(products.id, row.productId));
    await tx.insert(recoveries).values({ productId: row.productId, claimId, reportedBy: owner.id, recoveredAt: new Date(), note: note.trim().slice(0, 1000) || null });
    // Any appeal against this alert is moot now.
    await tx
      .update(disputes)
      .set({ status: "DISMISSED", resolvedAt: new Date(), resolutionNote: "মালিক পণ্যটি ফেরত পেয়েছেন; সতর্কতা সরানো হয়েছে।" })
      .where(and(eq(disputes.claimId, claimId), inArray(disputes.status, ["OPEN", "UNDER_REVIEW"])));
    await audit(tx, owner.id, "CLAIM_RECOVERED", "claim", claimId, note.trim() ? { note: note.trim().slice(0, 1000) } : undefined);
    return { ok: true };
  });
}

export type Decision = "APPROVE" | "REJECT" | "NEEDS_INFO";

export async function decideClaim(reviewer: Actor, claimId: string, decision: Decision, note: string): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  if ((decision === "REJECT" || decision === "NEEDS_INFO") && note.trim().length < 10) {
    return { ok: false, error: "প্রত্যাখ্যান বা অতিরিক্ত তথ্য চাইলে রিপোর্টকারীর জন্য কারণ লিখুন (কমপক্ষে ১০ অক্ষর)।" };
  }

  const outcome = await db.transaction(async (tx) => {
    const [claim] = await tx
      .select({ id: claims.id, productId: claims.productId, reporterId: claims.reporterId, status: claims.reviewStatus, trackingId: claims.trackingId })
      .from(claims)
      .where(eq(claims.id, claimId))
      .for("update");
    if (!claim) return { ok: false as const, error: "রিপোর্টটি পাওয়া যায়নি।" };
    if (claim.reporterId === reviewer.id) return { ok: false as const, error: "নিজের জমা দেওয়া রিপোর্ট নিজে পর্যালোচনা করা যাবে না।" };
    if (claim.status !== "PENDING" && claim.status !== "NEEDS_INFO") return { ok: false as const, error: "এই রিপোর্টে আগেই সিদ্ধান্ত হয়ে গেছে।" };

    const reviewStatus = decision === "APPROVE" ? "APPROVED" : decision === "REJECT" ? "REJECTED" : "NEEDS_INFO";
    await tx
      .update(claims)
      .set({ reviewStatus, reviewNote: note.trim() || null, reviewedBy: reviewer.id, reviewedAt: new Date() })
      .where(eq(claims.id, claimId));

    if (decision === "APPROVE") {
      await tx.update(products).set({ status: "REPORTED" }).where(eq(products.id, claim.productId));
    } else if (decision === "REJECT") {
      const [otherApproved] = await tx
        .select({ id: claims.id })
        .from(claims)
        .where(and(eq(claims.productId, claim.productId), eq(claims.reviewStatus, "APPROVED"), ne(claims.id, claimId)))
        .limit(1);
      if (!otherApproved) await tx.update(products).set({ status: "REJECTED" }).where(eq(products.id, claim.productId));
    }
    await audit(tx, reviewer.id, `CLAIM_${reviewStatus}`, "claim", claimId, note.trim() ? { note: note.trim() } : undefined);
    return { ok: true as const, reporterId: claim.reporterId, trackingId: claim.trackingId, reviewStatus };
  });

  if (!outcome.ok) return outcome;
  const [reporter] = await db.select({ email: users.email }).from(users).where(eq(users.id, outcome.reporterId));
  if (reporter?.email) {
    const headline = { APPROVED: "অনুমোদিত হয়েছে এবং রেজিস্ট্রিতে প্রকাশিত হয়েছে", REJECTED: "প্রত্যাখ্যাত হয়েছে", NEEDS_INFO: "এর জন্য আরও তথ্য প্রয়োজন" }[outcome.reviewStatus];
    await sendMailSafely({
      to: reporter.email,
      subject: `আপনার রিপোর্ট ${outcome.trackingId} ${headline}`,
      text: `Tracking ID: ${outcome.trackingId}\nঅবস্থা: ${headline}\n${note.trim() ? `\nযাচাইকারীর মন্তব্য:\n${note.trim()}\n` : ""}\nবিস্তারিত দেখতে ড্যাশবোর্ডে লগইন করুন।\n\n— চোর ছিনতাই`,
    });
  }
  return { ok: true };
}

// ---------- read models ----------

export async function listMyClaims(userId: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: claims.id,
      trackingId: claims.trackingId,
      status: claims.reviewStatus,
      reviewNote: claims.reviewNote,
      createdAt: claims.createdAt,
      brand: products.brand,
      model: products.model,
      productStatus: products.status,
      productId: products.id,
    })
    .from(claims)
    .innerJoin(products, eq(products.id, claims.productId))
    .where(eq(claims.reporterId, userId))
    .orderBy(desc(claims.createdAt));
  if (!rows.length) return [];
  const ids = await db
    .select({ productId: identifiers.productId, type: identifiers.type, lastFour: identifiers.lastFour })
    .from(identifiers)
    .where(inArray(identifiers.productId, [...new Set(rows.map((r) => r.productId))]));
  return rows.map((r) => ({ ...r, identifiers: ids.filter((i) => i.productId === r.productId) }));
}

export async function reviewQueue() {
  const db = getDb();
  const docCount = db
    .select({ claimId: claimDocuments.claimId, n: count().as("n") })
    .from(claimDocuments)
    .where(isNull(claimDocuments.disputeId))
    .groupBy(claimDocuments.claimId)
    .as("doc_count");
  const firstId = db
    .selectDistinctOn([identifiers.productId], { productId: identifiers.productId, type: identifiers.type, lastFour: identifiers.lastFour })
    .from(identifiers)
    .orderBy(identifiers.productId, asc(identifiers.createdAt))
    .as("first_id");
  return db
    .select({
      id: claims.id,
      trackingId: claims.trackingId,
      status: claims.reviewStatus,
      riskScore: claims.riskScore,
      createdAt: claims.createdAt,
      brand: products.brand,
      model: products.model,
      category: products.category,
      identifierType: firstId.type,
      lastFour: firstId.lastFour,
      documents: sql<number>`coalesce(${docCount.n}, 0)`.mapWith(Number),
    })
    .from(claims)
    .innerJoin(products, eq(products.id, claims.productId))
    .leftJoin(firstId, eq(firstId.productId, products.id))
    .leftJoin(docCount, eq(docCount.claimId, claims.id))
    .where(inArray(claims.reviewStatus, [...OPEN_STATUSES]))
    .orderBy(asc(claims.createdAt))
    .limit(200);
}

export async function queueStats() {
  const db = getDb();
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const [[pending], [decidedToday], [highRisk], [openDisputes]] = await Promise.all([
    db.select({ n: count() }).from(claims).where(eq(claims.reviewStatus, "PENDING")),
    db.select({ n: count() }).from(claims).where(gte(claims.reviewedAt, startOfDay)),
    db.select({ n: count() }).from(claims).where(and(inArray(claims.reviewStatus, [...OPEN_STATUSES]), gte(claims.riskScore, 50))),
    db.select({ n: count() }).from(disputes).where(inArray(disputes.status, ["OPEN", "UNDER_REVIEW"])),
  ]);
  return { pending: pending.n, decidedToday: decidedToday.n, highRisk: highRisk.n, openDisputes: openDisputes.n };
}

export async function claimForReview(claimId: string) {
  const db = getDb();
  const [row] = await db
    .select({ claim: claims, product: products, reporterEmail: users.email })
    .from(claims)
    .innerJoin(products, eq(products.id, claims.productId))
    .innerJoin(users, eq(users.id, claims.reporterId))
    .where(eq(claims.id, claimId))
    .limit(1);
  if (!row) return null;
  const [ids, docs, history, claimDisputes] = await Promise.all([
    db.select().from(identifiers).where(eq(identifiers.productId, row.product.id)).orderBy(asc(identifiers.createdAt)),
    db.select().from(claimDocuments).where(and(eq(claimDocuments.claimId, claimId), isNull(claimDocuments.disputeId))).orderBy(asc(claimDocuments.createdAt)),
    db
      .select({ action: auditLogs.action, metadata: auditLogs.metadata, createdAt: auditLogs.createdAt, actorEmail: users.email })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorId))
      .where(and(eq(auditLogs.entityType, "claim"), eq(auditLogs.entityId, claimId)))
      .orderBy(desc(auditLogs.createdAt))
      .limit(50),
    db.select({ id: disputes.id, status: disputes.status, createdAt: disputes.createdAt }).from(disputes).where(eq(disputes.claimId, claimId)).orderBy(desc(disputes.createdAt)),
  ]);
  return { ...row, identifiers: ids, documents: docs, history, disputes: claimDisputes };
}

export async function logStaffAccess(actorId: string, action: string, entityType: string, entityId: string, metadata?: Record<string, unknown>) {
  await audit(getDb(), actorId, action, entityType, entityId, metadata);
}

export async function documentForStaff(documentId: string) {
  const [doc] = await getDb().select().from(claimDocuments).where(eq(claimDocuments.id, documentId)).limit(1);
  return doc ?? null;
}

/** Latest approved, still-published reports for the home page. Masked, no reporter data. */
export async function recentAlerts(limit = 3) {
  try {
    const db = getDb();
    const firstId = db
      .selectDistinctOn([identifiers.productId], { productId: identifiers.productId, type: identifiers.type, lastFour: identifiers.lastFour })
      .from(identifiers)
      .orderBy(identifiers.productId, asc(identifiers.createdAt))
      .as("first_id");
    const rows = await db
      .select({
        brand: products.brand,
        model: products.model,
        identifierType: firstId.type,
        lastFour: firstId.lastFour,
        location: claims.location,
        incidentType: claims.incidentType,
        incidentAt: claims.incidentAt,
      })
      .from(claims)
      .innerJoin(products, eq(products.id, claims.productId))
      .innerJoin(firstId, eq(firstId.productId, products.id))
      .where(and(eq(claims.reviewStatus, "APPROVED"), eq(products.status, "REPORTED")))
      .orderBy(desc(claims.reviewedAt))
      .limit(limit);
    return rows.map((r) => ({ ...r, incidentLabel: INCIDENT_LABEL[r.incidentType], incidentDate: r.incidentAt.toISOString().slice(0, 10) }));
  } catch (error) {
    console.error("recent alerts unavailable:", error instanceof Error ? error.message : error);
    return [];
  }
}

/** Real numbers for the home page instead of marketing copy. */
export async function registryStats() {
  try {
    const rows = await getDb()
      .select({ status: products.status, n: count() })
      .from(products)
      .where(inArray(products.status, ["REPORTED", "DISPUTED", "RECOVERED"]))
      .groupBy(products.status);
    const of = (s: string) => rows.find((r) => r.status === s)?.n ?? 0;
    return { active: of("REPORTED") + of("DISPUTED"), recovered: of("RECOVERED") };
  } catch {
    return null;
  }
}
