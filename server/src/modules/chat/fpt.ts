/**
 * FPT Cloud AI Client
 * OpenAI-compatible API wrapper cho FPT Cloud LLM
 */

const FPT_CLOUD_ENDPOINT = "https://mkp-api.fptcloud.com/v1/chat/completions";
const DEFAULT_MODEL = "gemma-4-26B-A4B-it";

export interface FptMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface FptResponse {
  answer: string;
}

/**
 * Gọi FPT Cloud API (OpenAI-compatible)
 * @param apiKey    FPT_API_KEY từ env
 * @param messages  Mảng messages [{role, content}]
 * @param options   Tùy chọn: temperature, maxTokens
 */
export async function callFPTCloud(
  apiKey: string,
  messages: FptMessage[],
  options: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;
  } = {},
): Promise<FptResponse> {
  const {
    temperature = 0.7,
    maxTokens = 1024,
    topP = 1,
    topK = 40,
  } = options;

  let response: Response;
  try {
    response = await fetch(FPT_CLOUD_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages,
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
        top_k: topK,
        stream: false,
      }),
    });
  } catch (err) {
    throw new FptError("NETWORK_ERROR", `Cannot reach FPT Cloud: ${(err as Error).message}`);
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    console.error("FPT Cloud API Error:", response.status, errData);
    throw new FptError(
      "API_ERROR",
      `FPT Cloud returned ${response.status}: ${JSON.stringify(errData)}`,
      response.status,
    );
  }

  const data = await response.json();

  if (!data.choices?.[0]?.message?.content) {
    throw new FptError("INVALID_RESPONSE", "FPT Cloud returned an invalid response structure");
  }

  return {
    answer: data.choices[0].message.content,
  };
}

export class FptError extends Error {
  constructor(
    public readonly code: "NETWORK_ERROR" | "API_ERROR" | "INVALID_RESPONSE",
    message: string,
    public readonly httpStatus?: number,
  ) {
    super(message);
    this.name = "FptError";
  }
}
