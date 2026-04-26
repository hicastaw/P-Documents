import { Router, type Request, type Response } from "express";
import { pool } from "../../db/pg";
import { requireAuth } from "../auth/middleware";

export const statsRouter = Router();

statsRouter.get("/", requireAuth, async (req: Request, res: Response) => {
  const [docRes, quizRes, attemptRes, usersRes] = await Promise.all([
    pool.query("SELECT COUNT(*)::int AS count FROM documents"),
    pool.query("SELECT COUNT(*)::int AS count FROM quizzes"),
    pool.query("SELECT COUNT(*)::int AS count FROM quiz_attempts"),
    pool.query("SELECT COUNT(*)::int AS count FROM users"),
  ]);

  return res.json({
    documents: docRes.rows[0]?.count ?? 0,
    quizzes: quizRes.rows[0]?.count ?? 0,
    quizAttempts: attemptRes.rows[0]?.count ?? 0,
    users: usersRes.rows[0]?.count ?? 0,
  });
});
