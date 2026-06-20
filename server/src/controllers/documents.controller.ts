/**
 * controller.ts — HTTP layer for the documents module.
 *
 * Function -> thesis control-class mapping (see Chuong3_ok.md 3.1.3):
 *   requestPresignedUrl, confirmUpload  -> DocumentController
 *   downloadDocument, searchDocuments   -> DocumentActionController
 *   toggleStar                          -> DocumentActionController
 *   submitReport                        -> ReportController
 * (Collapsed into one file/router because they all operate on the same
 * /documents REST resource — see refactor plan deviations.)
 */
import type { Request, Response } from "express";
import { z } from "zod";
import * as service from "../services/documents.service";

const PresignBodySchema = z.object({
  filename: z.string().min(1),
  mime: z.string().min(1),
  size: z.number().int().positive(),
});

export async function requestPresignedUrl(req: Request, res: Response) {
  const body = PresignBodySchema.parse(req.body);
  const result = await service.presignUpload({
    userId: req.auth!.userId,
    filename: body.filename,
    mime: body.mime,
    size: body.size,
  });
  return res.json(result);
}

const CompleteBodySchema = z.object({
  objectKey: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  mime: z.string().min(1),
  size: z.number().int().positive(),
  categoryId: z.string().uuid().optional(),
  category: z.string().optional(),
  sha256: z.string().optional(),
});

export async function confirmUpload(req: Request, res: Response) {
  const body = CompleteBodySchema.parse(req.body);
  const document = await service.completeUpload({
    userId: req.auth!.userId,
    ...body,
  });
  return res.status(201).json({ document });
}

const SearchQuerySchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(), // slug của category
  limit: z.coerce.number().int().min(1).max(50).default(20),
  page: z.coerce.number().int().min(1).default(1),
});

/**
 * GET /documents?q=...&category=...&limit=20&page=1
 *
 * Thuật toán:
 * 1. Nếu có FPT_API_KEY: biến query thành vector → tìm 100 doc gần nhất (Vector Search)
 * 2. Nếu không có API key: fallback về ILIKE (keyword search)
 * 3. Tính Final Score = (vector_score * 0.5) + (stars * 0.3) + (downloads * 0.2) → normalize
 * 4. Trả về top {limit} tài liệu + flag is_starred của user hiện tại
 */
export async function searchDocuments(req: Request, res: Response) {
  const query = SearchQuerySchema.parse(req.query);
  const result = await service.searchDocuments({
    userId: req.auth!.userId,
    q: query.q,
    category: query.category,
    limit: query.limit,
    page: query.page,
  });
  return res.json(result);
}

/**
 * GET /documents/:id/download
 * Trả về presigned URL tải file + tăng download counter lên 1
 */
export async function downloadDocument(req: Request, res: Response) {
  const id = z.string().uuid().parse(req.params.id);
  const result = await service.getDownloadUrl(id);
  if (!result) return res.status(404).json({ error: "not_found" });
  return res.json(result);
}

/**
 * POST /documents/:id/star
 * Toggle star: nếu chưa star thì star, nếu đã star thì bỏ star (unstar).
 */
export async function toggleStar(req: Request, res: Response) {
  const documentId = z.string().uuid().parse(req.params.id);
  const result = await service.toggleDocumentStar(documentId, req.auth!.userId);
  if (!result) return res.status(404).json({ error: "not_found" });
  return res.json(result);
}

const ReportBodySchema = z.object({ reason: z.string().min(5) });

/**
 * POST /documents/:id/report
 * Gửi báo cáo vi phạm cho tài liệu
 */
export async function submitReport(req: Request, res: Response) {
  const documentId = z.string().uuid().parse(req.params.id);
  const { reason } = ReportBodySchema.parse(req.body);
  const ok = await service.createDocumentReport(documentId, req.auth!.userId, reason);
  if (!ok) return res.status(404).json({ error: "not_found" });
  return res.json({ success: true });
}
