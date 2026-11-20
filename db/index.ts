import "server-only";
import path from "node:path";
import { env } from "@/lib/env";
import * as schema from "./schema";

import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const migrationsFolder = path.join(process.cwd(), "drizzle");

// Survive Next.js dev hot reloads without opening a new connection each time.
const globalForDb = globalThis as unknown as { __db?: Promise<Db> };

/**
 * PostgreSQL when DATABASE_URL is set; otherwise an embedded PGlite database in
 * PGLITE_DIR so `npm run dev` works with zero setup. Migrations run on first use.
 */
export function getDb(): Promise<Db> {
  globalForDb.__db ??= connect().catch((error) => {
    globalForDb.__db = undefined;
    throw error;
  });
  return globalForDb.__db;
}

async function connect(): Promise<Db> {
  const { DATABASE_URL, PGLITE_DIR } = env();
  if (DATABASE_URL) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const db = drizzle(postgres(DATABASE_URL, { max: 10 }), { schema });
    await migrate(db, { migrationsFolder });
    return db as unknown as Db;
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = PGLITE_DIR === "memory" ? new PGlite() : new PGlite(path.resolve(PGLITE_DIR));
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  return db as unknown as Db;
}
