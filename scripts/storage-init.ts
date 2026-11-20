/**
 * Creates the private evidence bucket if it does not exist and blocks public
 * access where the provider supports it. Safe to run repeatedly.
 *
 *   npm run storage:init
 */
import { CreateBucketCommand, HeadBucketCommand, PutPublicAccessBlockCommand, S3Client } from "@aws-sdk/client-s3";
import { getEnv } from "../lib/server/env";

const env = getEnv();
const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
});

try {
  await s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
  console.log(`Bucket ${env.S3_BUCKET} already exists.`);
} catch {
  await s3.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }));
  console.log(`Created bucket ${env.S3_BUCKET}.`);
}

try {
  await s3.send(
    new PutPublicAccessBlockCommand({
      Bucket: env.S3_BUCKET,
      PublicAccessBlockConfiguration: { BlockPublicAcls: true, IgnorePublicAcls: true, BlockPublicPolicy: true, RestrictPublicBuckets: true },
    }),
  );
  console.log("Public access blocked.");
} catch {
  // MinIO and some providers do not implement this call; their buckets are private by default.
  console.log("Provider does not support PublicAccessBlock; bucket is private by default — verify in the provider console.");
}
