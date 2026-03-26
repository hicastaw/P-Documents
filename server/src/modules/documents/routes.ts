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

documentsRouter.post("/presign", requireAuth, async (req, res) => {
  await ensureBucket();
  const body = z
    .object({
      filename: z.string().min(1),
      mime: z.string().min(1),
      size: z.number().int().positive(),
    })
    .parse(req.body);

  const objectKey = `${req.auth!.userId}/${uuidv4()}-${body.filename}`.replaceAll("..", ".");

  const internalUrl = await minio.presignedPutObject(env.MINIO_BUCKET, objectKey, 60 * 10);
  const urlObj = new URL(internalUrl);
  const publicBase = new URL(env.MINIO_PUBLIC_URL);
  urlObj.protocol = publicBase.protocol;
  urlObj.host = publicBase.host;
  const url = urlObj.toString();

  return res.json({ objectKey, presignedPutUrl: url, expiresInSeconds: 600 });
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
  const params: any[] = [req.auth!.userId];
  let sql =
    "SELECT id,title,description,mime,size,sha256,object_key,status,created_at FROM documents WHERE owner_id=$1";
  if (q && q.trim()) {
    params.push(`%${q.trim()}%`);
    sql += " AND (title ILIKE $2 OR description ILIKE $2)";
  }
  sql += " ORDER BY created_at DESC LIMIT 50";
  const result = await pool.query(sql, params);
  return res.json({ documents: result.rows });
});

documentsRouter.get("/:id/download", requireAuth, async (req, res) => {
  await ensureBucket();
  const id = z.string().uuid().parse(req.params.id);
  const result = await pool.query("SELECT object_key FROM documents WHERE id=$1 AND owner_id=$2", [
    id,
    req.auth!.userId,
  ]);
  const row = result.rows[0];
  if (!row) return res.status(404).json({ error: "not_found" });

  const internalUrl = await minio.presignedGetObject(env.MINIO_BUCKET, row.object_key, 60 * 10);
  const urlObj = new URL(internalUrl);
  const publicBase = new URL(env.MINIO_PUBLIC_URL);
  urlObj.protocol = publicBase.protocol;
  urlObj.host = publicBase.host;
  const url = urlObj.toString();
  return res.json({ presignedGetUrl: url, expiresInSeconds: 600 });
});

