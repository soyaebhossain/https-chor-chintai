import postgres from "postgres";

/** Each run starts with empty rate-limit counters; everything else is created fresh per run. */
export default async function globalSetup() {
  try {
    process.loadEnvFile();
  } catch {
    // CI provides the environment directly.
  }
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  try {
    await sql`delete from rate_limits`;
  } finally {
    await sql.end();
  }
}
