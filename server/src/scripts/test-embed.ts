import { GoogleGenerativeAI, TaskType } from "@google/generative-ai";
import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });

async function main() {
  const apiKey = process.env.GEMINI_API_KEY!;
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-embedding-2" });
  
  try {
    const result = await model.embedContent({
      content: { role: "user", parts: [{ text: "Hello world" }] },
      taskType: TaskType.RETRIEVAL_DOCUMENT,
      outputDimensionality: 1024
    } as any);
    console.log("Output dim with 1024:", result.embedding.values.length);
  } catch (err) {
    console.error("Dim error:", err);
  }
}
main();
