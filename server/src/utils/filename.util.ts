import { loadEnv } from "../config/env";

const env = loadEnv();

/**
 * Normalize a filename so it contains only URL-safe ASCII characters.
 */
export function sanitizeFilename(name: string): string {
  const noDiacritics = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const safe = noDiacritics.replace(/[^a-zA-Z0-9._\-]/g, "_");
  return safe.replace(/_+/g, "_").replace(/^_|_$/g, "");
}

/**
 * Replace the internal MinIO base URL with the public URL.
 */
export function toPublicMinioUrl(internalUrl: string) {
  const internalBase = `http://${env.MINIO_ENDPOINT}:${env.MINIO_PORT}`;
  const publicBase = env.MINIO_PUBLIC_URL.replace(/\/+$/, "");
  return internalUrl.replace(internalBase, publicBase);
}
