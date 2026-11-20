import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

const isProd = process.env.NODE_ENV === "production";

const schema = z.object({
  DATABASE_URL: z.string().url().optional(),
  PGLITE_DIR: z.string().default(".data/pglite"),
  IDENTIFIER_HMAC_SECRET: z.string().min(32, "IDENTIFIER_HMAC_SECRET কমপক্ষে ৩২ অক্ষরের হতে হবে"),
  FIELD_ENCRYPTION_KEY: z.string().min(32, "FIELD_ENCRYPTION_KEY কমপক্ষে ৩২ অক্ষরের হতে হবে"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET কমপক্ষে ৩২ অক্ষরের হতে হবে"),
  ADMIN_PASSWORD: z.string().min(12, "ADMIN_PASSWORD কমপক্ষে ১২ অক্ষরের হতে হবে").optional(),
});

export type Env = z.infer<typeof schema>;

// Development-only secrets are generated per process so nothing guessable is
// ever baked into the code. Production refuses to start without real ones.
const devSecret = () => randomBytes(32).toString("hex");
let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const raw = { ...process.env };
  if (!isProd) {
    raw.IDENTIFIER_HMAC_SECRET ||= stableDevSecret("hmac");
    raw.FIELD_ENCRYPTION_KEY ||= stableDevSecret("enc");
    raw.SESSION_SECRET ||= devSecret();
  }
  for (const key of Object.keys(raw)) if (raw[key] === "") delete raw[key];
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Environment configuration is invalid:\n${issues}`);
  }
  if (isProd && !parsed.data.DATABASE_URL && !process.env.ALLOW_PGLITE_IN_PRODUCTION) {
    throw new Error("DATABASE_URL is required in production (or set ALLOW_PGLITE_IN_PRODUCTION=1 for a single-server setup).");
  }
  cached = parsed.data;
  return cached;
}

// Local data must stay readable across dev restarts, so the dev HMAC and
// encryption keys are derived from the checkout path instead of being random.
function stableDevSecret(label: string) {
  return createHash("sha256").update(`chor-chintai-dev:${label}:${process.cwd()}`).digest("hex");
}
