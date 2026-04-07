import { Router } from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { requireAuth } from "../auth/middleware";
import { pool } from "../../db/pg";
import { ensureBucket, minio } from "./minio";
import { loadEnv } from "../../config/env";
import { publishDocumentUploaded } from "../../queue/publisher";

const env = loadEnv();
export const documentsRouter = Router();

/**
 * Normalize a filename so it contains only URL-safe ASCII characters.
 * This prevents double-encoding issues when the filename is embedded in
 * an S3 presigned URL path (Vietnamese letters, spaces, etc. cause
 * SignatureDoesNotMatch when proxied through nginx rewrite).
 *
 * The original title is preserved in the DB — only the object key is sanitized.
 */
function sanitizeFilename(name: string): string {
  // 1. Unicode NFD decompose → strips diacritics (à → a, etc.)
  const noDiacritics = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // 2. Replace spaces and unsafe chars with underscore
  const safe = noDiacritics.replace(/[^a-zA-Z0-9._\-]/g, "_");
  // 3. Collapse consecutive underscores
  return safe.replace(/_+/g, "_").replace(/^_|_$/g, "");
}

/**
 * Replace the internal MinIO base URL (http://minio:9000) with the public URL
 * using plain string replace — NOT new URL() — to guarantee zero re-encoding
 * of the path or query string, which would break the AWS Signature v4.
 */
function toPublicMinioUrl(internalUrl: string) {
  const internalBase = `http://${env.MINIO_ENDPOINT}:${env.MINIO_PORT}`;
  const publicBase = env.MINIO_PUBLIC_URL.replace(/\/+$/, "");
  return internalUrl.replace(internalBase, publicBase);
}

documentsRouter.post("/presign", requireAuth, async (req, res) => {
  await ensureBucket();
  const body = z
    .object({
      filename: z.string().min(1),
      mime: z.string().min(1),
      size: z.number().int().positive(),
    })
    .parse(req.body);

  const objectKey = `${req.auth!.userId}/${uuidv4()}-${sanitizeFilename(body.filename)}`.replaceAll("..", ".");

  const internalUrl = await minio.presignedPutObject(env.MINIO_BUCKET, objectKey, 60 * 10);
  const presignedPutUrl = toPublicMinioUrl(internalUrl);

  return res.json({ objectKey, presignedPutUrl, expiresInSeconds: 600 });
});

documentsRouter.post("/complete", requireAuth, async (req, res) => {
  const body = z
    .object({
      objectKey: z.string().min(1),
      title: z.string().min(1),
      description: z.string().optional(),
      mime: z.string().min(1),
      size: z.number().int().positive(),
      categoryId: z.string().uuid().optional(),
      sha256: z.string().optional(),
    })
    .parse(req.body);

  const result = await pool.query(
    `INSERT INTO documents(owner_id, category_id, title, description, mime, size, sha256, object_key, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'uploaded')
     RETURNING id, owner_id, title, object_key, status, created_at`,
    [
      req.auth!.userId,
      body.categoryId ?? null,
      body.title,
      body.description ?? null,
      body.mime,
      body.size,
      body.sha256 ?? null,
      body.objectKey,
    ],
  );

  const doc = result.rows[0];
  await publishDocumentUploaded({ documentId: doc.id });

  return res.status(201).json({ document: doc });
});

documentsRouter.get("/", requireAuth, async (req, res) => {
  const q = z.string().optional().parse(req.query.q);
  const params: any[] = [];
  let sql =
    `SELECT d.id, d.title, d.description, d.mime, d.size, d.status, d.created_at,
            u.display_name AS uploader_name, u.email AS uploader_email
     FROM documents d
     LEFT JOIN users u ON u.id = d.owner_id`;
  if (q && q.trim()) {
    params.push(`%${q.trim()}%`);
    sql += " WHERE (d.title ILIKE $1 OR d.description ILIKE $1)";
  }
  sql += " ORDER BY d.created_at DESC LIMIT 100";
  const result = await pool.query(sql, params);
  return res.json({ documents: result.rows });
});

documentsRouter.get("/:id/download", requireAuth, async (req, res) => {
  await ensureBucket();
  const id = z.string().uuid().parse(req.params.id);
  const result = await pool.query("SELECT object_key FROM documents WHERE id=$1", [id]);
  const row = result.rows[0];
  if (!row) return res.status(404).json({ error: "not_found" });

  const internalUrl = await minio.presignedGetObject(env.MINIO_BUCKET, row.object_key, 60 * 10);
  const presignedGetUrl = toPublicMinioUrl(internalUrl);
  return res.json({ presignedGetUrl, expiresInSeconds: 600 });
});
