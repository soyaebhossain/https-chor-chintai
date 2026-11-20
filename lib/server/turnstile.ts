import "server-only";
import { getEnv } from "@/lib/server/env";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Name of the hidden field Turnstile adds inside a form. */
export const TURNSTILE_FIELD = "cf-turnstile-response";

/**
 * Verifies a Cloudflare Turnstile token. Tokens are single-use and expire
 * after 5 minutes. Without TURNSTILE_SECRET_KEY the check is skipped — env.ts
 * only allows that outside production.
 */
export async function verifyTurnstile(token: unknown, ip?: string): Promise<boolean> {
  const secret = getEnv().TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (ip && ip !== "unknown") body.set("remoteip", ip);
  try {
    const res = await fetch(VERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(5000), cache: "no-store" });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (error) {
    console.error("turnstile verification failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

export const TURNSTILE_ERROR = "নিরাপত্তা যাচাই সম্পন্ন হয়নি। কয়েক সেকেন্ড অপেক্ষা করে আবার চেষ্টা করুন, না হলে পেজটি রিফ্রেশ করুন।";
