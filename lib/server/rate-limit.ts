import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { keyedHash } from "@/lib/server/crypto";
import { getEnv } from "@/lib/server/env";

export type RateLimitResult = { ok: boolean; retryAfterSeconds: number };

/**
 * Fixed-window counter in PostgreSQL, so the limit holds across every app
 * instance without Redis. `subject` (an IP, an email) is hashed before it is
 * used as a key, so the table never holds personal data.
 */
export async function rateLimit(bucket: string, subject: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const key = `${bucket}:${keyedHash(getEnv().IDENTIFIER_HMAC_SECRET, "rate-limit", subject).slice(0, 40)}`;
  const db = getDb();
  const rows = await db.execute<{ count: number; retry_after: number }>(sql`
    insert into rate_limits (key, window_start, count) values (${key}, now(), 1)
    on conflict (key) do update set
      count = case when rate_limits.window_start <= now() - make_interval(secs => ${windowSeconds}) then 1 else rate_limits.count + 1 end,
      window_start = case when rate_limits.window_start <= now() - make_interval(secs => ${windowSeconds}) then now() else rate_limits.window_start end
    returning count, greatest(1, ceil(extract(epoch from (window_start + make_interval(secs => ${windowSeconds}) - now()))))::int as retry_after
  `);
  // Occasionally sweep expired windows so the table stays small.
  if (Math.random() < 0.01) await db.execute(sql`delete from rate_limits where window_start < now() - interval '1 day'`);
  const row = rows[0];
  return { ok: row.count <= limit, retryAfterSeconds: row.retry_after };
}

let warnedMissingIp = false;

/**
 * Client IP from the ONE header our proxy is configured to set
 * (CLIENT_IP_HEADER). Any other IP header is ignored, so a client cannot
 * dodge the limit by sending its own X-Real-IP or CF-Connecting-IP.
 * For X-Forwarded-For we take the right-most entry: the one appended by our
 * own proxy, not one a client could have forged.
 */
export function clientIp(headers: Headers, header: string = getEnv().CLIENT_IP_HEADER): string {
  const value = headers.get(header);
  if (!value) {
    // Every such request shares one bucket — safe against scraping, but legitimate users will be throttled together.
    if (process.env.NODE_ENV === "production" && !warnedMissingIp) {
      warnedMissingIp = true;
      console.warn(`rate-limit: request has no ${header} header. Put the app behind a proxy that sets it, or change CLIENT_IP_HEADER.`);
    }
    return "unknown";
  }
  return header === "x-forwarded-for" ? value.split(",").at(-1)!.trim() : value.trim();
}

export function formatRetry(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  return minutes <= 1 ? "১ মিনিট" : `${minutes.toLocaleString("bn-BD")} মিনিট`;
}
