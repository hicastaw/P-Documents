import "dotenv/config";
import crypto from "crypto";
import amqp from "amqplib";
import pg from "pg";
import { createClient } from "redis";
import { Client as MinioClient } from "minio";
import pdfParse from "pdf-parse";
import { loadEnv } from "./config/env";

const env = loadEnv();

const pool = new pg.Pool({
  host: env.POSTGRES_HOST,
  port: env.POSTGRES_PORT,
  database: env.POSTGRES_DB,
  user: env.POSTGRES_USER,
  password: env.POSTGRES_PASSWORD,
});

const redis = createClient({ url: env.REDIS_URL });

const minio = new MinioClient({
  endPoint: env.MINIO_ENDPOINT,
  port: env.MINIO_PORT,
  useSSL: env.MINIO_USE_SSL,
  accessKey: env.MINIO_ACCESS_KEY,
  secretKey: env.MINIO_SECRET_KEY,
});

const QUEUE = "document_uploaded";

async function hashObject(objectKey: string): Promise<{ sha256: string; bytes: number; buffer: Buffer }> {
  const stream = await minio.getObject(env.MINIO_BUCKET, objectKey);
  const hasher = crypto.createHash("sha256");
  const chunks: Buffer[] = [];
  let bytes = 0;
  await new Promise<void>((resolve, reject) => {
    stream.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      hasher.update(chunk);
      chunks.push(chunk);
    });
    stream.on("end", () => resolve());
    stream.on("error", (e) => reject(e));
  });
  return { sha256: hasher.digest("hex"), bytes, buffer: Buffer.concat(chunks) };
}

function chunkText(text: string, chunkSize = 1200, overlap = 150) {
  const clean = text.replace(/\s+/g, " ").trim();
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    const end = Math.min(clean.length, i + chunkSize);
    chunks.push(clean.slice(i, end));
    if (end === clean.length) break;
    i = Math.max(0, end - overlap);
  }
  return chunks;
}

async function processDocument(documentId: string) {
  const r = await pool.query("SELECT id, object_key, status FROM documents WHERE id=$1", [documentId]);
  const doc = r.rows[0];
  if (!doc) return;

  const { sha256, buffer } = await hashObject(doc.object_key);

  // Dedup: if sha256 already exists in another document, reject
  const existing = await pool.query("SELECT id FROM documents WHERE sha256=$1 AND id<>$2", [sha256, documentId]);
  if (existing.rows[0]) {
    await pool.query("UPDATE documents SET status='rejected' WHERE id=$1", [documentId]);
    return;
  }

  await pool.query("UPDATE documents SET sha256=$1, status='approved' WHERE id=$2", [sha256, documentId]);

  // Phase 5: extract + chunk PDF, store chunks (embedding optional later)
  try {
    const parsed = await pdfParse(buffer);
    const chunks = chunkText(parsed.text || "");
    for (let idx = 0; idx < chunks.length; idx += 1) {
      await pool.query(
        "INSERT INTO doc_chunks(document_id, chunk_index, content, embedding) VALUES ($1,$2,$3,$4) ON CONFLICT (document_id, chunk_index) DO NOTHING",
        [documentId, idx, chunks[idx], null],
      );
    }
  } catch {
    // ignore extraction failures for now
  }

  // Minimal trust score example (Phase 4 placeholder)
  await redis.incr(`trust:${doc.owner_id ?? "unknown"}`);
}

async function connectWithRetry(url: string, retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      return await amqp.connect(url);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`AMQP connection failed, retrying in 2s... (${i + 1}/${retries})`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error("Failed to connect to AMQP");
}

async function main() {
  await redis.connect();
  const conn = await connectWithRetry(env.RABBITMQ_URL);
  const ch = await conn.createChannel();
  await ch.assertQueue(QUEUE, { durable: true });
  ch.prefetch(1);

  // eslint-disable-next-line no-console
  console.log("Worker is consuming", QUEUE);

  ch.consume(
    QUEUE,
    async (msg) => {
      if (!msg) return;
      try {
        const payload = JSON.parse(msg.content.toString("utf-8"));
        const documentId = payload.documentId as string;
        await processDocument(documentId);
        ch.ack(msg);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("Worker error", e);
        ch.nack(msg, false, false);
      }
    },
    { noAck: false },
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

