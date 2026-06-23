/**
 * eval-retrieval.ts — So sánh định lượng (Precision@K/Recall@K/MRR) giữa
 * waterfall cũ (vector HOẶC keyword) và RRF mới (vector + keyword fuse).
 *
 * Phương pháp: dùng TITLE của mỗi document đã có chunk làm query thử,
 * expected = chính document đó (weak-supervision proxy — không cần gán
 * nhãn tay, nhưng chỉ là proxy, không phải ground-truth thật; ghi rõ điều
 * này khi trích số liệu vào báo cáo).
 *
 * baselineSearch/baselineChatRetrieve tái tạo lại đúng logic waterfall gốc
 * (trước khi đổi sang RRF) bằng pool.query trực tiếp ngay trong script này
 * — ngoại lệ hợp lý vì đây là script eval độc lập, không phải app code
 * path, và code waterfall gốc không còn giữ lại trong models/services.
 *
 * Chạy: npx ts-node src/scripts/eval-retrieval.ts [--k=5] [--limit=20]
 */
import "dotenv/config";
import { pool } from "../config/db";
import { loadEnv } from "../config/env";
import { searchDocuments } from "../services/documents.service";
import { retrieveChunks } from "../services/chat.service";
import * as chatModel from "../models/chat.model";
import { redis } from "../config/redis";

const env = loadEnv();

function parseArg(name: string, fallback: number): number {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? Number(arg.split("=")[1]) : fallback;
}

const K = parseArg("k", 5);
const CORPUS_LIMIT = parseArg("limit", 20);
const RANK_SEARCH_LIMIT = 50; // for MRR — need a deeper list than K to find true rank
const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001";

async function getEmbedding(text: string): Promise<number[] | null> {
  if (!env.FPT_API_KEY || !text.trim()) return null;
  try {
    const resp = await fetch("https://mkp-api.fptcloud.com/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.FPT_API_KEY}` },
      body: JSON.stringify({ model: "Vietnamese_Embedding", input: [text.slice(0, 8000)] }),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { data: { embedding: number[] }[] };
    return data.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

// ─── Baseline: waterfall gốc (trước RRF) ─────────────────────────────────────

async function baselineSearch(query: string, limit: number): Promise<string[]> {
  const vector = await getEmbedding(query);
  if (vector) {
    const vectorStr = `[${vector.join(",")}]`;
    const r = await pool.query(
      `SELECT dc.document_id, MAX(1 - (dc.embedding <=> $1::vector)) AS score
       FROM doc_chunks dc INNER JOIN documents d ON d.id = dc.document_id
       WHERE dc.embedding IS NOT NULL AND d.status = 'approved'
       GROUP BY dc.document_id ORDER BY score DESC LIMIT $2`,
      [vectorStr, limit],
    );
    return r.rows.map((row) => row.document_id);
  }
  const r = await pool.query(
    `SELECT id AS document_id FROM documents
     WHERE status = 'approved' AND (title ILIKE $1 OR description ILIKE $1)
     ORDER BY stars DESC, downloads DESC, created_at DESC LIMIT $2`,
    [`%${query}%`, limit],
  );
  return r.rows.map((row) => row.document_id);
}

async function baselineChatRetrieve(question: string, documentId: string, limit: number) {
  const vector = await getEmbedding(question);
  if (vector) {
    const rows = await chatModel.findChunksByVector(`[${vector.join(",")}]`, documentId, limit);
    if (rows.length > 0) return rows;
  }
  const firstKeyword = question.split(/\s+/).map((s) => s.trim()).filter(Boolean)[0];
  if (firstKeyword) {
    const r = await pool.query(
      `SELECT chunk_index, content, document_id FROM doc_chunks
       WHERE document_id = $1 AND content ILIKE $2 ORDER BY chunk_index ASC LIMIT $3`,
      [documentId, `%${firstKeyword}%`, limit],
    );
    if (r.rows.length > 0) return r.rows;
  }
  return chatModel.findFirstChunks(documentId, limit);
}

// ─── Metrics ──────────────────────────────────────────────────────────────

function precisionAtK(ids: string[], expected: string, k: number): number {
  return ids.slice(0, k).includes(expected) ? 1 / k : 0;
}
function recallAtK(ids: string[], expected: string, k: number): number {
  return ids.slice(0, k).includes(expected) ? 1 : 0;
}
function reciprocalRank(ids: string[], expected: string): number {
  const idx = ids.indexOf(expected);
  return idx === -1 ? 0 : 1 / (idx + 1);
}

async function main() {
  await redis.connect();
  console.log(`Eval retrieval — K=${K}, corpus limit=${CORPUS_LIMIT}\n`);

  const corpus = await pool.query<{ id: string; title: string }>(
    `SELECT d.id, d.title FROM documents d
     WHERE d.status = 'approved' AND EXISTS(SELECT 1 FROM doc_chunks WHERE document_id = d.id)
     ORDER BY d.created_at DESC LIMIT $1`,
    [CORPUS_LIMIT],
  );

  if (corpus.rows.length === 0) {
    console.log("Không có document nào có chunk để eval. Hãy upload + đợi worker xử lý trước.");
    process.exit(0);
  }

  // ── Document search eval ──
  const searchMetrics = { baseline: [] as number[][], rrf: [] as number[][] };
  const searchMisses: string[] = [];

  for (const doc of corpus.rows) {
    const [baseIds, rrfResult] = await Promise.all([
      baselineSearch(doc.title, RANK_SEARCH_LIMIT),
      searchDocuments({ userId: SYSTEM_USER_ID, q: doc.title, limit: RANK_SEARCH_LIMIT, page: 1 }),
    ]);
    const rrfIds = rrfResult.documents.map((d: any) => d.id);

    searchMetrics.baseline.push([precisionAtK(baseIds, doc.id, K), recallAtK(baseIds, doc.id, K), reciprocalRank(baseIds, doc.id)]);
    searchMetrics.rrf.push([precisionAtK(rrfIds, doc.id, K), recallAtK(rrfIds, doc.id, K), reciprocalRank(rrfIds, doc.id)]);

    const baseFound = baseIds.includes(doc.id);
    const rrfFound = rrfIds.includes(doc.id);
    if (baseFound !== rrfFound) {
      searchMisses.push(`"${doc.title}" — baseline ${baseFound ? "tìm thấy" : "MISS"}, RRF ${rrfFound ? "tìm thấy" : "MISS"}`);
    }
  }

  // ── Chat retrieval eval (mỗi document, dùng title làm câu hỏi, "đúng" = chunk thuộc đúng document) ──
  const chatMetrics = { baseline: [] as number[], rrf: [] as number[] };
  for (const doc of corpus.rows) {
    const [baseChunks, rrfChunks] = await Promise.all([
      baselineChatRetrieve(doc.title, doc.id, RANK_SEARCH_LIMIT),
      retrieveChunks(doc.title, doc.id),
    ]);
    chatMetrics.baseline.push(baseChunks.length > 0 ? 1 : 0);
    chatMetrics.rrf.push(rrfChunks.length > 0 ? 1 : 0);
  }

  const avg = (rows: number[][], col: number) => rows.reduce((s, r) => s + r[col], 0) / rows.length;

  console.log("========== Document Search Retrieval Eval ==========");
  console.log(`N=${corpus.rows.length} queries, K=${K}\n`);
  console.table({
    "Baseline (waterfall)": {
      [`Precision@${K}`]: avg(searchMetrics.baseline, 0).toFixed(4),
      [`Recall@${K}`]: avg(searchMetrics.baseline, 1).toFixed(4),
      MRR: avg(searchMetrics.baseline, 2).toFixed(4),
    },
    "RRF (mới)": {
      [`Precision@${K}`]: avg(searchMetrics.rrf, 0).toFixed(4),
      [`Recall@${K}`]: avg(searchMetrics.rrf, 1).toFixed(4),
      MRR: avg(searchMetrics.rrf, 2).toFixed(4),
    },
  });

  if (searchMisses.length > 0) {
    console.log("\nQuery có kết quả khác biệt giữa 2 phương pháp:");
    searchMisses.forEach((m) => console.log(" -", m));
  } else {
    console.log("\n(Không có query nào khác biệt giữa 2 phương pháp ở mức tìm-thấy/không-tìm-thấy.)");
  }

  console.log("\n========== Chat Retrieval Eval (tỉ lệ tìm được ít nhất 1 chunk đúng document) ==========");
  console.table({
    "Baseline (waterfall)": { "found_rate": (chatMetrics.baseline.reduce((a, b) => a + b, 0) / chatMetrics.baseline.length).toFixed(4) },
    "RRF (mới)": { "found_rate": (chatMetrics.rrf.reduce((a, b) => a + b, 0) / chatMetrics.rrf.length).toFixed(4) },
  });

  await pool.end();
  await redis.quit();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
