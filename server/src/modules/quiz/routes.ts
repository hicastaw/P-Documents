import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { pool } from "../../db/pg";
import { requireAuth } from "../auth/middleware";
import { redis } from "../../redis/client";

export const quizRouter = Router();

quizRouter.post("/", requireAuth, async (req: Request, res: Response) => {
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

quizRouter.get("/", requireAuth, async (_req: Request, res: Response) => {
  const result = await pool.query("SELECT id,title,subject,created_by,created_at FROM quizzes ORDER BY created_at DESC LIMIT 50");
  return res.json({ quizzes: result.rows });
});

// Seed demo quizzes (creates them if < 3 quizzes exist)
quizRouter.post("/seed", requireAuth, async (req: Request, res: Response) => {
  const existing = await pool.query("SELECT COUNT(*) FROM quizzes");
  if (parseInt(existing.rows[0].count) >= 3) {
    return res.json({ message: "already_seeded", count: existing.rows[0].count });
  }

  const demos = [
    {
      title: "Kiến thức lập trình cơ bản",
      subject: "Công nghệ",
      questions: [
        { q: "HTTP là viết tắt của gì?", options: ["HyperText Transfer Protocol", "High Tech Transfer Protocol", "Hyper Transfer Technology Protocol", "None"], correct: "HyperText Transfer Protocol" },
        { q: "Ngôn ngữ nào được dùng để tạo trang web?", options: ["HTML", "SQL", "Python", "Java"], correct: "HTML" },
        { q: "CSS là gì?", options: ["Cascading Style Sheets", "Computer Style Syntax", "Creative Style System", "None"], correct: "Cascading Style Sheets" },
      ],
    },
    {
      title: "Lịch sử Việt Nam",
      subject: "Lịch sử",
      questions: [
        { q: "Nước Cộng hòa Xã hội chủ nghĩa Việt Nam được thành lập năm nào?", options: ["1975", "1976", "1954", "1945"], correct: "1976" },
        { q: "Thủ đô của Việt Nam là gì?", options: ["Hà Nội", "TP. Hồ Chí Minh", "Đà Nẵng", "Huế"], correct: "Hà Nội" },
        { q: "Ai là Chủ tịch nước đầu tiên của Việt Nam?", options: ["Hồ Chí Minh", "Võ Nguyên Giáp", "Lê Duẩn", "Trường Chinh"], correct: "Hồ Chí Minh" },
      ],
    },
    {
      title: "Toán học phổ thông",
      subject: "Toán học",
      questions: [
        { q: "Đạo hàm của x² là gì?", options: ["2x", "x", "x²", "2"], correct: "2x" },
        { q: "Tổng các góc trong một tam giác bằng bao nhiêu độ?", options: ["180°", "360°", "90°", "270°"], correct: "180°" },
        { q: "√144 = ?", options: ["12", "14", "11", "13"], correct: "12" },
      ],
    },
  ];

  const created = [];
  for (const demo of demos) {
    const r = await pool.query(
      "INSERT INTO quizzes(title, subject, questions, created_by) VALUES ($1,$2,$3,$4) RETURNING id,title,subject",
      [demo.title, demo.subject, JSON.stringify(demo.questions), req.auth!.userId],
    );
    created.push(r.rows[0]);
  }

  return res.status(201).json({ created });
});

quizRouter.get("/:id", requireAuth, async (req: Request, res: Response) => {
  const quizId = z.string().uuid().parse(req.params.id);
  const result = await pool.query("SELECT id,title,subject,questions,created_by,created_at FROM quizzes WHERE id=$1", [quizId]);
  const row = result.rows[0];
  if (!row) return res.status(404).json({ error: "not_found" });

  const qs = Array.isArray(row.questions) ? row.questions : [];
  const safeQuestions = qs.map((q: any) => {
    if (!q || typeof q !== "object") return q;
    // Do not leak correct answer to client (MVP)
    const { correct: _correct, ...rest } = q;
    return rest;
  });

  return res.json({
    quiz: {
      id: row.id,
      title: row.title,
      subject: row.subject,
      created_by: row.created_by,
      created_at: row.created_at,
      questions: safeQuestions,
    },
  });
});

quizRouter.post("/:id/submit", requireAuth, async (req: Request, res: Response) => {
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

quizRouter.get("/:id/leaderboard", requireAuth, async (req: Request, res: Response) => {
  const quizId = z.string().uuid().parse(req.params.id);
  const top = await redis.zRangeWithScores(`leaderboard:${quizId}`, 0, 9, { REV: true });
  return res.json({ leaderboard: top });
});

