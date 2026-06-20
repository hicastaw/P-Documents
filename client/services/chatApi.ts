import { apiJsonAuth } from "./api";

export function askQuestion(question: string, documentId?: string) {
  return apiJsonAuth<{ answer: string; mode: string; citations: any[] }>("/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question, documentId }),
  });
}
