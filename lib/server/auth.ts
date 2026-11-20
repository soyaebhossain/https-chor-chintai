import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db";
import { sessions, users } from "@/db/schema";
import { safeNextPath } from "@/lib/safe-path";

const isProd = process.env.NODE_ENV === "production";
// __Host- cookies must be Secure, path=/ and have no Domain: they cannot be set or overwritten by a subdomain.
const COOKIE = isProd ? "__Host-cc_session" : "cc_session";
const USER_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const STAFF_TTL_MS = 12 * 60 * 60 * 1000;

export type Role = "USER" | "REVIEWER" | "ADMIN";
export type SessionUser = { id: string; email: string | null; displayName: string | null; role: Role; mfaEnabled: boolean };
export type Session = { id: string; user: SessionUser; mfaVerified: boolean };

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const isStaff = (role: Role) => role === "REVIEWER" || role === "ADMIN";

export async function createSession(userId: string, role: Role): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + (isStaff(role) ? STAFF_TTL_MS : USER_TTL_MS));
  const db = getDb();
  await db.insert(sessions).values({ tokenHash: hashToken(token), userId, expiresAt });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: isProd, sameSite: "lax", path: "/", expires: expiresAt });
}

/** The current session, read once per request. Role and MFA state come live from the users table. */
export const getSession = cache(async (): Promise<Session | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [row] = await getDb()
    .select({
      id: sessions.id,
      mfaVerifiedAt: sessions.mfaVerifiedAt,
      userId: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      mfaEnabledAt: users.mfaEnabledAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    mfaVerified: row.mfaVerifiedAt !== null,
    user: { id: row.userId, email: row.email, displayName: row.displayName, role: row.role, mfaEnabled: row.mfaEnabledAt !== null },
  };
});

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await getDb().delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  store.delete(COOKIE);
}

export async function markSessionMfaVerified(sessionId: string): Promise<void> {
  await getDb().update(sessions).set({ mfaVerifiedAt: new Date() }).where(eq(sessions.id, sessionId));
}

export async function requireUser(returnTo: string): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(safeNextPath(returnTo))}`);
  return session;
}

/**
 * Reviewers and admins must have TOTP enrolled and verified in this session.
 * Everyone else gets a plain 404 so the moderation surface is not advertised.
 */
export async function requireStaff(returnTo: string): Promise<Session> {
  const session = await requireUser(returnTo);
  if (!isStaff(session.user.role)) notFound();
  if (!session.user.mfaEnabled || !session.mfaVerified) {
    redirect(`/account/mfa?next=${encodeURIComponent(safeNextPath(returnTo))}`);
  }
  return session;
}
