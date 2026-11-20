import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/lib/server/env";
import * as schema from "./schema";

type Db = PostgresJsDatabase<typeof schema>;

// Reuse one pool across dev hot reloads.
const globalForDb = globalThis as unknown as { db?: Db };

export function getDb(): Db {
  if (!globalForDb.db) {
    const client = postgres(getEnv().DATABASE_URL, { max: 10, prepare: true });
    globalForDb.db = drizzle(client, { schema });
  }
  return globalForDb.db;
}
