import type { Category, IncidentType, ReportStatus } from "@/db/schema";

export const categoryLabels: Record<Category, string> = {
  MOBILE: "মোবাইল / ট্যাব",
  LAPTOP: "ল্যাপটপ",
  MOTORBIKE: "মোটরবাইক",
  CAR: "গাড়ি",
  CAMERA: "ক্যামেরা",
  OTHER: "অন্যান্য",
};

export const incidentLabels: Record<IncidentType, string> = {
  THEFT: "চুরি",
  SNATCHING: "ছিনতাই",
  LOST: "হারানো",
};

export const statusLabels: Record<ReportStatus, { label: string; tone: string; help: string }> = {
  PENDING: { label: "যাচাই চলছে", tone: "bg-amber-100 text-amber-800", help: "একজন যাচাইকারী আপনার প্রমাণ দেখছেন। সাধারণত ১–২ কর্মদিবস লাগে।" },
  NEEDS_INFO: { label: "আরও তথ্য দরকার", tone: "bg-orange-100 text-orange-800", help: "যাচাইকারীর নোট দেখুন।" },
  APPROVED: { label: "প্রকাশিত", tone: "bg-red-100 text-red-800", help: "এই নম্বর খুঁজলে এখন সতর্কতা দেখাবে।" },
  REJECTED: { label: "প্রত্যাখ্যাত", tone: "bg-slate-200 text-slate-700", help: "যাচাইকারীর নোট দেখুন।" },
  RECOVERED: { label: "উদ্ধার হয়েছে", tone: "bg-emerald-100 text-emerald-800", help: "সার্চে আর সতর্কতা দেখাবে না।" },
};

export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(`${value}T00:00:00`) : value;
  return new Intl.DateTimeFormat("bn-BD", { day: "numeric", month: "long", year: "numeric" }).format(date);
}
