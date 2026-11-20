import "server-only";
import { z } from "zod";

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

    // Private evidence bucket (any S3-compatible store). Files are encrypted before upload.
    S3_ENDPOINT: z.preprocess(emptyToUndefined, z.string().url().optional()),
    S3_REGION: z.preprocess(emptyToUndefined, z.string().default("us-east-1")),
    S3_BUCKET: required("S3_BUCKET"),
    S3_ACCESS_KEY_ID: required("S3_ACCESS_KEY_ID"),
    S3_SECRET_ACCESS_KEY: required("S3_SECRET_ACCESS_KEY"),
    S3_FORCE_PATH_STYLE: z.preprocess(emptyToUndefined, z.enum(["true", "false"]).default("false")).transform((v) => v === "true"),

    // Which header carries the real client IP. Must be one your reverse proxy *overwrites*:
    // cf-connecting-ip (Cloudflare), x-real-ip (nginx `proxy_set_header X-Real-IP $remote_addr`),
    // x-forwarded-for (Vercel, most load balancers — the right-most entry is used).
    CLIENT_IP_HEADER: z.preprocess(emptyToUndefined, z.enum(["cf-connecting-ip", "x-real-ip", "x-forwarded-for"]).default("x-forwarded-for")),

    // Email for login codes and status updates. Optional in development (codes are printed to the server log).
    SMTP_URL: z.preprocess(emptyToUndefined, z.string().regex(/^smtps?:\/\//, "SMTP_URL must be smtp:// or smtps://").optional()),
    MAIL_FROM: z.preprocess(emptyToUndefined, z.string().optional()),

    // Cloudflare Turnstile bot protection on search, login and report. Required in production.
    // CI uses Cloudflare's always-pass test keys.
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
    TURNSTILE_SECRET_KEY: z.preprocess(emptyToUndefined, z.string().optional()),

    // Shown on the privacy, terms and takedown pages. Required in production.
    NEXT_PUBLIC_CONTACT_EMAIL: z.preprocess(emptyToUndefined, z.string().email().optional()),
  })
  .superRefine((env, ctx) => {
    if (!env.NEXT_PUBLIC_TURNSTILE_SITE_KEY !== !env.TURNSTILE_SECRET_KEY) {
      ctx.addIssue({ code: "custom", path: ["TURNSTILE_SECRET_KEY"], message: "Set both NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY, or neither" });
    }
    if (env.NODE_ENV !== "production") return;
    if (!env.SMTP_URL) ctx.addIssue({ code: "custom", path: ["SMTP_URL"], message: "SMTP_URL is required in production" });
    if (!env.MAIL_FROM) ctx.addIssue({ code: "custom", path: ["MAIL_FROM"], message: "MAIL_FROM is required in production" });
    for (const key of ["NEXT_PUBLIC_TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY", "NEXT_PUBLIC_CONTACT_EMAIL"] as const) {
      if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: `${key} is required in production` });
    }
  });

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/**
 * Parses and caches the server environment. Throws with every problem listed
 * when anything is missing or weak — there is deliberately no fallback secret.
 * Called from instrumentation.ts so a misconfigured server refuses to boot.
 */
export function getEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached && source === process.env) return cached;
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid server environment:\n${problems}`);
  }
  if (source === process.env) cached = parsed.data;
  return parsed.data;
}
