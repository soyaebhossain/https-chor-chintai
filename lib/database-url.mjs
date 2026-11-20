/**
 * Where the PostgreSQL connection string comes from. DATABASE_URL wins; the
 * fallbacks cover the Vercel ↔ Neon integration when it was connected with a
 * custom prefix (e.g. "NEON" → NEON_URL) because an older, empty
 * DATABASE_URL already existed on the project.
 *
 * @param {Record<string, string | undefined>} env
 * @param {{ direct?: boolean }} [opts] direct: prefer the unpooled URL (for migrations)
 * @returns {string | undefined}
 */
export function resolveDatabaseUrl(env, opts = {}) {
  const pooled = ["DATABASE_URL", "NEON_URL", "NEON_DATABASE_URL", "POSTGRES_URL", "NEON_POSTGRES_URL"];
  const direct = ["DATABASE_URL_UNPOOLED", "NEON_URL_UNPOOLED", "NEON_DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING", "NEON_POSTGRES_URL_NON_POOLING"];
  for (const key of opts.direct ? [...direct, ...pooled] : pooled) {
    const value = env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}
