/**
 * Enforces the retention periods in lib/retention.ts (the privacy page states
 * the same numbers). Run once a day from a scheduler:
 *
 *   npm run data:purge
 *   npm run data:purge -- --dry-run     (only report what would be deleted)
 */
import postgres from "postgres";
import { deleteEvidence } from "../lib/server/storage";
import { getEnv } from "../lib/server/env";
import { RETENTION } from "../lib/retention";

const dryRun = process.argv.includes("--dry-run");
const sql = postgres(getEnv().DATABASE_URL, { max: 1 });

async function count(label: string, query: Promise<{ count: number }[]>) {
  const [{ count: n }] = await query;
  console.log(`${dryRun ? "would delete" : "deleted"} ${n} ${label}`);
}

try {
  const authDays = RETENTION.expiredAuthDays;
  if (dryRun) {
    await count("expired login codes", sql`select count(*)::int from login_codes where expires_at < now() - make_interval(days => ${authDays})`);
    await count("expired sessions", sql`select count(*)::int from sessions where expires_at < now() - make_interval(days => ${authDays})`);
    await count("old rate-limit windows", sql`select count(*)::int from rate_limits where window_start < now() - interval '1 day'`);
    await count("audit log entries", sql`select count(*)::int from audit_logs where created_at < now() - make_interval(years => ${RETENTION.auditLogYears})`);
  } else {
    await count("expired login codes", sql`with d as (delete from login_codes where expires_at < now() - make_interval(days => ${authDays}) returning 1) select count(*)::int from d`);
    await count("expired sessions", sql`with d as (delete from sessions where expires_at < now() - make_interval(days => ${authDays}) returning 1) select count(*)::int from d`);
    await count("old rate-limit windows", sql`with d as (delete from rate_limits where window_start < now() - interval '1 day' returning 1) select count(*)::int from d`);
    await count("audit log entries", sql`with d as (delete from audit_logs where created_at < now() - make_interval(years => ${RETENTION.auditLogYears}) returning 1) select count(*)::int from d`);
  }

  // Evidence of rejected reports, and of reports whose product came back.
  const docs = await sql<{ id: string; claim_id: string; storage_key: string; reason: string }[]>`
    select d.id, d.claim_id, d.storage_key, 'rejected' as reason
      from claim_documents d join claims c on c.id = d.claim_id
     where c.review_status = 'REJECTED' and c.reviewed_at < now() - make_interval(days => ${RETENTION.rejectedEvidenceDays})
    union
    select d.id, d.claim_id, d.storage_key, 'recovered' as reason
      from claim_documents d join recoveries r on r.claim_id = d.claim_id
     where r.recovered_at < now() - make_interval(days => ${RETENTION.recoveredEvidenceDays})
  `;
  let removed = 0;
  for (const doc of docs) {
    if (dryRun) continue;
    try {
      await deleteEvidence(doc.storage_key);
      await sql.begin(async (tx) => {
        await tx`delete from claim_documents where id = ${doc.id}`;
        await tx`insert into audit_logs (action, entity_type, entity_id, metadata) values ('EVIDENCE_PURGED', 'claim', ${doc.claim_id}, ${sql.json({ documentId: doc.id, reason: doc.reason })})`;
      });
      removed++;
    } catch (error) {
      console.error(`could not purge document ${doc.id}:`, error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  }
  console.log(`${dryRun ? "would delete" : "deleted"} ${dryRun ? docs.length : removed} evidence files`);
} finally {
  await sql.end();
}
