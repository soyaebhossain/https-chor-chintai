import { z } from "zod";
import { categories, incidentTypes } from "@/db/schema";

/** Accepts 01XXXXXXXXX, +8801XXXXXXXXX or 8801XXXXXXXXX, with spaces or dashes. */
export function normalizeBdPhone(input: string): string | null {
  let digits = input.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("880")) digits = digits.slice(2);
  return /^01[3-9]\d{8}$/.test(digits) ? digits : null;
}

const today = () => new Date().toISOString().slice(0, 10);

export const reportInput = z.object({
  category: z.enum(categories, { errorMap: () => ({ message: "পণ্যের ধরন বেছে নিন।" }) }),
  brandModel: z.string().trim().min(2, "ব্র্যান্ড ও মডেল লিখুন।").max(120),
  identifier: z.string().trim().min(1, "পরিচিতি নম্বর লিখুন।").max(64),
  incidentType: z.enum(incidentTypes, { errorMap: () => ({ message: "ঘটনার ধরন বেছে নিন।" }) }),
  incidentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "ঘটনার তারিখ দিন।")
    .refine((d) => d <= today(), "ভবিষ্যতের তারিখ দেওয়া যাবে না।"),
  location: z.string().trim().min(2, "ঘটনার এলাকা লিখুন।").max(120),
  policeReference: z.string().trim().max(80).optional().transform((v) => v || null),
  description: z.string().trim().min(20, "ঘটনার বিবরণ কমপক্ষে ২০ অক্ষরের হতে হবে।").max(2000),
  phone: z.string().transform((v, ctx) => {
    const phone = normalizeBdPhone(v);
    if (!phone) ctx.addIssue({ code: "custom", message: "সঠিক মোবাইল নম্বর দিন (যেমন 01712345678)।" });
    return phone ?? "";
  }),
  consent: z.literal("on", { errorMap: () => ({ message: "তথ্য সত্য বলে নিশ্চিত করুন।" }) }),
});

export type ReportInput = z.infer<typeof reportInput>;

export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 10 * 1024 * 1024;

/** Detect the real file type from its first bytes; the browser-sent type can't be trusted. */
export function sniffMime(bytes: Uint8Array): "application/pdf" | "image/jpeg" | "image/png" | "image/webp" | null {
  const b = bytes;
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "application/pdf";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50)
    return "image/webp";
  return null;
}
