/**
 * service.ts — Chat business logic: retrieval + FPT Cloud AI call.
 *
 * Retrieval strategy (simple keyword-based, no vector DB needed):
 *   1. Tokenize the question into ≤5 keywords.
 *   2. Build a PostgreSQL ILIKE query across doc_chunks.content.
 *   3. Fallback to first N chunks if nothing matched.
 *
 * The retrieved chunks are injected into the prompt via prompts.ts.
 */

import { pool } from "../../db/pg";
import { callFPTCloud, FptError, FptMessage } from "./fpt";
import { buildSystemPrompt, buildUserMessage } from "./prompts";
import { loadEnv } from "../../config/env";

const env = loadEnv();

const MAX_KEYWORD_CHUNKS = 8; // chunks returned by keyword search
const MAX_FALLBACK_CHUNKS = 5; // chunks returned when no keyword match

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

/** Keyword-based retrieval from doc_chunks. */
async function retrieveChunks(question: string, documentId?: string): Promise<ChatChunk[]> {
  const keywords = question
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);

  let chunks: ChatChunk[] = [];

  if (documentId) {
    // Search within a specific document
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
    if (chunks.length === 0) {
      // Fallback: first N chunks of the document
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
    // Search across all documents
    if (keywords.length > 0) {
      const like = `%${keywords[0]}%`;
      const r = await pool.query(
        `SELECT dc.chunk_index, dc.content, dc.document_id
         FROM doc_chunks dc
         WHERE dc.content ILIKE $1
         ORDER BY dc.chunk_index ASC LIMIT $2`,
        [like, MAX_KEYWORD_CHUNKS],
      );
      chunks = r.rows;
    }
    if (chunks.length === 0) {
      const r = await pool.query(
        `SELECT dc.chunk_index, dc.content, dc.document_id
         FROM doc_chunks dc
         ORDER BY dc.document_id, dc.chunk_index ASC LIMIT $1`,
        [MAX_FALLBACK_CHUNKS],
      );
      chunks = r.rows;
    }
  }

  return chunks;
}
