import { z } from "zod";
import { classifyForReport, IDENTIFIER_ERROR_MESSAGES, type ProductKind } from "@/lib/identifiers";

export const CATEGORIES = ["মোবাইল ও ট্যাব", "গাড়ি", "মোটরবাইক", "ল্যাপটপ", "ক্যামেরা", "অন্যান্য"] as const;
export type Category = (typeof CATEGORIES)[number];

export const KIND_OF: Record<Category, ProductKind> = {
  "মোবাইল ও ট্যাব": "phone",
  "গাড়ি": "vehicle",
  "মোটরবাইক": "vehicle",
  "ল্যাপটপ": "other",
  "ক্যামেরা": "other",
  "অন্যান্য": "other",
};

/** Per-category wording so the owner knows exactly which number to type and where to find it. */
export const NUMBER_HELP: Record<ProductKind, { first: string; firstHint: string; second: string; secondHint: string }> = {
  phone: {
    first: "IMEI নম্বর",
    firstHint: "ফোনে *#06# ডায়াল করুন, অথবা বক্স/রসিদে দেখুন। ১৫ অঙ্ক।",
    second: "দ্বিতীয় IMEI (ডুয়াল সিম হলে)",
    secondHint: "ডুয়াল সিম ফোনে দুটি IMEI থাকে—দুটিই দিলে যেকোনোটি দিয়ে খুঁজলে পাওয়া যাবে।",
  },
  vehicle: {
    first: "চেসিস নম্বর / VIN",
    firstHint: "রেজিস্ট্রেশন কাগজ (ব্লু বুক/স্মার্ট কার্ড) বা গাড়ির ফ্রেমে খোদাই করা থাকে।",
    second: "ইঞ্জিন নম্বর (ঐচ্ছিক)",
    secondHint: "রেজিস্ট্রেশন কাগজে চেসিস নম্বরের পাশেই থাকে।",
  },
  other: {
    first: "Serial নম্বর / Service Tag",
    firstHint: "পণ্যের নিচে বা পেছনের স্টিকারে, বক্সে বা রসিদে থাকে।",
    second: "অন্য কোনো নম্বর (ঐচ্ছিক)",
    secondHint: "যেমন বডি সিরিয়াল ও লেন্স সিরিয়াল আলাদা হলে।",
  },
};

export const INCIDENT_TYPES = ["THEFT", "ROBBERY", "LOST"] as const;
export const INCIDENT_LABEL: Record<(typeof INCIDENT_TYPES)[number], string> = { THEFT: "চুরি", ROBBERY: "ছিনতাই", LOST: "হারানো" };
export const IDENTIFIER_LABEL = { IMEI: "IMEI", SERIAL: "Serial", VIN: "VIN / Chassis", SERVICE_TAG: "Service Tag" } as const;

const text = (min: number, max: number, label: string) =>
  z.string().trim().min(min, `${label} কমপক্ষে ${min.toLocaleString("bn-BD")} অক্ষরের হতে হবে।`).max(max, `${label} সর্বোচ্চ ${max.toLocaleString("bn-BD")} অক্ষরের হতে পারে।`);

export const reportSchema = z
  .object({
    category: z.enum(CATEGORIES, { errorMap: () => ({ message: "পণ্যের ধরন বেছে নিন।" }) }),
    brand: text(1, 60, "ব্র্যান্ড"),
    model: text(1, 80, "মডেল"),
    identifier: z.string().max(128),
    identifier2: z.string().max(128).optional().transform((v) => (v && v.trim() ? v : undefined)),
    incidentType: z.enum(INCIDENT_TYPES, { errorMap: () => ({ message: "কী ঘটেছে বেছে নিন।" }) }),
    incidentDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "ঘটনার তারিখ দিন।")
      .refine((d) => {
        const t = Date.parse(`${d}T00:00:00Z`);
        return !Number.isNaN(t) && t >= Date.parse("2000-01-01T00:00:00Z") && t <= Date.now() + 24 * 3600 * 1000;
      }, "তারিখটি সঠিক নয় (ভবিষ্যতের তারিখ দেওয়া যাবে না)।"),
    location: text(3, 120, "ঘটনার স্থান"),
    policeReference: z.string().trim().max(60, "জিডি নম্বর সর্বোচ্চ ৬০ অক্ষরের হতে পারে।").optional().transform((v) => v || undefined),
    description: text(20, 2000, "ঘটনার বিবরণ"),
    attest: z.literal("on", { errorMap: () => ({ message: "তথ্য সত্য বলে নিশ্চিত করতে হবে।" }) }),
  })
  .superRefine((v, ctx) => {
    const issues = identifierIssues(v.category, v.identifier, v.identifier2);
    for (const [path, message] of Object.entries(issues)) ctx.addIssue({ code: "custom", path: [path], message });
  });

/**
 * Number checks for the report form. Exported separately because zod only runs the object-level
 * refine once every other field is valid — the action calls this directly so a wrong IMEI is
 * reported straight away, not only after the rest of the form is fixed.
 */
export function identifierIssues(category: unknown, identifier: unknown, identifier2: unknown): { identifier?: string; identifier2?: string } {
  const kind = (CATEGORIES as readonly unknown[]).includes(category) ? KIND_OF[category as Category] : "other";
  const out: { identifier?: string; identifier2?: string } = {};
  if (typeof identifier !== "string") return out;
  const first = classifyForReport(kind, identifier);
  if (!first.ok) out.identifier = IDENTIFIER_ERROR_MESSAGES[first.error];
  if (typeof identifier2 === "string" && identifier2.trim()) {
    const second = classifyForReport(kind, identifier2);
    if (!second.ok) out.identifier2 = IDENTIFIER_ERROR_MESSAGES[second.error];
    // Compare the resolved numbers, so "35…80" (14 digits) and "35…809" count as the same IMEI.
    else if (first.ok && second.value === first.value) out.identifier2 = "দুটি নম্বর একই—দ্বিতীয়টি খালি রাখুন বা আলাদা নম্বর দিন।";
  }
  return out;
}

export type ReportInput = z.infer<typeof reportSchema>;
export type FieldErrors = Partial<Record<keyof ReportInput | "evidence", string>>;

export const DISPUTE_REASONS = [
  "আমি পণ্যটি বৈধভাবে কিনেছি",
  "এটি আমার নিজের পণ্য, চুরি হয়নি",
  "রিপোর্টের নম্বর ভুল / অন্য পণ্যের",
  "অন্যান্য",
] as const;

export const disputeSchema = z.object({
  identifier: z.string().max(128),
  reason: z.enum(DISPUTE_REASONS, { errorMap: () => ({ message: "আপত্তির কারণ বেছে নিন।" }) }),
  details: text(30, 2000, "বিস্তারিত"),
  attest: z.literal("on", { errorMap: () => ({ message: "তথ্য সত্য বলে নিশ্চিত করতে হবে।" }) }),
});
export type DisputeInput = z.infer<typeof disputeSchema>;
export type DisputeFieldErrors = Partial<Record<keyof DisputeInput | "evidence", string>>;
