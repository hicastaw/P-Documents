/**
 * routes.ts — HTTP layer for the chat module.
 *
 * POST /chat
 *   body: { question: string, documentId?: string }
 *   → { answer, mode, citations }
 *
 * Errors are bubbled up to the global Express error handler in app.ts.
 */
import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import * as controller from "../controllers/chat.controller";

export const chatRouter = Router();

chatRouter.post("/", requireAuth, controller.askQuestion);
