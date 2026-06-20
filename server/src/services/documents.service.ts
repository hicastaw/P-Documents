import { v4 as uuidv4 } from "uuid";
import { ensureBucket, minio } from "./storage.service";
import { loadEnv } from "../config/env";
import { publishDocumentUploaded } from "./queue.service";
import { sanitizeFilename, toPublicMinioUrl } from "../utils/filename.util";
import * as documentModel from "../models/document.model";

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
  const { userId, q, limit, page } = opts;
  const offset = (page - 1) * limit;
  const categoryId = opts.category ? await documentModel.findCategoryIdBySlug(opts.category) : null;

  const queryVector = q ? await getQueryEmbedding(q) : null;

  if (queryVector) {
    const vectorStr = `[${queryVector.join(",")}]`;
    const rows = await documentModel.searchDocumentsVector({ userId, vectorStr, categoryId, limit, offset });
    return { documents: rows, search_mode: "vector_ai" as const, page, limit };
  }

  const rows = await documentModel.searchDocumentsKeyword({ userId, q, categoryId, limit, offset });
  return { documents: rows, search_mode: "keyword_fallback" as const, page, limit };
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
