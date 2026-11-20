import "server-only";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { auditLogs, evidence, reports, type ReportStatus } from "@/db/schema";
import { decrypt, encrypt, lookupHash, trackingId } from "./crypto";
import { matchKey, parseIdentifier, type IdentifierType } from "./identifiers";
import { normalizeBdPhone, type ReportInput } from "./validation";

export type EvidenceFile = { name: string; mimeType: string; data: Buffer };

export type SearchResult =
  | { status: "invalid"; error: string }
  | { status: "clear"; type: IdentifierType }
  | {
      status: "reported";
      type: IdentifierType;
      match: { category: string; brandModel: string; last4: string; incidentType: string; location: string; incidentDate: string };
    };

/** Public lookup. Only reports a moderator approved are ever matched. */
export async function searchRegistry(db: Db, query: string): Promise<SearchResult> {
  const parsed = parseIdentifier(query);
  if (!parsed.ok) return { status: "invalid", error: parsed.error };
  const hash = lookupHash(matchKey(parsed.type, parsed.value));
  const [row] = await db
    .select()
    .from(reports)
    .where(and(eq(reports.identifierHash, hash), eq(reports.status, "APPROVED")))
    .orderBy(desc(reports.createdAt))
    .limit(1);
  if (!row) return { status: "clear", type: parsed.type };
  return {
    status: "reported",
    type: parsed.type,
    match: {
      category: row.category,
      brandModel: row.brandModel,
      last4: row.identifierLast4,
      incidentType: row.incidentType,
      location: row.location,
      incidentDate: row.incidentDate,
    },
  };
}

export async function createReport(db: Db, reporterId: string, input: ReportInput, files: EvidenceFile[]) {
  const parsed = parseIdentifier(input.identifier);
  if (!parsed.ok) throw new Error(parsed.error);
  const identifierHash = lookupHash(matchKey(parsed.type, parsed.value));
  const id = trackingId();

  return db.transaction(async (tx) => {
    const [mine] = await tx
      .select({ trackingId: reports.trackingId })
      .from(reports)
      .where(and(eq(reports.identifierHash, identifierHash), eq(reports.reporterId, reporterId), inArray(reports.status, ["PENDING", "NEEDS_INFO", "APPROVED"])))
      .limit(1);
    if (mine) return { ok: false as const, error: `এই নম্বরে আপনার একটি রিপোর্ট আগেই আছে (${mine.trackingId}).` };

    const [{ others }] = await tx
      .select({ others: sql<number>`count(*)::int` })
      .from(reports)
      .where(and(eq(reports.identifierHash, identifierHash), ne(reports.reporterId, reporterId)));

    const [report] = await tx
      .insert(reports)
      .values({
        trackingId: id,
        reporterId,
        category: input.category,
        brandModel: input.brandModel,
        identifierType: parsed.type,
        identifierHash,
        identifierEncrypted: encrypt(parsed.value),
        identifierLast4: parsed.value.slice(-4),
        incidentType: input.incidentType,
        incidentDate: input.incidentDate,
        location: input.location,
        policeReference: input.policeReference,
        description: input.description,
        phoneHash: lookupHash(`PHONE:${input.phone}`),
        phoneEncrypted: encrypt(input.phone),
      })
      .returning({ id: reports.id, trackingId: reports.trackingId });

    if (files.length) {
      await tx.insert(evidence).values(
        files.map((f) => ({ reportId: report.id, fileName: f.name.slice(0, 120), mimeType: f.mimeType, size: f.data.length, data: f.data })),
      );
    }
    await tx.insert(auditLogs).values({
      actor: `reporter:${reporterId}`,
      action: "report.created",
      reportId: report.id,
      metadata: { files: files.length, otherReportsForIdentifier: others },
    });
    return { ok: true as const, trackingId: report.trackingId };
  });
}

export async function listMyReports(db: Db, reporterId: string) {
  return db
    .select({
      id: reports.id,
      trackingId: reports.trackingId,
      category: reports.category,
      brandModel: reports.brandModel,
      identifierType: reports.identifierType,
      last4: reports.identifierLast4,
      incidentType: reports.incidentType,
      incidentDate: reports.incidentDate,
      status: reports.status,
      reviewNote: reports.reviewNote,
      createdAt: reports.createdAt,
    })
    .from(reports)
    .where(eq(reports.reporterId, reporterId))
    .orderBy(desc(reports.createdAt));
}

/** Lets someone see their report on a new device using the tracking ID + the phone number they gave. */
export async function linkReportToReporter(db: Db, reporterId: string, tracking: string, phoneInput: string) {
  const phone = normalizeBdPhone(phoneInput);
  if (!phone) return false;
  const [row] = await db
    .select({ id: reports.id, phoneHash: reports.phoneHash, oldReporter: reports.reporterId })
    .from(reports)
    .where(eq(reports.trackingId, tracking.trim().toUpperCase()))
    .limit(1);
  if (!row || row.phoneHash !== lookupHash(`PHONE:${phone}`)) return false;
  await db.update(reports).set({ reporterId, updatedAt: new Date() }).where(eq(reports.id, row.id));
  await db.insert(auditLogs).values({ actor: `reporter:${reporterId}`, action: "report.linked", reportId: row.id, metadata: { from: row.oldReporter } });
  return true;
}

export async function markRecovered(db: Db, reporterId: string, reportId: string) {
  const updated = await db
    .update(reports)
    .set({ status: "RECOVERED", recoveredAt: new Date(), updatedAt: new Date() })
    .where(and(eq(reports.id, reportId), eq(reports.reporterId, reporterId), inArray(reports.status, ["PENDING", "NEEDS_INFO", "APPROVED"])))
    .returning({ id: reports.id });
  if (updated.length) await db.insert(auditLogs).values({ actor: `reporter:${reporterId}`, action: "report.recovered", reportId });
  return updated.length > 0;
}

export async function recentPublicAlerts(db: Db, limit = 6) {
  return db
    .select({
      id: reports.id,
      category: reports.category,
      brandModel: reports.brandModel,
      identifierType: reports.identifierType,
      last4: reports.identifierLast4,
      incidentType: reports.incidentType,
      location: reports.location,
      incidentDate: reports.incidentDate,
    })
    .from(reports)
    .where(eq(reports.status, "APPROVED"))
    .orderBy(desc(reports.reviewedAt))
    .limit(limit);
}

export async function registryStats(db: Db) {
  const rows = await db.select({ status: reports.status, n: sql<number>`count(*)::int` }).from(reports).groupBy(reports.status);
  const by = Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<Record<ReportStatus, number>>;
  return { pending: (by.PENDING ?? 0) + (by.NEEDS_INFO ?? 0), approved: by.APPROVED ?? 0, recovered: by.RECOVERED ?? 0 };
}

const reviewStatuses: Record<"queue" | "published" | "closed", ReportStatus[]> = {
  queue: ["PENDING", "NEEDS_INFO"],
  published: ["APPROVED"],
  closed: ["REJECTED", "RECOVERED"],
};

/** Moderator view: full identifier and phone are decrypted here and nowhere else. */
export async function listForReview(db: Db, tab: keyof typeof reviewStatuses = "queue") {
  const rows = await db
    .select()
    .from(reports)
    .where(inArray(reports.status, reviewStatuses[tab]))
    .orderBy(tab === "queue" ? asc(reports.createdAt) : desc(reports.updatedAt))
    .limit(100);
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const files = await db
    .select({ id: evidence.id, reportId: evidence.reportId, fileName: evidence.fileName, mimeType: evidence.mimeType, size: evidence.size })
    .from(evidence)
    .where(inArray(evidence.reportId, ids));
  const hashes = [...new Set(rows.map((r) => r.identifierHash))];
  const dupes = await db
    .select({ hash: reports.identifierHash, n: sql<number>`count(*)::int` })
    .from(reports)
    .where(inArray(reports.identifierHash, hashes))
    .groupBy(reports.identifierHash);
  const dupeCount = new Map(dupes.map((d) => [d.hash, d.n]));
  return rows.map((r) => ({
    id: r.id,
    trackingId: r.trackingId,
    category: r.category,
    brandModel: r.brandModel,
    identifierType: r.identifierType,
    identifier: decrypt(r.identifierEncrypted),
    incidentType: r.incidentType,
    incidentDate: r.incidentDate,
    location: r.location,
    policeReference: r.policeReference,
    description: r.description,
    phone: decrypt(r.phoneEncrypted),
    status: r.status,
    reviewNote: r.reviewNote,
    createdAt: r.createdAt,
    otherReports: (dupeCount.get(r.identifierHash) ?? 1) - 1,
    files: files.filter((f) => f.reportId === r.id),
  }));
}

export type Decision = "APPROVED" | "REJECTED" | "NEEDS_INFO";

export async function decideReport(db: Db, reportId: string, decision: Decision, note: string | null) {
  const allowedFrom: ReportStatus[] = decision === "REJECTED" ? ["PENDING", "NEEDS_INFO", "APPROVED"] : ["PENDING", "NEEDS_INFO"];
  const updated = await db
    .update(reports)
    .set({ status: decision, reviewNote: note, reviewedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(reports.id, reportId), inArray(reports.status, allowedFrom)))
    .returning({ id: reports.id });
  if (updated.length) await db.insert(auditLogs).values({ actor: "admin", action: `report.${decision.toLowerCase()}`, reportId, metadata: { note } });
  return updated.length > 0;
}

export async function getEvidenceFile(db: Db, id: string) {
  const [row] = await db.select().from(evidence).where(eq(evidence.id, id)).limit(1);
  return row ?? null;
}
