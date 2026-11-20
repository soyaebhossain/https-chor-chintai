import "server-only";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { evidenceObjects } from "@/db/schema";
import { decryptBuffer, encryptBuffer } from "@/lib/server/crypto";
import { getEnv, usesS3 } from "@/lib/server/env";

let client: S3Client | undefined;

function s3(): S3Client {
  if (!client) {
    const env = getEnv();
    client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: { accessKeyId: env.S3_ACCESS_KEY_ID!, secretAccessKey: env.S3_SECRET_ACCESS_KEY! },
    });
  }
  return client;
}

/**
 * Evidence (GD copies, receipts, NID photos) is encrypted with AES-256-GCM
 * *before* it is stored, so a leaked bucket, database dump or provider-side
 * access exposes only ciphertext. Files are only ever served back through an
 * authenticated, audited route — there are no public or presigned links.
 *
 * Backend: an S3-compatible bucket when configured, otherwise PostgreSQL
 * (fine for launch volumes; switch to a bucket by setting the S3_* variables —
 * new files go there, existing ones stay readable only from where they were
 * written, so migrate before removing the table).
 */
export async function putEvidence(key: string, plaintext: Uint8Array): Promise<void> {
  const env = getEnv();
  const ciphertext = encryptBuffer(env.FIELD_ENCRYPTION_KEY, plaintext);
  if (usesS3(env)) {
    await s3().send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: ciphertext, ContentType: "application/octet-stream" }));
  } else {
    await getDb().insert(evidenceObjects).values({ key, data: ciphertext });
  }
}

export async function getEvidence(key: string): Promise<Buffer> {
  const env = getEnv();
  let ciphertext: Uint8Array;
  if (usesS3(env)) {
    const res = await s3().send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    if (!res.Body) throw new Error("Empty object");
    ciphertext = await res.Body.transformToByteArray();
  } else {
    const [row] = await getDb().select({ data: evidenceObjects.data }).from(evidenceObjects).where(eq(evidenceObjects.key, key));
    if (!row) throw new Error("Evidence object not found");
    ciphertext = row.data;
  }
  return decryptBuffer(env.FIELD_ENCRYPTION_KEY, ciphertext);
}

export async function deleteEvidence(key: string): Promise<void> {
  const env = getEnv();
  if (usesS3(env)) await s3().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  else await getDb().delete(evidenceObjects).where(eq(evidenceObjects.key, key));
}
