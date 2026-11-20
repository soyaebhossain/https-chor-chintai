/** Evidence file rules, shared by the form (instant feedback) and the server (authoritative). */

// Hosting platforms cap a request body (Vercel: 4.5 MB), so all files of one
// submission together must stay under ~4 MB. Photos are shrunk in the browser
// first (see lib/evidence-client.ts), which keeps a receipt or GD readable at a
// few hundred KB.
export const MAX_TOTAL_BYTES = 4 * 1024 * 1024;
export const MAX_FILE_BYTES = MAX_TOTAL_BYTES;
export const MAX_FILES = 5;
export const LIMIT_LABEL = "সব ফাইল মিলিয়ে সর্বোচ্চ 4MB (ছবি স্বয়ংক্রিয়ভাবে ছোট করা হয়)";
export const ACCEPT_ATTR = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

export type EvidenceMime = "application/pdf" | "image/jpeg" | "image/png";

/** Decide the type from the file's first bytes — never trust the browser-supplied type or extension. */
export function sniffEvidenceMime(bytes: Uint8Array): EvidenceMime | null {
  const starts = (sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts([0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  return null;
}
