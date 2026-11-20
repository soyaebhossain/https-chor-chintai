import { describe, expect, it } from "vitest";
import { disputeSchema, reportSchema } from "@/lib/report-schema";

const base = {
  category: "মোবাইল ও ট্যাব",
  brand: "Samsung",
  model: "S25",
  identifier: "356938035643809",
  incidentType: "ROBBERY",
  incidentDate: "2026-11-01",
  location: "মিরপুর, ঢাকা",
  description: "সন্ধ্যায় ফেরার পথে ফোনটি ছিনিয়ে নেওয়া হয়।",
  attest: "on",
};

describe("reportSchema", () => {
  it("accepts a minimal valid report and drops an empty second number", () => {
    const r = reportSchema.safeParse({ ...base, identifier2: "  " });
    expect(r.success).toBe(true);
    expect(r.success && r.data.identifier2).toBeUndefined();
  });

  it("validates the second IMEI too", () => {
    const r = reportSchema.safeParse({ ...base, identifier2: "356938035643808" });
    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues[0].path).toEqual(["identifier2"]);
  });

  it("rejects the same number twice", () => {
    const r = reportSchema.safeParse({ ...base, identifier2: "35 693803 564380 9" });
    expect(!r.success && r.error.issues[0].message).toMatch(/দুটি নম্বর একই/);
  });

  it("rejects future dates and a missing attestation", () => {
    expect(reportSchema.safeParse({ ...base, incidentDate: "2099-01-01" }).success).toBe(false);
    expect(reportSchema.safeParse({ ...base, attest: undefined }).success).toBe(false);
  });
});

describe("disputeSchema", () => {
  it("needs a reason and real detail", () => {
    expect(disputeSchema.safeParse({ identifier: "356938035643809", reason: "অন্যান্য", details: "short", attest: "on" }).success).toBe(false);
    expect(disputeSchema.safeParse({ identifier: "356938035643809", reason: "অন্যান্য", details: "আমি ১০ অক্টোবর একটি দোকান থেকে রসিদসহ কিনেছি।", attest: "on" }).success).toBe(true);
  });
});
