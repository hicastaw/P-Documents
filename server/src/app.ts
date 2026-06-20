import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { ZodError } from "zod";
import { loadEnv } from "./config/env";
import { authRouter } from "./routes/auth.routes";
import { documentsRouter } from "./routes/documents.routes";
import { quizRouter } from "./routes/quiz.routes";
import { chatRouter } from "./routes/chat.routes";
import { forumRouter } from "./routes/forum.routes";
import { notificationsRouter } from "./routes/notifications.routes";
import { statsRouter } from "./routes/stats.routes";
import { adminRouter } from "./routes/admin.routes";

export function createApp() {
  const env = loadEnv();
  const app = express();

  app.use(
    cors({
      origin: env.API_CORS_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "10mb" }));
  app.use(cookieParser());

  app.get("/healthz", (_req: express.Request, res: express.Response) => res.json({ ok: true }));

  app.use("/auth", authRouter);
  app.use("/documents", documentsRouter);
  app.use("/quiz", quizRouter);
  app.use("/chat", chatRouter);
  app.use("/forum", forumRouter);
  app.use("/notifications", notificationsRouter);
  app.use("/stats", statsRouter);
  app.use("/admin", adminRouter);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: "validation_error", details: (err as ZodError).issues });
    }

    // eslint-disable-next-line no-console
    console.error("Unhandled error:", err);
    return res.status(500).json({ error: "internal_error" });
  });

  return app;
}
