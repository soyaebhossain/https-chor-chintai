/**
 * Proves a backup can actually be restored: loads it into a throw-away
 * database, checks every table and row count against the live database,
 * decrypts a stored identifier with the current key, then drops the copy.
 *
 *   npm run db:restore-test                          (latest file in backups/)
 *   npm run db:restore-test -- backups/x.dump --docker
 *   add --allow-drift when the live database has changed since the backup
 */
import { readdirSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { decryptField } from "../lib/server/crypto";
import { getEnv } from "../lib/server/env";
import { runPgTool, urlForTool } from "./pg-tools";

const env = getEnv();
const allowDrift = process.argv.includes("--allow-drift");
const file = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? latestBackup();
const tempDb = `restore_check_${Date.now()}`;
const liveUrl = new URL(env.DATABASE_URL);
const tempUrl = new URL(env.DATABASE_URL);
tempUrl.pathname = `/${tempDb}`;

function latestBackup(): string {
  const files = readdirSync("backups").filter((f) => f.endsWith(".dump")).sort();
  if (!files.length) throw new Error("No backups/*.dump found. Run npm run db:backup first.");
  return path.join("backups", files.at(-1)!);
}

const admin = postgres(liveUrl.toString(), { max: 1 });
let failed = false;
try {
  console.log(`Restoring ${file} into ${tempDb}…`);
  await admin.unsafe(`create database "${tempDb}"`);
  await runPgTool("pg_restore", ["--no-owner", "--no-privileges", "--exit-on-error", `--dbname=${urlForTool(tempUrl.toString())}`], { stdinFile: file });

  const restored = postgres(tempUrl.toString(), { max: 1 });
  try {
    const tables = await admin<{ table_name: string }[]>`select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`;
    console.log("table".padEnd(24), "live".padStart(8), "restored".padStart(9));
    for (const { table_name: t } of tables) {
      const [{ n: live }] = await admin.unsafe<{ n: number }[]>(`select count(*)::int as n from "${t}"`);
      let copy: number | null = null;
      try {
        [{ n: copy }] = await restored.unsafe<{ n: number }[]>(`select count(*)::int as n from "${t}"`);
      } catch {
        copy = null;
      }
      const ok = copy !== null && (copy === live || (allowDrift && t !== "__drizzle_migrations"));
      if (!ok) failed = true;
      console.log(t.padEnd(24), String(live).padStart(8), String(copy ?? "MISSING").padStart(9), ok ? "" : "  ✗");
    }

    const [sample] = await restored<{ value_encrypted: string }[]>`select value_encrypted from product_identifiers limit 1`;
    if (sample) {
      try {
        decryptField(env.FIELD_ENCRYPTION_KEY, sample.value_encrypted);
        console.log("Encrypted identifier decrypts with the current FIELD_ENCRYPTION_KEY ✓");
      } catch {
        failed = true;
        console.error("✗ Restored identifiers cannot be decrypted with the current FIELD_ENCRYPTION_KEY.");
      }
    }
  } finally {
    await restored.end();
  }
} finally {
  await admin.unsafe(`drop database if exists "${tempDb}" with (force)`).catch(() => {});
  await admin.end();
}

if (failed) {
  console.error("Restore test FAILED.");
  process.exit(1);
}
console.log("Restore test passed.");
