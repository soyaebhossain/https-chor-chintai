import "server-only";
import { cookies, headers } from "next/headers";
import { getDb } from "@/db";
import { reporters } from "@/db/schema";
import { sign, verify } from "./crypto";

const REPORTER_COOKIE = "cc_reporter";
const ADMIN_COOKIE = "cc_admin";
const YEAR = 60 * 60 * 24 * 365;
const ADMIN_TTL = 60 * 60 * 8;

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

/** Reporter id from the signed cookie, or null when this browser has not reported yet. */
export async function currentReporterId(): Promise<string | null> {
  const jar = await cookies();
  return verify(jar.get(REPORTER_COOKIE)?.value);
}

/** Returns the reporter id, creating an anonymous reporter + cookie if needed. Server actions only. */
export async function ensureReporterId(): Promise<string> {
  const existing = await currentReporterId();
  if (existing) return existing;
  const db = await getDb();
  const [row] = await db.insert(reporters).values({}).returning({ id: reporters.id });
  (await cookies()).set(REPORTER_COOKIE, sign(row.id), { ...cookieBase, maxAge: YEAR });
  return row.id;
}

export async function isAdmin(): Promise<boolean> {
  const payload = verify((await cookies()).get(ADMIN_COOKIE)?.value);
  if (!payload?.startsWith("admin:")) return false;
  return Number(payload.slice(6)) > Date.now();
}

export async function startAdminSession() {
  const expires = Date.now() + ADMIN_TTL * 1000;
  (await cookies()).set(ADMIN_COOKIE, sign(`admin:${expires}`), { ...cookieBase, sameSite: "strict", maxAge: ADMIN_TTL });
}

export async function endAdminSession() {
  (await cookies()).delete(ADMIN_COOKIE);
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
