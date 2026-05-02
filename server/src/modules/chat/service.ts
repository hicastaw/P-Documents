/**
 * service.ts — Chat business logic: retrieval + FPT Cloud AI call.
 *
 * Retrieval strategy (Hybrid Search):
 *   1. Gọi FPT AI Embedding API để biến câu hỏi thành vector.
 *   2. Nếu có vector → Vector Similarity Search (cosine distance qua pgvector).
 *   3. Nếu không có vector → fallback ILIKE keyword search trên doc_chunks.content.
 *   4. Nếu không có chunk nào → fallback lấy N chunk đầu của tài liệu.
 *
 * The retrieved chunks are injected into the prompt via prompts.ts.
 */

import { pool } from "../../db/pg";
import { callFPTCloud, FptError, FptMessage } from "./fpt";
import { buildSystemPrompt, buildUserMessage } from "./prompts";
import { loadEnv } from "../../config/env";

const env = loadEnv();

const MAX_VECTOR_CHUNKS = 8;  // chunks returned by vector similarity search
const MAX_KEYWORD_CHUNKS = 8; // chunks returned by keyword search (ILIKE fallback)
const MAX_FALLBACK_CHUNKS = 5; // chunks returned when no keyword match

/**
 * Gọi FPT AI Embedding để lấy vector của câu hỏi.
 * Trả về null nếu không có API key hoặc thất bại.
 */
async function getQuestionEmbedding(question: string): Promise<number[] | null> {
  const apiKey = env.FPT_API_KEY;
  if (!apiKey || !question.trim()) return null;
  try {
    const resp = await fetch("https://mkp-api.fptcloud.com/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "Vietnamese_Embedding",
        input: [question.slice(0, 8000)],
      }),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { data: { embedding: number[] }[] };
    return data.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

export interface ChatChunk {
  chunk_index: number;
  content: string;
  document_id: string;
}

export interface ChatResult {
  answer: string;
  mode: "fpt" | "fallback_no_chunks" | "fallback_no_api_key";
  citations: Array<{ chunkIndex: number; documentId: string }>;
}

/**
 * Main entry point: retrieve relevant chunks, then call FPT Cloud AI (or fallback).
 */
export async function handleChat(opts: {
  question: string;
  documentId?: string;
  userId: string;
}): Promise<ChatResult> {
  const { question, documentId } = opts;

  // -- 1. Retrieve relevant chunks from Postgres --
  const chunks = await retrieveChunks(question, documentId);

  // -- 2. No chunks at all → tell the user, no AI call --
  if (chunks.length === 0) {
    return {
      answer: documentId
        ? "Tài liệu này chưa được xử lý hoặc chưa có nội dung nào được trích xuất. Vui lòng đợi worker xử lý xong."
        : "Chưa có tài liệu nào được xử lý trong hệ thống. Hãy upload PDF và đợi worker trích xuất nội dung.",
      mode: "fallback_no_chunks",
      citations: [],
    };
  }

  // -- 3. No API key → return raw context as readable text --
  if (!env.FPT_API_KEY) {
    const contextText = chunks
      .map((c) => `[Đoạn #${c.chunk_index}] ${c.content}`)
      .join("\n\n");
    return {
      answer:
        `**Câu hỏi:** ${question}\n\n` +
        `**Nội dung liên quan tìm thấy:**\n\n${contextText}\n\n` +
        `*(Tích hợp AI sẽ được bật khi cấu hình FPT_API_KEY.)*`,
      mode: "fallback_no_api_key",
      citations: chunks.map((c) => ({ chunkIndex: c.chunk_index, documentId: c.document_id })),
    };
  }

  // -- 4. Fetch document title for nicer prompts (optional) --
  let documentTitle: string | undefined;
  if (documentId) {
    try {
      const r = await pool.query("SELECT title FROM documents WHERE id=$1", [documentId]);
      documentTitle = r.rows[0]?.title;
    } catch {
      // Non-fatal: proceed without title
    }
  }

  // -- 5. Build prompt and call FPT Cloud AI --
  const system = buildSystemPrompt();
  const userMsg = buildUserMessage({ question, chunks, documentTitle });

  const messages: FptMessage[] = [
    { role: "system", content: system },
    { role: "user", content: userMsg },
  ];

  try {
    const { answer } = await callFPTCloud(env.FPT_API_KEY, messages, {
      temperature: 0.2, // low temp for factual responses
    });
    return {
      answer,
      mode: "fpt",
      citations: chunks.map((c) => ({ chunkIndex: c.chunk_index, documentId: c.document_id })),
    };
  } catch (err) {
    if (err instanceof FptError) {
      // Log structured error for debugging
      console.error("[chat/service] FptError", {
        code: err.code,
        httpStatus: err.httpStatus,
        message: err.message,
      });
      // Surface a friendly message to the user
      throw new Error(`fpt:${err.code}:${err.httpStatus ?? ""}`);
    }
    throw err;
  }
}

/**
 * Hybrid retrieval từ doc_chunks.
 *
 * Ưu tiên:
 *   1. Vector Similarity Search (cosine) — nếu câu hỏi có embedding
 *   2. ILIKE keyword search             — nếu không có embedding
 *   3. Lấy N chunk đầu của tài liệu    — nếu cả 2 không có kết quả
 */
async function retrieveChunks(question: string, documentId?: string): Promise<ChatChunk[]> {
  // ── Bước 1: Thử lấy embedding của câu hỏi ────────────────────────────────
  const questionVector = await getQuestionEmbedding(question);

  // ── Bước 2: Vector Similarity Search (nếu có embedding) ──────────────────
  if (questionVector) {
    const vectorStr = `[${questionVector.join(",")}]`;

    if (documentId) {
      const r = await pool.query(
        `SELECT chunk_index, content, document_id,
                1 - (embedding <=> $1::vector) AS similarity
         FROM doc_chunks
         WHERE document_id = $2
           AND embedding IS NOT NULL
         ORDER BY embedding <=> $1::vector ASC
         LIMIT $3`,
        [vectorStr, documentId, MAX_VECTOR_CHUNKS],
      );
      if (r.rows.length > 0) return r.rows;
    } else {
      const r = await pool.query(
        `SELECT dc.chunk_index, dc.content, dc.document_id,
                1 - (dc.embedding <=> $1::vector) AS similarity
         FROM doc_chunks dc
         INNER JOIN documents d ON d.id = dc.document_id
         WHERE dc.embedding IS NOT NULL
           AND d.status = 'approved'
         ORDER BY dc.embedding <=> $1::vector ASC
         LIMIT $2`,
        [vectorStr, MAX_VECTOR_CHUNKS],
      );
      if (r.rows.length > 0) return r.rows;
    }
  }

  // ── Bước 3: Fallback — ILIKE keyword search ───────────────────────────────
  const keywords = question
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);

  let chunks: ChatChunk[] = [];

  if (documentId) {
    if (keywords.length > 0) {
      const like = `%${keywords[0]}%`;
      const r = await pool.query(
        `SELECT chunk_index, content, document_id
         FROM doc_chunks
         WHERE document_id=$1 AND content ILIKE $2
         ORDER BY chunk_index ASC LIMIT $3`,
        [documentId, like, MAX_KEYWORD_CHUNKS],
      );
      chunks = r.rows;
    }
    // Fallback: first N chunks of the document
    if (chunks.length === 0) {
      const r = await pool.query(
        `SELECT chunk_index, content, document_id
         FROM doc_chunks
         WHERE document_id=$1
         ORDER BY chunk_index ASC LIMIT $2`,
        [documentId, MAX_FALLBACK_CHUNKS],
      );
      chunks = r.rows;
    }
  } else {
    if (keywords.length > 0) {
      const like = `%${keywords[0]}%`;
      const r = await pool.query(
        `SELECT dc.chunk_index, dc.content, dc.document_id
         FROM doc_chunks dc
         INNER JOIN documents d ON d.id = dc.document_id
         WHERE dc.content ILIKE $1
           AND d.status = 'approved'
         ORDER BY dc.chunk_index ASC LIMIT $2`,
        [like, MAX_KEYWORD_CHUNKS],
      );
      chunks = r.rows;
    }
    if (chunks.length === 0) {
      const r = await pool.query(
        `SELECT dc.chunk_index, dc.content, dc.document_id
         FROM doc_chunks dc
         INNER JOIN documents d ON d.id = dc.document_id
         WHERE d.status = 'approved'
         ORDER BY dc.document_id, dc.chunk_index ASC LIMIT $1`,
        [MAX_FALLBACK_CHUNKS],
      );
      chunks = r.rows;
    }
  }

  return chunks;
}
