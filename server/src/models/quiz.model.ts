import { pool } from "../config/db";

export async function insertQuiz(opts: { title: string; subject: string | null; questions: unknown; createdBy: string }) {
  const result = await pool.query(
    "INSERT INTO quizzes(title, subject, questions, created_by) VALUES ($1,$2,$3,$4) RETURNING id,title,subject,questions,created_by,created_at",
    [opts.title, opts.subject, JSON.stringify(opts.questions), opts.createdBy],
  );
  return result.rows[0];
}

export async function listQuizzes() {
  const result = await pool.query(
    "SELECT id,title,subject,created_by,created_at FROM quizzes ORDER BY created_at DESC LIMIT 50",
  );
  return result.rows;
}

export async function findQuizById(quizId: string) {
  const result = await pool.query(
    "SELECT id,title,subject,questions,created_by,created_at FROM quizzes WHERE id=$1",
    [quizId],
  );
  return result.rows[0] ?? null;
}

export async function insertAttempt(opts: {
  quizId: string;
  userId: string;
  answers: unknown;
  score: number;
  timeTakenSeconds: number;
}) {
  const result = await pool.query(
    "INSERT INTO quiz_attempts(quiz_id, user_id, answers, score, time_taken_seconds) VALUES ($1,$2,$3,$4,$5) RETURNING id,quiz_id,user_id,score,time_taken_seconds,created_at",
    [opts.quizId, opts.userId, JSON.stringify(opts.answers), opts.score, opts.timeTakenSeconds],
  );
  return result.rows[0];
}

// Leaderboard: ALL attempts from ALL players, sorted by score desc then time asc (faster = better)
export async function getLeaderboardRows(quizId: string) {
  const result = await pool.query(
    `SELECT a.id, a.score, a.time_taken_seconds, a.created_at,
            u.id AS user_id, u.display_name, u.email
     FROM quiz_attempts a
     LEFT JOIN users u ON u.id = a.user_id
     WHERE a.quiz_id = $1
     ORDER BY a.score DESC, a.time_taken_seconds ASC, a.created_at ASC
     LIMIT 20`,
    [quizId],
  );
  return result.rows;
}

export async function getHistoryRows(quizId: string, userId: string) {
  const result = await pool.query(
    "SELECT id, quiz_id, score, time_taken_seconds, created_at FROM quiz_attempts WHERE quiz_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 20",
    [quizId, userId],
  );
  return result.rows;
}
