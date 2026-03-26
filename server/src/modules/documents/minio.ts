import { Client } from "minio";
import { loadEnv } from "../../config/env";

const env = loadEnv();

export const minio = new Client({
  endPoint: env.MINIO_ENDPOINT,
  port: env.MINIO_PORT,
  useSSL: env.MINIO_USE_SSL,
  accessKey: env.MINIO_ACCESS_KEY,
  secretKey: env.MINIO_SECRET_KEY,
});

export async function ensureBucket() {
  const exists = await minio.bucketExists(env.MINIO_BUCKET);
  if (!exists) {
    await minio.makeBucket(env.MINIO_BUCKET, "us-east-1");
  }
}

