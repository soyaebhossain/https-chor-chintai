import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptBuffer, decryptField, encryptBuffer, encryptField, identifierHmac, keyedHash } from "@/lib/server/crypto";
import { getEnv, productionGaps, usesS3 } from "@/lib/server/env";

const goodEnv = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://registry:registry@localhost:5432/registry",
  IDENTIFIER_HMAC_SECRET: "k".repeat(16) + "9f3a1c7e2b8d4f60",
  FIELD_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  S3_BUCKET: "claim-evidence",
  S3_ACCESS_KEY_ID: "minio",
  S3_SECRET_ACCESS_KEY: "minio-local-only-password",
} as unknown as NodeJS.ProcessEnv;

const prodExtras = {
  SMTP_URL: "smtps://u:p@smtp.test:465",
  MAIL_FROM: "x@test",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
  TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
  NEXT_PUBLIC_CONTACT_EMAIL: "support@chor-chintai.test",
};

describe("getEnv", () => {
  it("accepts a complete environment", () => {
    expect(getEnv(goodEnv).IDENTIFIER_HMAC_SECRET).toHaveLength(32);
  });

  it("fails without an HMAC secret — no development fallback", () => {
    const rest = { ...goodEnv };
    delete rest.IDENTIFIER_HMAC_SECRET;
    expect(() => getEnv(rest as NodeJS.ProcessEnv)).toThrow(/IDENTIFIER_HMAC_SECRET is required/);
  });

  it("rejects short and placeholder secrets", () => {
    expect(() => getEnv({ ...goodEnv, IDENTIFIER_HMAC_SECRET: "short" })).toThrow(/at least 32/);
    expect(() => getEnv({ ...goodEnv, IDENTIFIER_HMAC_SECRET: "replace-with-32-byte-secret-xxxxxxxxx" })).toThrow(/placeholder/);
    expect(() => getEnv({ ...goodEnv, IDENTIFIER_HMAC_SECRET: "development-only-development-only-dev" })).toThrow(/placeholder/);
  });

  it("rejects an encryption key that is not 32 bytes", () => {
    expect(() => getEnv({ ...goodEnv, FIELD_ENCRYPTION_KEY: randomBytes(16).toString("base64") })).toThrow(/32 bytes/);
  });

  it("boots in production without optional services, but reports each gap", () => {
    const env = getEnv({ ...goodEnv, NODE_ENV: "production", S3_BUCKET: undefined, S3_ACCESS_KEY_ID: undefined, S3_SECRET_ACCESS_KEY: undefined } as NodeJS.ProcessEnv);
    expect(usesS3(env)).toBe(false);
    expect(productionGaps(env).join(" ")).toMatch(/email login is disabled.*Turnstile.*PostgreSQL.*CONTACT/);
    expect(productionGaps(getEnv({ ...goodEnv, NODE_ENV: "production", ...prodExtras }))).toEqual([]);
  });

  it("requires SMTP_URL and MAIL_FROM together", () => {
    expect(() => getEnv({ ...goodEnv, SMTP_URL: "smtps://u:p@smtp.test:465" })).toThrow(/Set both SMTP_URL and MAIL_FROM/);
  });

  it("flags missing Turnstile and contact address in production instead of refusing to boot", () => {
    const prod = { ...goodEnv, NODE_ENV: "production", ...prodExtras } as NodeJS.ProcessEnv;
    expect(productionGaps(getEnv({ ...prod, NEXT_PUBLIC_TURNSTILE_SITE_KEY: "", TURNSTILE_SECRET_KEY: "" })).join(" ")).toMatch(/Turnstile keys not set/);
    expect(productionGaps(getEnv({ ...prod, NEXT_PUBLIC_CONTACT_EMAIL: "" })).join(" ")).toMatch(/NEXT_PUBLIC_CONTACT_EMAIL not set/);
  });

  it("rejects half-configured Turnstile even in development", () => {
    expect(() => getEnv({ ...goodEnv, TURNSTILE_SECRET_KEY: "secret" })).toThrow(/or neither/);
  });

  it("requires a complete bucket once S3 credentials are given", () => {
    const rest = { ...goodEnv };
    delete rest.S3_BUCKET;
    expect(() => getEnv(rest)).toThrow(/S3_BUCKET is required when S3 storage is configured/);
  });

  it("rejects a non-postgres database URL", () => {
    expect(() => getEnv({ ...goodEnv, DATABASE_URL: "file:./local.db" })).toThrow(/postgres/);
  });
});

describe("identifierHmac", () => {
  const secret = "s".repeat(40);

  it("is deterministic", () => {
    expect(identifierHmac(secret, "IMEI", "356938035643809")).toBe(identifierHmac(secret, "IMEI", "356938035643809"));
  });

  it("separates identifier types and secrets", () => {
    const imei = identifierHmac(secret, "IMEI", "356938035643809");
    expect(identifierHmac(secret, "SERIAL", "356938035643809")).not.toBe(imei);
    expect(identifierHmac("t".repeat(40), "IMEI", "356938035643809")).not.toBe(imei);
  });

  it("does not contain the identifier", () => {
    expect(identifierHmac(secret, "IMEI", "356938035643809")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("field encryption", () => {
  const key = randomBytes(32).toString("base64");

  it("round-trips and uses a fresh IV each time", () => {
    const a = encryptField(key, "356938035643809");
    const b = encryptField(key, "356938035643809");
    expect(a).not.toBe(b);
    expect(decryptField(key, a)).toBe("356938035643809");
  });

  it("rejects tampered ciphertext and the wrong key", () => {
    const payload = encryptField(key, "356938035643809");
    const parts = payload.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptField(key, parts.join("."))).toThrow();
    expect(() => decryptField(randomBytes(32).toString("base64"), payload)).toThrow();
  });
});

describe("file encryption", () => {
  const key = randomBytes(32).toString("base64");

  it("round-trips binary data", () => {
    const data = randomBytes(5000);
    const enc = encryptBuffer(key, data);
    expect(enc.includes(data.subarray(0, 64))).toBe(false);
    expect(decryptBuffer(key, enc).equals(data)).toBe(true);
  });

  it("detects tampering", () => {
    const enc = encryptBuffer(key, Buffer.from("receipt"));
    enc[enc.length - 1] ^= 1;
    expect(() => decryptBuffer(key, enc)).toThrow();
  });
});

it("keyedHash separates purposes", () => {
  expect(keyedHash("s".repeat(40), "a", "x")).not.toBe(keyedHash("s".repeat(40), "b", "x"));
});
