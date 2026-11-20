/**
 * Grant or revoke reviewer/admin access. Run on the server with production env:
 *
 *   npm run user:role -- someone@example.com ADMIN
 *   npm run user:role -- someone@example.com USER
 *
 * The user is created if they have never logged in. Their existing sessions
 * are ended so the new role (and the MFA requirement) applies immediately.
 */
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../db/schema";
import { getEnv } from "../lib/server/env";

const [emailArg, roleArg] = process.argv.slice(2);
const ROLES = ["USER", "REVIEWER", "ADMIN"] as const;
const role = roleArg?.toUpperCase() as (typeof ROLES)[number];
if (!emailArg || !ROLES.includes(role)) {
  console.error("Usage: npm run user:role -- <email> <USER|REVIEWER|ADMIN>");
  process.exit(1);
}
const email = emailArg.trim().toLowerCase();

const client = postgres(getEnv().DATABASE_URL, { max: 1 });
const db = drizzle(client, { schema });
try {
  await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(schema.users)
      .values({ email, role })
      .onConflictDoUpdate({ target: schema.users.email, set: { role } })
      .returning({ id: schema.users.id });
    await tx.delete(schema.sessions).where(eq(schema.sessions.userId, user.id));
    await tx.insert(schema.auditLogs).values({ actorId: null, action: "ROLE_SET", entityType: "user", entityId: user.id, metadata: { role, via: "cli" } });
  });
  console.log(`${email} is now ${role}.${role !== "USER" ? " They will be asked to set up an authenticator app at next login." : ""}`);
} finally {
  await client.end();
}
