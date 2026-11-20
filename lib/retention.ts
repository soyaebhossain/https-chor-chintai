/**
 * Data retention periods. The privacy page states these and
 * `npm run data:purge` enforces them — change both together.
 * Review with a lawyer before launch.
 */
export const RETENTION = {
  /** Expired login codes and sessions are deleted after this many days. */
  expiredAuthDays: 1,
  /** Evidence files of rejected reports. The report row is kept for audit. */
  rejectedEvidenceDays: 180,
  /** Evidence files of reports whose product was marked recovered. */
  recoveredEvidenceDays: 365,
  /** Staff action history. */
  auditLogYears: 3,
} as const;

export const LEGAL_UPDATED = "২০ নভেম্বর ২০২৬";

export function contactEmail(): string | undefined {
  return process.env.NEXT_PUBLIC_CONTACT_EMAIL || undefined;
}
