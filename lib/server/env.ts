import "server-only";
import { z } from "zod";
import { resolveDatabaseUrl } from "@/lib/database-url.mjs";

const PLACEHOLDER = /replace|change-me|development-only|example/i;

const required = (name: string) => z.string({ required_error: `${name} is required` }).min(1, `${name} is required`);

const secret = (name: string) =>
  required(name)
    .min(32, `${name} must be at least 32 characters`)
    .refine((v) => !PLACEHOLDER.test(v), `${name} still has a placeholder value`);

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: required("DATABASE_URL").regex(/^postgres(ql)?:\/\//, "DATABASE_URL must be a postgres:// URL"),
    IDENTIFIER_HMAC_SECRET: secret("IDENTIFIER_HMAC_SECRET"),
    FIELD_ENCRYPTION_KEY: required("FIELD_ENCRYPTION_KEY").refine(
      (v) => Buffer.from(v, "base64").length === 32,
      "FIELD_ENCRYPTION_KEY must be 32 bytes, base64-encoded",
    ),

    // Evidence storage. With S3 credentials, files go to that private bucket (R2, S3, B2…).
    // Without them they are stored in PostgreSQL. Either way they are AES-256-GCM encrypted first.
    S3_ENDPOINT: z.preprocess(emptyToUndefined, z.string().url().optional()),
    S3_REGION: z.preprocess(emptyToUndefined, z.string().default("us-east-1")),
    S3_BUCKET: z.preprocess(emptyToUndefined, z.string().optional()),
    S3_ACCESS_KEY_ID: z.preprocess(emptyToUndefined, z.string().optional()),
    S3_SECRET_ACCESS_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
    S3_FORCE_PATH_STYLE: z.preprocess(emptyToUndefined, z.enum(["true", "false"]).default("false")).transform((v) => v === "true"),

    // Which header carries the real client IP. Must be one your reverse proxy *overwrites*:
    // cf-connecting-ip (Cloudflare), x-real-ip (nginx `proxy_set_header X-Real-IP $remote_addr`),
    // x-forwarded-for (Vercel, most load balancers — the right-most entry is used).
    CLIENT_IP_HEADER: z.preprocess(emptyToUndefined, z.enum(["cf-connecting-ip", "x-real-ip", "x-forwarded-for"]).default("x-forwarded-for")),

    // Email for login codes and status updates. Without it, development prints codes to the server log;
    // production keeps login switched off (with a notice) until it is configured.
    SMTP_URL: z.preprocess(emptyToUndefined, z.string().regex(/^smtps?:\/\//, "SMTP_URL must be smtp:// or smtps://").optional()),
    MAIL_FROM: z.preprocess(emptyToUndefined, z.string().optional()),

    // Cloudflare Turnstile bot protection on search, login and report. Strongly recommended in production
    // (rate limits still apply without it). CI uses Cloudflare's always-pass test keys.
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
    TURNSTILE_SECRET_KEY: z.preprocess(emptyToUndefined, z.string().optional()),

    // The first person to log in with this email becomes ADMIN — only while no admin exists yet.
    INITIAL_ADMIN_EMAIL: z.preprocess(emptyToUndefined, z.string().email().optional()),

    // Shown on the privacy, terms and takedown pages.
    NEXT_PUBLIC_CONTACT_EMAIL: z.preprocess(emptyToUndefined, z.string().email().optional()),
  })
  .superRefine((env, ctx) => {
    if (!env.NEXT_PUBLIC_TURNSTILE_SITE_KEY !== !env.TURNSTILE_SECRET_KEY) {
      ctx.addIssue({ code: "custom", path: ["TURNSTILE_SECRET_KEY"], message: "Set both NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY, or neither" });
    }
    if (!env.SMTP_URL !== !env.MAIL_FROM) {
      ctx.addIssue({ code: "custom", path: ["MAIL_FROM"], message: "Set both SMTP_URL and MAIL_FROM, or neither" });
    }
    // S3 is opt-in: once credentials are given, the bucket must be complete.
    if (env.S3_ACCESS_KEY_ID || env.S3_SECRET_ACCESS_KEY) {
      for (const key of ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const) {
        if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: `${key} is required when S3 storage is configured` });
      }
    }
  });

/** True when evidence should go to an S3-compatible bucket rather than PostgreSQL. */
export const usesS3 = (env: Env) => Boolean(env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY && env.S3_BUCKET);

/** Optional production features that are switched off; logged loudly at boot. */
export function productionGaps(env: Env): string[] {
  if (env.NODE_ENV !== "production") return [];
  const gaps: string[] = [];
  if (!env.SMTP_URL) gaps.push("SMTP_URL/MAIL_FROM not set — email login is disabled");
  if (!env.TURNSTILE_SECRET_KEY) gaps.push("Turnstile keys not set — bot protection relies on rate limits only");
  if (!usesS3(env)) gaps.push("S3 not configured — evidence files are stored (encrypted) in PostgreSQL");
  if (!env.NEXT_PUBLIC_CONTACT_EMAIL) gaps.push("NEXT_PUBLIC_CONTACT_EMAIL not set — legal pages show no contact address");
  return gaps;
}

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/**
 * Parses and caches the server environment. Throws with every problem listed
 * when anything is missing or weak — there is deliberately no fallback secret.
 * Called from instrumentation.ts so a misconfigured server refuses to boot.
 */
export function getEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached && source === process.env) return cached;
  const parsed = envSchema.safeParse({ ...source, DATABASE_URL: resolveDatabaseUrl(source) });
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid server environment:\n${problems}`);
  }
  if (source === process.env) cached = parsed.data;
  return parsed.data;
}
