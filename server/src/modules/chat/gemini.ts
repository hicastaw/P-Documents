import { GoogleGenerativeAI, Content, TaskType } from "@google/generative-ai";

export interface GeminiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GeminiResponse {
  answer: string;
}

export class GeminiError extends Error {
  constructor(
    public readonly code: "NETWORK_ERROR" | "API_ERROR" | "INVALID_RESPONSE",
    message: string,
    public readonly httpStatus?: number
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

/**
 * Gọi Google Gemini API
 * @param apiKey    GEMINI_API_KEY từ env
 * @param messages  Mảng messages [{role, content}]
 * @param options   Tùy chọn: temperature, maxTokens
 */
export async function callGemini(
  apiKey: string,
  messages: GeminiMessage[],
  options: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;
  } = {}
): Promise<GeminiResponse> {
  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Model recommended for text chat
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  try {
    // Chuyển đổi định dạng messages sang chuẩn của Gemini SDK
    // Gemini chia thành systemInstruction và contents (user/model)
    const systemMessages = messages.filter((m) => m.role === "system");
    const otherMessages = messages.filter((m) => m.role !== "system");

    const systemInstruction = systemMessages.map((m) => m.content).join("\n");
    
    // Gemini contents format
    const contents: Content[] = otherMessages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const result = await model.generateContent({
      contents,
      systemInstruction: systemInstruction || undefined,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 1024,
        topP: options.topP ?? 0.95,
        topK: options.topK ?? 40,
      },
    });

    const response = await result.response;
    const text = response.text();

    if (!text) {
      throw new GeminiError("INVALID_RESPONSE", "Gemini returned an empty response.");
    }

    return { answer: text };
  } catch (err: any) {
    console.error("Gemini API Error:", err);
    throw new GeminiError("API_ERROR", err.message || "Unknown Gemini Error");
  }
}

/**
 * Gọi Gemini Embedding để lấy vector (1024 chiều để khớp với FPT AI)
 */
export async function getGeminiEmbedding(apiKey: string, text: string): Promise<number[] | null> {
  if (!apiKey || !text.trim()) return null;
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-embedding-2" });
  
  try {
    const result = await model.embedContent({
      content: { role: "user", parts: [{ text: text.slice(0, 8000) }] },
      taskType: TaskType.RETRIEVAL_DOCUMENT,
      outputDimensionality: 1024
    } as any);
    return result.embedding.values;
  } catch (err) {
    console.error("Gemini Embedding Error:", err);
    return null;
  }
}
