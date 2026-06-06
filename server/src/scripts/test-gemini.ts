import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env" });

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log("No GEMINI_API_KEY found in .env");
    return;
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    console.log("Available models:");
    data.models?.forEach((m: any) => {
      console.log(`- ${m.name}`);
    });
  } catch (err) {
    console.error("Failed to list models:", err);
  }
}

main();
