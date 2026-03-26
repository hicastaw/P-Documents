import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { loadEnv } from "./config/env";
import { authRouter } from "./modules/auth/routes";
import { documentsRouter } from "./modules/documents/routes";
import { quizRouter } from "./modules/quiz/routes";
import { chatRouter } from "./modules/chat/routes";

export function createApp() {
  const env = loadEnv();
  const app = express();

  app.use(
    cors({
      origin: env.API_CORS_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());

  app.get("/healthz", (_req, res) => res.json({ ok: true }));

  app.use("/auth", authRouter);
  app.use("/documents", documentsRouter);
  app.use("/quiz", quizRouter);
  app.use("/chat", chatRouter);

  return app;
}

