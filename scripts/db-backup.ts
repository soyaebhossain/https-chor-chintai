/**
 * Writes a compressed logical backup of the whole database to backups/.
 *
 *   npm run db:backup                 (needs pg_dump on PATH)
 *   npm run db:backup -- --docker     (uses the docker-compose postgres container)
 *
 * Identifiers and evidence are encrypted, so a backup is useless without
 * FIELD_ENCRYPTION_KEY and IDENTIFIER_HMAC_SECRET — store those separately.
 */
import { mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { getEnv } from "../lib/server/env";
import { runPgTool, urlForTool } from "./pg-tools";

const dir = path.resolve("backups");
mkdirSync(dir, { recursive: true });
const file = path.join(dir, `registry-${new Date().toISOString().replace(/[:.]/g, "-")}.dump`);

await runPgTool("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", urlForTool(getEnv().DATABASE_URL)], { stdoutFile: file });
const size = statSync(file).size;
if (size < 1024) throw new Error(`Backup looks empty (${size} bytes): ${file}`);
console.log(`Backup written: ${file} (${(size / 1024).toFixed(0)} KB)`);
