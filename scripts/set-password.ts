/**
 * Reset a user's password (there is no self-service reset until email is set up).
 * Prints a new random password to give to the person; their sessions are ended.
 *
 *   npm run user:password -- someone@example.com
 */
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../db/schema";
import { getEnv } from "../lib/server/env";
import { hashPassword } from "../lib/server/password";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run user:password -- <email>");
  process.exit(1);
}
const client = postgres(getEnv().DATABASE_URL, { max: 1 });
const db = drizzle(client, { schema });
try {
  const [user] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email));
  if (!user) {
    console.error(`No account for ${email}.`);
    process.exit(1);
  }
  // Readable but strong: 4 groups of 4 from an unambiguous alphabet (~80 bits).
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const password = Array.from({ length: 4 }, () => Array.from(randomBytes(4), (b) => alphabet[b % alphabet.length]).join("")).join("-");
  await db.transaction(async (tx) => {
    await tx.update(schema.users).set({ passwordHash: await hashPassword(password) }).where(eq(schema.users.id, user.id));
    await tx.delete(schema.sessions).where(eq(schema.sessions.userId, user.id));
    await tx.insert(schema.auditLogs).values({ actorId: null, action: "PASSWORD_RESET", entityType: "user", entityId: user.id, metadata: { via: "cli" } });
  });
  console.log(`New password for ${email}: ${password}\nShare it privately; they should change it after logging in.`);
} finally {
  await client.end();
}
