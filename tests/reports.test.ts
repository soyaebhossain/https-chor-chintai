import { beforeAll, describe, expect, it } from "vitest";
import { getDb, type Db } from "@/db";
import { reporters } from "@/db/schema";
import { decrypt } from "@/lib/crypto";
import {
  createReport,
  decideReport,
  linkReportToReporter,
  listForReview,
  listMyReports,
  markRecovered,
  recentPublicAlerts,
  searchRegistry,
} from "@/lib/reports";
import { reportInput } from "@/lib/validation";

let db: Db;
const newReporter = async () => (await db.insert(reporters).values({}).returning())[0].id;
const input = (overrides: Record<string, string> = {}) =>
  reportInput.parse({
    category: "MOBILE",
    brandModel: "Samsung Galaxy S24",
    identifier: "35-693803-564380-9",
    incidentType: "SNATCHING",
    incidentDate: "2026-11-10",
    location: "ধানমন্ডি, ঢাকা",
    policeReference: "ধানমন্ডি থানা জিডি ১২৩",
    description: "রাত ৯টায় রিকশা থেকে ফোনটি ছিনিয়ে নেওয়া হয়।",
    phone: "01712345678",
    consent: "on",
    ...overrides,
  });

beforeAll(async () => {
  db = await getDb();
});

describe("report lifecycle", () => {
  it("shows a submitted report in the reporter's own list right away", async () => {
    const me = await newReporter();
    const result = await createReport(db, me, input(), [{ name: "receipt.pdf", mimeType: "application/pdf", data: Buffer.from("%PDF-1.4") }]);
    expect(result.ok).toBe(true);
    const mine = await listMyReports(db, me);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ status: "PENDING", last4: "3809", identifierType: "IMEI" });
    expect(await listMyReports(db, await newReporter())).toHaveLength(0);
  });

  it("only matches in public search after a moderator approves", async () => {
    const me = await newReporter();
    await createReport(db, me, input({ identifier: "490154203237518" }), []);
    expect(await searchRegistry(db, "490154203237518")).toMatchObject({ status: "clear" });

    const [queued] = (await listForReview(db, "queue")).filter((r) => r.identifier === "490154203237518");
    expect(queued.phone).toBe("01712345678");
    expect(await decideReport(db, queued.id, "APPROVED", null)).toBe(true);

    const hit = await searchRegistry(db, "4901 5420 3237 518");
    expect(hit).toMatchObject({ status: "reported", match: { last4: "7518", location: "ধানমন্ডি, ঢাকা" } });
    expect(JSON.stringify(hit)).not.toContain("490154203237518");
    expect((await recentPublicAlerts(db)).some((a) => a.last4 === "7518")).toBe(true);

    expect(await markRecovered(db, me, queued.id)).toBe(true);
    expect(await searchRegistry(db, "490154203237518")).toMatchObject({ status: "clear" });
  });

  it("stores identifiers and phone numbers encrypted", async () => {
    const me = await newReporter();
    await createReport(db, me, input({ identifier: "1HGCM82633A004352", category: "CAR" }), []);
    const { reports } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(reports).where(eq(reports.reporterId, me));
    expect(row.identifierEncrypted).not.toContain("1HGCM82633A004352");
    expect(decrypt(row.identifierEncrypted)).toBe("1HGCM82633A004352");
    expect(row.phoneEncrypted).not.toContain("01712345678");
  });

  it("blocks the same reporter from reporting the same number twice", async () => {
    const me = await newReporter();
    await createReport(db, me, input({ identifier: "SN-DUP-12345" }), []);
    const again = await createReport(db, me, input({ identifier: "sndup12345" }), []);
    expect(again.ok).toBe(false);
  });

  it("flags reports when someone else already reported the same number", async () => {
    await createReport(db, await newReporter(), input({ identifier: "SHARED-9999" }), []);
    await createReport(db, await newReporter(), input({ identifier: "SHARED-9999" }), []);
    const flagged = (await listForReview(db, "queue")).filter((r) => r.identifier === "SHARED9999");
    expect(flagged.map((r) => r.otherReports)).toEqual([1, 1]);
  });

  it("lets a reporter open their report on a new device with tracking ID + phone", async () => {
    const me = await newReporter();
    const created = await createReport(db, me, input({ identifier: "LAPTOP-SERIAL-77" }), []);
    if (!created.ok) throw new Error("expected report");
    const other = await newReporter();
    expect(await linkReportToReporter(db, other, created.trackingId, "01800000000")).toBe(false);
    expect(await linkReportToReporter(db, other, created.trackingId.toLowerCase(), "+8801712345678")).toBe(true);
    expect(await listMyReports(db, other)).toHaveLength(1);
  });

  it("does not let one reporter change another reporter's report", async () => {
    const owner = await newReporter();
    await createReport(db, owner, input({ identifier: "OWNED-4242" }), []);
    const [report] = await listMyReports(db, owner);
    expect(await markRecovered(db, await newReporter(), report.id)).toBe(false);
  });
});
