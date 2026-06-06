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

const FPT_EMBED_URL = "https://mkp-api.fptcloud.com/embeddings";
export const EMBED_MODEL = "Vietnamese_Embedding"; // Đổi model vì API Key cũ bị cấm dùng e5
export const EMBED_DIM = 1024; // Số chiều vector của Vietnamese_Embedding


/**
 * Gọi FPT AI để lấy embedding vector của một đoạn text.
 * Trả về mảng số 1024 chiều, hoặc null nếu không có API key / thất bại.
 */
export async function getEmbedding(
  text: string,
  apiKey: string,
): Promise<number[] | null> {
  if (!apiKey || !text.trim()) return null;

  try {
    const response = await fetch(FPT_EMBED_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`, // FPT AI dùng Bearer token
      },
      body: JSON.stringify({
        model: EMBED_MODEL,
        input: [text.slice(0, 8000)], // FPT API nhận input dạng array
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[Embedder] FPT AI API error ${response.status}:`, errText);
      return null;
    }

    const data = (await response.json()) as {
      data: { embedding: number[]; index: number }[];
    };

    return data.data?.[0]?.embedding ?? null;
  } catch (err) {
    console.warn("[Embedder] FPT AI embedding request failed:", err);
    return null;
  }
}

/**
 * Batch embedding: gọi lần lượt với delay nhỏ để tránh rate limit.
 * Trả về mảng các vector (null nếu từng chunk thất bại).
 */
export async function batchEmbeddings(
  texts: string[],
  apiKey: string,
  delayMs = 300, // FPT AI cần delay lớn hơn một chút so với OpenAI
): Promise<(number[] | null)[]> {
  const results: (number[] | null)[] = [];

  for (const text of texts) {
    const vector = await getEmbedding(text, apiKey);
    results.push(vector);

    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return results;
}
