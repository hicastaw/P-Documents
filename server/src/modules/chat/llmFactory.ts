import { callFPTCloud, FptMessage, FptError } from "./fpt";
import { callGemini, getGeminiEmbedding, GeminiMessage, GeminiError } from "./gemini";
import { loadEnv } from "../../config/env";

const env = loadEnv();

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  answer: string;
}

export class LLMError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus?: number
  ) {
    super(message);
    this.name = "LLMError";
  }
}

export const llmFactory = {
  /**
   * Gọi AI Chat Completion (ưu tiên Gemini, fallback FPT)
   */
  async callLLM(
    messages: LLMMessage[],
    options: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      topK?: number;
    } = {}
  ): Promise<LLMResponse> {
    if (env.GEMINI_API_KEY) {
      try {
        const res = await callGemini(env.GEMINI_API_KEY, messages as GeminiMessage[], options);
        return { answer: res.answer };
      } catch (err: any) {
        if (err instanceof GeminiError) {
          throw new LLMError(err.code, err.message, err.httpStatus);
        }
        throw new LLMError("API_ERROR", err.message);
      }
    }

    if (env.FPT_API_KEY) {
      try {
        const res = await callFPTCloud(env.FPT_API_KEY, messages as FptMessage[], options);
        return { answer: res.answer };
      } catch (err: any) {
        if (err instanceof FptError) {
          throw new LLMError(err.code, err.message, err.httpStatus);
        }
        throw new LLMError("API_ERROR", err.message);
      }
    }

    throw new LLMError("CONFIG_ERROR", "Chưa cấu hình API Key (GEMINI_API_KEY hoặc FPT_API_KEY).");
  },

  /**
   * Lấy Vector Embedding (ưu tiên Gemini, fallback FPT)
   */
  async getEmbedding(text: string): Promise<number[] | null> {
    if (env.GEMINI_API_KEY) {
      return getGeminiEmbedding(env.GEMINI_API_KEY, text);
    }

    if (env.FPT_API_KEY) {
      try {
        const resp = await fetch("https://mkp-api.fptcloud.com/embeddings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.FPT_API_KEY}`,
          },
          body: JSON.stringify({
            model: "Vietnamese_Embedding",
            input: [text.slice(0, 8000)],
          }),
        });
        if (!resp.ok) return null;
        const data = (await resp.json()) as { data: { embedding: number[] }[] };
        return data.data?.[0]?.embedding ?? null;
      } catch {
        return null;
      }
    }

    return null;
  },

  /**
   * Trả về chế độ AI đang hoạt động
   */
  getActiveProvider(): string | null {
    if (env.GEMINI_API_KEY) return "gemini";
    if (env.FPT_API_KEY) return "fpt";
    return null;
  }
};
