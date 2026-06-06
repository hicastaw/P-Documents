/**
 * embedder.ts - Worker AI Embedding Service (FPT AI Marketplace)
 *
 * FPT AI dùng API format tương thích OpenAI 100%:
 *   POST https://mkp-api.fptcloud.com/embeddings
 *   Header: Authorization: Bearer {FPT_API_KEY}
 *
 * Model được dùng: FPT.AI-e5-large (1024 chiều)
 * - Hỗ trợ Tiếng Việt tốt hơn OpenAI text-embedding-3-small
 * - Dimension: 1024
 *
 * Nếu muốn đổi model:
 *   - "Vietnamese_Embedding" : tối ưu tiếng Việt, dimension cần test
 *   - "FPT.AI-e5-large"      : multilingual, 1024 chiều (recommended)
 *   - "FPT.AI-gte-base"      : nhỏ hơn, nhanh hơn
 */

import { GoogleGenerativeAI, TaskType } from "@google/generative-ai";

const FPT_EMBED_URL = "https://mkp-api.fptcloud.com/embeddings";
export const EMBED_MODEL = "Vietnamese_Embedding"; 
export const EMBED_DIM = 1024; 

async function getFptEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  if (!apiKey || !text.trim()) return null;
  try {
    const response = await fetch(FPT_EMBED_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBED_MODEL,
        input: [text.slice(0, 8000)],
      }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { data: { embedding: number[] }[] };
    return data.data?.[0]?.embedding ?? null;
  } catch (err) {
    return null;
  }
}

async function getGeminiEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  if (!apiKey || !text.trim()) return null;
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-2" });
    const result = await model.embedContent({
      content: { role: "user", parts: [{ text: text.slice(0, 8000) }] },
      taskType: TaskType.RETRIEVAL_DOCUMENT,
      outputDimensionality: 1024
    } as any);
    return result.embedding.values;
  } catch (err) {
    console.error("[Embedder] Gemini API Error:", err);
    return null;
  }
}

export async function getEmbedding(text: string, keys: { gemini?: string; fpt?: string }): Promise<number[] | null> {
  if (keys.gemini) {
    const vec = await getGeminiEmbedding(text, keys.gemini);
    if (vec) return vec;
  }
  if (keys.fpt) {
    const vec = await getFptEmbedding(text, keys.fpt);
    if (vec) return vec;
  }
  return null;
}

export async function batchEmbeddings(
  texts: string[],
  keys: { gemini?: string; fpt?: string },
  delayMs = 300,
): Promise<(number[] | null)[]> {
  const results: (number[] | null)[] = [];
  for (const text of texts) {
    const vector = await getEmbedding(text, keys);
    results.push(vector);
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return results;
}
