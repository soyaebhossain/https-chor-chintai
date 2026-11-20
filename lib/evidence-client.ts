/**
 * Browser-side preparation of evidence files before upload. Phone photos are
 * often 3–8 MB; re-encoding them to JPEG at a sensible size keeps text on a
 * receipt or GD legible while fitting the request-size limit and saving the
 * user's mobile data. PDFs are sent as-is.
 */
import { startTransition } from "react";
import { MAX_FILES, MAX_TOTAL_BYTES } from "@/lib/evidence";

const MAX_EDGE = 2000; // px — enough to read a printed receipt
const QUALITY = 0.82;
const SKIP_BELOW = 500 * 1024; // already small: leave untouched

async function shrinkImage(file: File): Promise<File> {
  if (!/^image\/(jpeg|png)$/.test(file.type) || file.size <= SKIP_BELOW) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#fff"; // PNG transparency → white, not black
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.(png|jpe?g)$/i, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // the server still validates type and size
  }
}

export type Prepared = { ok: true; files: File[] } | { ok: false; error: string };

/** `kept` are files prepared earlier (not re-encoded again); `added` are new picks. */
export async function prepareEvidence(added: File[], kept: File[] = []): Promise<Prepared> {
  const real = added.filter((f) => f.size > 0);
  if (kept.length + real.length > MAX_FILES) return { ok: false, error: `সর্বোচ্চ ${MAX_FILES.toLocaleString("bn-BD")}টি ফাইল দেওয়া যাবে।` };
  const prepared = [...kept, ...(await Promise.all(real.map(shrinkImage)))];
  const total = prepared.reduce((n, f) => n + f.size, 0);
  if (total > MAX_TOTAL_BYTES) {
    const big = prepared.find((f) => f.type === "application/pdf" && f.size > MAX_TOTAL_BYTES / 2);
    return {
      ok: false,
      error: big
        ? `"${big.name}" PDF-টি অনেক বড়। ফোন দিয়ে পাতাটির ছবি তুলে দিন—ছবি স্বয়ংক্রিয়ভাবে ছোট হয়ে যাবে।`
        : "সব ফাইল মিলিয়ে 4MB-এর বেশি হয়ে গেছে। কম ফাইল দিন।",
    };
  }
  return { ok: true, files: prepared };
}

/** For forms with a plain file input: shrink the photos, then hand the data to a server action. */
export async function submitWithEvidence(data: FormData, action: (d: FormData) => void) {
  const picked = data.getAll("evidence").filter((f): f is File => f instanceof File && f.size > 0);
  const prepared = await prepareEvidence(picked);
  data.delete("evidence");
  // On a size problem send the originals: the server returns the precise error message.
  (prepared.ok ? prepared.files : picked).forEach((f) => data.append("evidence", f));
  startTransition(() => action(data));
}
