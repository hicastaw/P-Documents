import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth/middleware";
import { pool } from "../../db/pg";

export const chatRouter = Router();

chatRouter.post("/", requireAuth, async (req, res) => {
  const body = z
    .object({
      documentId: z.string().uuid(),
      question: z.string().min(1),
    })
    .parse(req.body);

  // Minimal retrieval (no embeddings yet): top chunks by simple ILIKE match on keywords
  const keywords = body.question
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);

  let chunks: { content: string; chunk_index: number }[] = [];
  if (keywords.length > 0) {
    const like = `%${keywords[0]}%`;
    const r = await pool.query(
      "SELECT chunk_index, content FROM doc_chunks WHERE document_id=$1 AND content ILIKE $2 ORDER BY chunk_index ASC LIMIT 6",
      [body.documentId, like],
    );
    chunks = r.rows;
  }

  if (chunks.length === 0) {
    const r = await pool.query(
      "SELECT chunk_index, content FROM doc_chunks WHERE document_id=$1 ORDER BY chunk_index ASC LIMIT 4",
      [body.documentId],
    );
    chunks = r.rows;
  }

  const context = chunks.map((c) => `[#${c.chunk_index}] ${c.content}`).join("\n\n");

  // Phase 5: placeholder answer (wire OpenAI/Gemini later)
  const answer =
    `Mình tìm thấy các đoạn liên quan trong tài liệu (trích dẫn bên dưới). ` +
    `Hiện MVP đang dùng keyword retrieval; mình sẽ nâng cấp embedding + rerank ở bước tiếp theo.\n\n` +
    `Câu hỏi: ${body.question}\n\n` +
    `Trích dẫn:\n${context || "(chưa có nội dung trích xuất)"}`;

  return res.json({
    answer,
    citations: chunks.map((c) => ({ chunkIndex: c.chunk_index })),
  });
});

