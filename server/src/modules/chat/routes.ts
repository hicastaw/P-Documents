import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth/middleware";
import { pool } from "../../db/pg";

export const chatRouter = Router();

chatRouter.post("/", requireAuth, async (req, res) => {
  const body = z
    .object({
      // documentId is optional — if omitted, search across all docs
      documentId: z.string().uuid().optional(),
      question: z.string().min(1).max(2000),
    })
    .parse(req.body);

  const keywords = body.question
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);

  let chunks: { content: string; chunk_index: number; document_id: string }[] = [];

  if (body.documentId) {
    // Search within specific document
    if (keywords.length > 0) {
      const like = `%${keywords[0]}%`;
      const r = await pool.query(
        `SELECT chunk_index, content, document_id
         FROM doc_chunks
         WHERE document_id=$1 AND content ILIKE $2
         ORDER BY chunk_index ASC LIMIT 6`,
        [body.documentId, like],
      );
      chunks = r.rows;
    }
    // Fallback: first chunks of the document
    if (chunks.length === 0) {
      const r = await pool.query(
        `SELECT chunk_index, content, document_id
         FROM doc_chunks
         WHERE document_id=$1
         ORDER BY chunk_index ASC LIMIT 4`,
        [body.documentId],
      );
      chunks = r.rows;
    }
  } else {
    // No documentId — search across all documents
    if (keywords.length > 0) {
      const like = `%${keywords[0]}%`;
      const r = await pool.query(
        `SELECT dc.chunk_index, dc.content, dc.document_id
         FROM doc_chunks dc
         WHERE dc.content ILIKE $1
         ORDER BY dc.chunk_index ASC LIMIT 8`,
        [like],
      );
      chunks = r.rows;
    }
    // Fallback global: latest chunks
    if (chunks.length === 0) {
      const r = await pool.query(
        `SELECT dc.chunk_index, dc.content, dc.document_id
         FROM doc_chunks dc
         ORDER BY dc.document_id, dc.chunk_index ASC LIMIT 6`,
      );
      chunks = r.rows;
    }
  }

  const context = chunks.map((c) => `[Đoạn #${c.chunk_index}] ${c.content}`).join("\n\n");

  let answer: string;
  if (chunks.length === 0) {
    answer =
      body.documentId
        ? "Tài liệu này chưa được xử lý hoặc chưa có nội dung nào được trích xuất. Vui lòng đợi worker xử lý xong."
        : "Chưa có tài liệu nào được xử lý trong hệ thống. Hãy upload PDF và đợi worker trích xuất nội dung.";
  } else {
    answer =
      `**Câu hỏi:** ${body.question}\n\n` +
      `**Nội dung liên quan tìm thấy:**\n\n${context}\n\n` +
      `*(Hệ thống đang dùng keyword matching. Tích hợp AI sẽ được bật khi cấu hình OPENAI_API_KEY hoặc GEMINI_API_KEY.)*`;
  }

  return res.json({
    answer,
    citations: chunks.map((c) => ({ chunkIndex: c.chunk_index, documentId: c.document_id })),
  });
});
