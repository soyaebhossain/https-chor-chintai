import "server-only";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { decryptBuffer, encryptBuffer } from "@/lib/server/crypto";
import { getEnv } from "@/lib/server/env";

let client: S3Client | undefined;

function s3(): S3Client {
  if (!client) {
    const env = getEnv();
    client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
    });
  }
  return client;
}

/**
 * Evidence (GD copies, receipts, NID photos) is encrypted with AES-256-GCM
 * *before* it leaves the app, so a leaked bucket or provider-side access
 * exposes only ciphertext. Files are only ever served back through an
 * authenticated, audited route — there are no public or presigned links.
 */
export async function putEvidence(key: string, plaintext: Uint8Array): Promise<void> {
  const env = getEnv();
  await s3().send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: encryptBuffer(env.FIELD_ENCRYPTION_KEY, plaintext),
      ContentType: "application/octet-stream",
    }),
  );
}

export async function getEvidence(key: string): Promise<Buffer> {
  const env = getEnv();
  const res = await s3().send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  if (!res.Body) throw new Error("Empty object");
  return decryptBuffer(env.FIELD_ENCRYPTION_KEY, await res.Body.transformToByteArray());
}

export async function deleteEvidence(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: getEnv().S3_BUCKET, Key: key }));
}
