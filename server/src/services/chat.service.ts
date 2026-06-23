/**
 * chat.service.ts — Chat business logic: retrieval + FPT Cloud AI call.
 *
 * Retrieval strategy (Hybrid Search):
 *   1. Gọi FPT AI Embedding API để biến câu hỏi thành vector.
 *   2. Nếu có vector → Vector Similarity Search (cosine distance qua pgvector).
 *   3. Nếu không có vector → fallback ILIKE keyword search trên doc_chunks.content.
 *   4. Nếu không có chunk nào → fallback lấy N chunk đầu của tài liệu.
 *
 * The retrieved chunks are injected into the prompt via utils/prompt.util.ts.
 */

import * as chatModel from "../models/chat.model";
import * as documentModel from "../models/document.model";
import { callFPTCloud, FptError, FptMessage } from "./fpt.service";
import { buildSystemPrompt, buildUserMessage } from "../utils/prompt.util";
import { loadEnv } from "../config/env";
import { fuseRRF } from "../utils/rrf.util";
import type { ChatChunk } from "../models/chat.model";

const env = loadEnv();

const MAX_VECTOR_CHUNKS = 8;   // final chunk count returned to the prompt, after RRF fusion
const CANDIDATE_CHUNKS = 15;   // candidates fetched per source before fusion (more than final count)
const MAX_FALLBACK_CHUNKS = 5; // chunks returned when neither vector nor keyword matched anything

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
      documentTitle = (await documentModel.findDocumentTitle(documentId)) ?? undefined;
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
      console.error("[chat.service] FptError", {
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
 * Hybrid retrieval từ doc_chunks bằng Reciprocal Rank Fusion (RRF).
 *
 * Chạy đồng thời Vector Similarity Search (cosine) + Keyword search (ts_rank),
 * kết hợp 2 ranked-list bằng RRF thay vì chỉ chọn 1 nguồn (waterfall cũ).
 * Chỉ fallback "lấy N chunk đầu của tài liệu" khi cả 2 nguồn đều rỗng.
 */
export async function retrieveChunks(question: string, documentId?: string) {
  const questionVector = question.trim() ? await getQuestionEmbedding(question) : null;
  const keywords = question
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);

  const [vectorRows, keywordRows] = await Promise.all([
    questionVector
      ? chatModel.findChunksByVector(`[${questionVector.join(",")}]`, documentId, CANDIDATE_CHUNKS)
      : Promise.resolve([] as ChatChunk[]),
    keywords.length > 0
      ? chatModel.findChunksByKeywordRanked(keywords, documentId, CANDIDATE_CHUNKS)
      : Promise.resolve([] as ChatChunk[]),
  ]);

  if (vectorRows.length === 0 && keywordRows.length === 0) {
    return chatModel.findFirstChunks(documentId, MAX_FALLBACK_CHUNKS);
  }

  const chunkKey = (c: ChatChunk) => `${c.document_id}::${c.chunk_index}`;
  const byKey = new Map<string, ChatChunk>();
  for (const c of [...vectorRows, ...keywordRows]) byKey.set(chunkKey(c), c);

  const vectorRanked = vectorRows.map((c, i) => ({ id: chunkKey(c), rank: i + 1 }));
  const keywordRanked = keywordRows.map((c, i) => ({ id: chunkKey(c), rank: i + 1 }));

  const fused = fuseRRF([vectorRanked, keywordRanked]).slice(0, MAX_VECTOR_CHUNKS);
  return fused.map(({ id }) => byKey.get(id)!).filter(Boolean);
}
