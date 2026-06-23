import "dotenv/config";
import crypto from "crypto";
import amqp from "amqplib";
import pg from "pg";
import { Client as MinioClient } from "minio";
import pdfParse from "pdf-parse";
import { loadEnv } from "./config/env";
import { batchEmbeddings } from "./embedder";
import {
  startMetricsServer,
  documentsProcessedTotal,
  documentsFailedTotal,
  documentProcessingDurationSeconds,
} from "./metrics";

const env = loadEnv();

const pool = new pg.Pool({
  host: env.POSTGRES_HOST,
  port: env.POSTGRES_PORT,
  database: env.POSTGRES_DB,
  user: env.POSTGRES_USER,
  password: env.POSTGRES_PASSWORD,
});

const minio = new MinioClient({
  endPoint: env.MINIO_ENDPOINT,
  port: env.MINIO_PORT,
  useSSL: env.MINIO_USE_SSL,
  accessKey: env.MINIO_ACCESS_KEY,
  secretKey: env.MINIO_SECRET_KEY,
});

const QUEUE = "document_uploaded";
const DLQ = "document_uploaded.dlq";
const MAX_RETRIES = 3;

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

  // Dedup: if sha256 already exists in another document, reject.
  // Nội dung đã có sẵn ở document khác nên xoá luôn object trên MinIO của
  // bản trùng này để không giữ 2 bản giống nhau tốn dung lượng — row vẫn
  // giữ lại (status='rejected') để owner biết tài liệu mình bị từ chối.
  const existing = await pool.query("SELECT id FROM documents WHERE sha256=$1 AND id<>$2", [sha256, documentId]);
  if (existing.rows[0]) {
    await pool.query("UPDATE documents SET status='rejected' WHERE id=$1", [documentId]);
    await minio.removeObject(env.MINIO_BUCKET, doc.object_key);
    return;
  }

  await pool.query("UPDATE documents SET sha256=$1, status='approved' WHERE id=$2", [sha256, documentId]);

  // Phase 5: extract + chunk PDF, tạo embedding AI rồi lưu vào DB.
  // Lỗi ở bước này được re-throw (không nuốt âm thầm như trước) để
  // ch.consume ở main() quyết định retry hay đẩy vào Dead Letter Queue.
  try {
    const parsed = await pdfParse(buffer);
    const chunks = chunkText(parsed.text || "");

    // Lấy embedding vector cho toàn bộ chunks (batch, có delay tránh rate limit)
    const apiKey = env.FPT_API_KEY ?? "";
    const embeddings = apiKey
      ? await batchEmbeddings(chunks, apiKey, 200)
      : chunks.map(() => null);

    for (let idx = 0; idx < chunks.length; idx += 1) {
      const vector = embeddings[idx];
      // pgvector chấp nhận chuỗi dạng '[0.1, 0.2, ...]' cast về ::vector
      const embeddingValue = vector ? `[${vector.join(",")}]` : null;

      await pool.query(
        `INSERT INTO doc_chunks(document_id, chunk_index, content, embedding)
         VALUES ($1, $2, $3, $4::vector)
         ON CONFLICT (document_id, chunk_index)
         DO UPDATE SET content = EXCLUDED.content, embedding = EXCLUDED.embedding`,
        [documentId, idx, chunks[idx], embeddingValue],
      );
    }

    await pool.query("UPDATE documents SET chunk_status='completed' WHERE id=$1", [documentId]);
    documentsProcessedTotal.inc();

    console.log(
      `[Worker] Document ${documentId}: ${chunks.length} chunks, ` +
      `embedding: ${apiKey ? "✓ AI vector" : "✗ skipped (no API key)"}`,
    );
  } catch (err) {
    console.warn("[Worker] Extract/embed failed for", documentId, err);
    throw err;
  }
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

/**
 * Lỗi extract/chunk/embed (đã re-throw từ processDocument) được retry với
 * backoff tăng dần (header x-retry-count trên message); hết MAX_RETRIES thì
 * đẩy nguyên message vào Dead Letter Queue + đánh dấu chunk_status='failed'
 * để không còn mất message/lỗi âm thầm như trước.
 */
async function handleProcessingFailure(
  ch: amqp.Channel,
  msg: amqp.ConsumeMessage,
  documentId: string,
  retryCount: number,
  err: unknown,
) {
  if (retryCount < MAX_RETRIES) {
    documentsFailedTotal.inc({ stage: "retry" });
    ch.ack(msg);
    const delayMs = 2000 * 2 ** retryCount;
    setTimeout(() => {
      ch.sendToQueue(QUEUE, msg.content, {
        persistent: true,
        headers: { "x-retry-count": retryCount + 1 },
      });
    }, delayMs);
    console.warn(`[Worker] Retry ${retryCount + 1}/${MAX_RETRIES} for ${documentId} in ${delayMs}ms`);
    return;
  }

  documentsFailedTotal.inc({ stage: "dlq" });
  console.error(`[Worker] Document ${documentId} failed after ${MAX_RETRIES} retries — sending to DLQ`, err);
  ch.sendToQueue(DLQ, msg.content, {
    persistent: true,
    headers: { "x-retry-count": retryCount, "x-failed-reason": String(err) },
  });
  await pool.query("UPDATE documents SET chunk_status='failed' WHERE id=$1", [documentId]);
  ch.ack(msg);
}

async function main() {
  startMetricsServer(env.METRICS_PORT);
  const conn = await connectWithRetry(env.RABBITMQ_URL);
  const ch = await conn.createChannel();
  await ch.assertQueue(QUEUE, { durable: true });
  await ch.assertQueue(DLQ, { durable: true });
  ch.prefetch(1);

  // eslint-disable-next-line no-console
  console.log("Worker is consuming", QUEUE);

  ch.consume(
    QUEUE,
    async (msg) => {
      if (!msg) return;
      const retryCount = (msg.properties.headers?.["x-retry-count"] as number) ?? 0;

      let documentId: string;
      try {
        const payload = JSON.parse(msg.content.toString("utf-8"));
        documentId = payload.documentId as string;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("Worker error: invalid message payload", e);
        ch.nack(msg, false, false);
        return;
      }

      const endTimer = documentProcessingDurationSeconds.startTimer();
      try {
        await processDocument(documentId);
        endTimer();
        ch.ack(msg);
      } catch (err) {
        endTimer();
        await handleProcessingFailure(ch, msg, documentId, retryCount, err);
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