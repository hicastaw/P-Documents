/**
 * routes.ts — HTTP layer for the chat module.
 *
 * POST /chat
 *   body: { question: string, documentId?: string }
 *   → { answer, mode, citations }
 *
 * Errors are bubbled up to the global Express error handler in app.ts.
 * FPT Cloud errors are identified by the "fpt:" prefix in the
 * message so they can be mapped to user-friendly strings on the client.
 */

import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth/middleware";
import { handleChat } from "./service";

export const chatRouter = Router();

const ChatBodySchema = z.object({
  // documentId is optional — if omitted, search across all docs
  documentId: z.string().uuid().optional(),
  question: z.string().min(1).max(2000),
});

chatRouter.post("/", requireAuth, async (req, res) => {
  const body = ChatBodySchema.parse(req.body);

  try {
    const result = await handleChat({
      question: body.question,
      documentId: body.documentId,
      userId: req.auth!.userId,
    });

    return res.json({
      answer: result.answer,
      mode: result.mode,
      citations: result.citations,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    // Log for server-side debugging
    console.error("[chat/routes] Unhandled chat error:", message);

    // Distinguish FPT Cloud AI errors (code is "fpt:<CODE>:<httpStatus>")
    if (message.startsWith("fpt:")) {
      const [, code, httpStatus] = message.split(":");
      return res.status(502).json({
        error: "ai_error",
        code,
        httpStatus: httpStatus ? Number(httpStatus) : undefined,
        message: friendlyFptError(code),
      });
    }

    return res.status(500).json({ error: "internal_error", message });
  }
});

function friendlyFptError(code: string): string {
  switch (code) {
    case "NETWORK_ERROR":
      return "Không thể kết nối đến dịch vụ AI của FPT Cloud. Vui lòng thử lại sau.";
    case "API_ERROR":
      return "Dịch vụ FPT Cloud AI trả về lỗi. Kiểm tra FPT_API_KEY và hạn mức sử dụng.";
    case "INVALID_RESPONSE":
      return "Định dạng phản hồi từ FPT Cloud AI không hợp lệ.";
    default:
      return "Lỗi không xác định từ dịch vụ FPT Cloud AI.";
  }
}
