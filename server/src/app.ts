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
import { register, httpRequestsTotal, httpRequestDurationSeconds } from "./config/metrics";

export function createApp() {
  const env = loadEnv();
  const app = express();

  // Reveal which replica served the request — proof of load balancing across
  // multiple `api` instances behind Nginx (see docker-compose --scale api=N).
  app.use((_req, res, next) => {
    res.setHeader("X-Instance-Id", process.env.HOSTNAME ?? "unknown");
    next();
  });

  // Prometheus request metrics — recorded for every request, regardless of route.
  app.use((req, res, next) => {
    const start = process.hrtime.bigint();
    res.on("finish", () => {
      const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path;
      const labels = { method: req.method, route, status_code: String(res.statusCode) };
      httpRequestsTotal.inc(labels);
      const seconds = Number(process.hrtime.bigint() - start) / 1e9;
      httpRequestDurationSeconds.observe({ method: req.method, route }, seconds);
    });
    next();
  });

  app.use(
    cors({
      origin: env.API_CORS_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "10mb" }));
  app.use(cookieParser());

  app.get("/healthz", (_req: express.Request, res: express.Response) => res.json({ ok: true }));

  app.get("/metrics", async (_req: express.Request, res: express.Response) => {
    res.setHeader("Content-Type", register.contentType);
    res.send(await register.metrics());
  });

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
