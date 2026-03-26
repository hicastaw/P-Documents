import { Router } from "express";
import { z } from "zod";
import { pool } from "../../db/pg";
import { requireAuth } from "../auth/middleware";
import { redis } from "../../redis/client";

export const quizRouter = Router();

quizRouter.post("/", requireAuth, async (req, res) => {
  const body = z
    .object({
      title: z.string().min(1),
      subject: z.string().optional(),
      questions: z.any(),
    })
    .parse(req.body);

  const result = await pool.query(
    "INSERT INTO quizzes(title, subject, questions, created_by) VALUES ($1,$2,$3,$4) RETURNING id,title,subject,questions,created_by,created_at",
    [body.title, body.subject ?? null, JSON.stringify(body.questions), req.auth!.userId],
  );
  return res.status(201).json({ quiz: result.rows[0] });
});

quizRouter.get("/", requireAuth, async (_req, res) => {
  const result = await pool.query("SELECT id,title,subject,created_by,created_at FROM quizzes ORDER BY created_at DESC LIMIT 50");
  return res.json({ quizzes: result.rows });
});

quizRouter.post("/:id/submit", requireAuth, async (req, res) => {
  const quizId = z.string().uuid().parse(req.params.id);
  const body = z.object({ answers: z.any() }).parse(req.body);

  const q = await pool.query("SELECT questions FROM quizzes WHERE id=$1", [quizId]);
  if (!q.rows[0]) return res.status(404).json({ error: "not_found" });
  const questions = q.rows[0].questions as any;

  // Minimal scoring: expects questions = [{ correct: <any> }, ...] and answers = [<any>, ...]
  const answers = Array.isArray(body.answers) ? body.answers : [];
  const qs = Array.isArray(questions) ? questions : [];
  let score = 0;
  for (let i = 0; i < qs.length; i += 1) {
    if (qs[i] && "correct" in qs[i] && answers[i] === qs[i].correct) score += 1;
  }

  const attempt = await pool.query(
    "INSERT INTO quiz_attempts(quiz_id, user_id, answers, score) VALUES ($1,$2,$3,$4) RETURNING id,quiz_id,user_id,score,created_at",
    [quizId, req.auth!.userId, JSON.stringify(body.answers), score],
  );

  await redis.zAdd(`leaderboard:${quizId}`, [{ score, value: req.auth!.userId }]);

  const io = req.app.get("io");
  if (io) io.emit("leaderboard:update", { quizId, userId: req.auth!.userId, score });

  return res.json({ attempt: attempt.rows[0] });
});

quizRouter.get("/:id/leaderboard", requireAuth, async (req, res) => {
  const quizId = z.string().uuid().parse(req.params.id);
  const top = await redis.zRangeWithScores(`leaderboard:${quizId}`, 0, 9, { REV: true });
  return res.json({ leaderboard: top });
});

