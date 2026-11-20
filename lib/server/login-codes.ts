import "server-only";
import { randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { loginCodes } from "@/db/schema";
import { keyedHash } from "@/lib/server/crypto";
import { getEnv } from "@/lib/server/env";

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const hashCode = (email: string, code: string) => keyedHash(getEnv().IDENTIFIER_HMAC_SECRET, "login-code", `${email}:${code}`);

/** Issues a fresh 6-digit code and invalidates any earlier unused code for this email. */
export async function issueLoginCode(email: string): Promise<string> {
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.update(loginCodes).set({ consumedAt: new Date() }).where(and(eq(loginCodes.email, email), isNull(loginCodes.consumedAt)));
    await tx.insert(loginCodes).values({ email, codeHash: hashCode(email, code), expiresAt: new Date(Date.now() + CODE_TTL_MS) });
  });
  return code;
}

/** True exactly once for a correct, unexpired code; each wrong guess burns one of five attempts. */
export async function consumeLoginCode(email: string, code: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false;
  const db = getDb();
  const [row] = await db
    .update(loginCodes)
    .set({ attempts: sql`${loginCodes.attempts} + 1` })
    .where(
      eq(
        loginCodes.id,
        sql`(select id from login_codes where email = ${email} and consumed_at is null and expires_at > now() order by created_at desc limit 1)`,
      ),
    )
    .returning();
  if (!row || row.attempts > MAX_ATTEMPTS) return false;

  const expected = Buffer.from(row.codeHash, "hex");
  const given = Buffer.from(hashCode(email, code), "hex");
  if (!timingSafeEqual(expected, given)) return false;

  const consumed = await db
    .update(loginCodes)
    .set({ consumedAt: new Date() })
    .where(and(eq(loginCodes.id, row.id), isNull(loginCodes.consumedAt), gt(loginCodes.expiresAt, new Date())))
    .returning({ id: loginCodes.id });
  return consumed.length === 1;
}

/** How many codes were sent to this email in the last hour (anti-spam). */
export async function recentCodeCount(email: string): Promise<number> {
  const rows = await getDb()
    .select({ id: loginCodes.id })
    .from(loginCodes)
    .where(and(eq(loginCodes.email, email), gt(loginCodes.createdAt, new Date(Date.now() - 60 * 60 * 1000))))
    .orderBy(desc(loginCodes.createdAt))
    .limit(10);
  return rows.length;
}
