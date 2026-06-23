import { v4 as uuidv4 } from "uuid";
import { ensureBucket, minio } from "./storage.service";
import { loadEnv } from "../config/env";
import { publishDocumentUploaded } from "./queue.service";
import { sanitizeFilename, toPublicMinioUrl } from "../utils/filename.util";
import * as documentModel from "../models/document.model";
import { redis } from "../config/redis";
import { fuseRRF } from "../utils/rrf.util";
import { searchCacheTotal } from "../config/metrics";

const SEARCH_CACHE_TTL_SECONDS = 30;

const env = loadEnv();

/**
 * Gọi FPT AI để lấy vector embedding của câu tìm kiếm.
 * FPT AI dùng format tương thích OpenAI 100%.
 * Trả về null nếu không có API key hoặc thất bại.
 */
async function getQueryEmbedding(query: string): Promise<number[] | null> {
  const apiKey = env.FPT_API_KEY;
  if (!apiKey || !query.trim()) return null;

  try {
    const resp = await fetch("https://mkp-api.fptcloud.com/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`, // FPT AI dùng Bearer token
      },
      body: JSON.stringify({
        model: "Vietnamese_Embedding", // 1024 chiều, hỗ trợ tiếng Việt tốt
        input: [query.slice(0, 8000)], // FPT API nhận input dạng array
      }),
    });

    if (!resp.ok) return null;

    const data = (await resp.json()) as {
      data: { embedding: number[] }[];
    };
    return data.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

// ─── Upload ─────────────────────────────────────────────────────────────────

export async function presignUpload(opts: { userId: string; filename: string; mime: string; size: number }) {
  await ensureBucket();
  const objectKey = `${opts.userId}/${uuidv4()}-${sanitizeFilename(opts.filename)}`.replaceAll("..", ".");
  const internalUrl = await minio.presignedPutObject(env.MINIO_BUCKET, objectKey, 60 * 10);
  const presignedPutUrl = toPublicMinioUrl(internalUrl);
  return { objectKey, presignedPutUrl, expiresInSeconds: 600 };
}

export async function completeUpload(opts: {
  userId: string;
  objectKey: string;
  title: string;
  description?: string;
  mime: string;
  size: number;
  categoryId?: string;
  category?: string;
  sha256?: string;
}) {
  let resolvedCategoryId: string | null = opts.categoryId ?? null;
  if (!resolvedCategoryId && opts.category) {
    resolvedCategoryId = await documentModel.findCategoryIdBySlug(opts.category);
  }

  const doc = await documentModel.insertDocument({
    ownerId: opts.userId,
    categoryId: resolvedCategoryId,
    title: opts.title,
    description: opts.description ?? null,
    mime: opts.mime,
    size: opts.size,
    sha256: opts.sha256 ?? null,
    objectKey: opts.objectKey,
  });

  await publishDocumentUploaded({ documentId: doc.id });
  return doc;
}

// ─── Search (Hybrid AI Search) ───────────────────────────────────────────────

export async function searchDocuments(opts: {
  userId: string;
  q?: string;
  category?: string;
  limit: number;
  page: number;
}) {
  const { userId, q, category, limit, page } = opts;
  const cacheKey = `search:${userId}:${q ?? ""}:${category ?? ""}:${page}:${limit}`;

  const cached = await redis.get(cacheKey).catch(() => null);
  if (cached) {
    searchCacheTotal.inc({ result: "hit" });
    return { ...JSON.parse(cached), cache: "hit" as const };
  }
  searchCacheTotal.inc({ result: "miss" });

  const result = await runSearchDocuments({ userId, q, category, limit, page });

  await redis
    .set(cacheKey, JSON.stringify(result), { EX: SEARCH_CACHE_TTL_SECONDS })
    .catch((e) => console.warn("[Search] Cache write failed:", e));

  return { ...result, cache: "miss" as const };
}

const CANDIDATE_LIMIT = 100;

async function runSearchDocuments(opts: {
  userId: string;
  q?: string;
  category?: string;
  limit: number;
  page: number;
}) {
  const { userId, q, limit, page } = opts;
  const offset = (page - 1) * limit;
  const categoryId = opts.category ? await documentModel.findCategoryIdBySlug(opts.category) : null;

  if (!q || !q.trim()) {
    const rows = await documentModel.listDocumentsDefault({ userId, categoryId, limit, offset });
    return { documents: rows, search_mode: "keyword_fallback" as const, page, limit };
  }

  const queryVector = await getQueryEmbedding(q);

  const [vectorRows, keywordRows] = await Promise.all([
    queryVector
      ? documentModel.searchDocumentsVectorRanked({
          vectorStr: `[${queryVector.join(",")}]`,
          categoryId,
          candidateLimit: CANDIDATE_LIMIT,
        })
      : Promise.resolve([]),
    documentModel.searchDocumentsKeywordRanked({ q, categoryId, candidateLimit: CANDIDATE_LIMIT }),
  ]);

  const vectorRanked = vectorRows.map((r, i) => ({ id: r.document_id, rank: i + 1 }));
  const keywordRanked = keywordRows.map((r, i) => ({ id: r.document_id, rank: i + 1 }));

  let fusedIds: string[];
  let search_mode: "rrf_hybrid" | "vector_only" | "keyword_only";
  if (vectorRanked.length > 0 && keywordRanked.length > 0) {
    fusedIds = fuseRRF([vectorRanked, keywordRanked]).map((r) => r.id);
    search_mode = "rrf_hybrid";
  } else if (vectorRanked.length > 0) {
    fusedIds = vectorRanked.map((r) => r.id);
    search_mode = "vector_only";
  } else {
    fusedIds = keywordRanked.map((r) => r.id);
    search_mode = "keyword_only";
  }

  const pageIds = fusedIds.slice(offset, offset + limit);
  const hydrated = await documentModel.hydrateDocumentsByIds({ ids: pageIds, userId });
  const byId = new Map(hydrated.map((row) => [row.id, row]));
  const documents = pageIds.map((id) => byId.get(id)).filter(Boolean);

  return { documents, search_mode, page, limit };
}

// ─── Download (+ tăng counter) ───────────────────────────────────────────────

export async function getDownloadUrl(documentId: string) {
  await ensureBucket();
  const objectKey = await documentModel.findApprovedDocumentObjectKey(documentId);
  if (!objectKey) return null;

  // Tăng download counter (fire & forget, không block response)
  documentModel.incrementDownloadCount(documentId)
    .catch((e) => console.warn("[Download] Counter update failed:", e));

  const internalUrl = await minio.presignedGetObject(env.MINIO_BUCKET, objectKey, 60 * 10);
  const presignedGetUrl = toPublicMinioUrl(internalUrl);
  return { presignedGetUrl, expiresInSeconds: 600 };
}

// ─── Star / Unstar (GitHub-style) ────────────────────────────────────────────

export async function toggleDocumentStar(documentId: string, userId: string) {
  const approved = await documentModel.isDocumentApproved(documentId);
  if (!approved) return null;

  const alreadyStarred = await documentModel.findUserStar(userId, documentId);

  let starred: boolean;
  if (alreadyStarred) {
    // Đã star → Bỏ star (Unstar)
    await documentModel.deleteStar(userId, documentId);
    await documentModel.decrementStars(documentId);
    starred = false;
  } else {
    // Chưa star → Thêm star
    await documentModel.insertStar(userId, documentId);
    await documentModel.incrementStars(documentId);
    starred = true;
  }

  const stars = await documentModel.getStarsCount(documentId);
  return { starred, stars };
}

// ─── Report ──────────────────────────────────────────────────────────────────

export async function createDocumentReport(documentId: string, userId: string, reason: string) {
  const approved = await documentModel.isDocumentApproved(documentId);
  if (!approved) return false;

  await documentModel.insertDocumentReport(userId, documentId, reason);
  return true;
}
