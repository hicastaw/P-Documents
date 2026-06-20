import type { Server } from "socket.io";
import * as quizModel from "../models/quiz.model";
import * as statsModel from "../models/stats.model";
import { broadcastLeaderboardUpdate } from "../sockets/quiz.socket";

export async function createQuiz(opts: { title: string; subject?: string; questions: unknown; createdBy: string }) {
  return quizModel.insertQuiz({
    title: opts.title,
    subject: opts.subject ?? null,
    questions: opts.questions,
    createdBy: opts.createdBy,
  });
}

export async function listQuizzes() {
  return quizModel.listQuizzes();
}

const DEMO_QUIZZES = [
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

// Seed demo quizzes (creates them if < 3 quizzes exist)
export async function seedDemoQuizzes(createdBy: string) {
  const existing = await statsModel.countQuizzes();
  if (existing >= 3) {
    return { alreadySeeded: true as const, count: existing };
  }

  const created = [];
  for (const demo of DEMO_QUIZZES) {
    const r = await quizModel.insertQuiz({
      title: demo.title,
      subject: demo.subject,
      questions: demo.questions,
      createdBy,
    });
    created.push({ id: r.id, title: r.title, subject: r.subject });
  }

  return { alreadySeeded: false as const, created };
}

export async function getQuizForPlayer(quizId: string) {
  const row = await quizModel.findQuizById(quizId);
  if (!row) return null;

  const qs = Array.isArray(row.questions) ? row.questions : [];
  const safeQuestions = qs.map((q: any) => {
    if (!q || typeof q !== "object") return q;
    // Do not leak correct answer to client (MVP)
    const { correct: _correct, ...rest } = q;
    return rest;
  });

  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    created_by: row.created_by,
    created_at: row.created_at,
    questions: safeQuestions,
  };
}

/** Minimal scoring: expects questions = [{ correct: <any> }, ...] and answers = [<any>, ...] */
export function scoreSubmission(questions: unknown, answers: unknown) {
  const qs = Array.isArray(questions) ? questions : [];
  const ans = Array.isArray(answers) ? answers : [];
  let score = 0;
  for (let i = 0; i < qs.length; i += 1) {
    if (qs[i] && "correct" in qs[i] && ans[i] === qs[i].correct) score += 1;
  }
  return { score, totalQuestions: qs.length };
}

export async function submitQuiz(opts: {
  quizId: string;
  userId: string;
  answers: unknown;
  timeTakenSeconds?: number;
  io?: Server;
}) {
  const row = await quizModel.findQuizById(opts.quizId);
  if (!row) return null;

  const { score, totalQuestions } = scoreSubmission(row.questions, opts.answers);
  const timeTaken = opts.timeTakenSeconds ?? 0;

  const attempt = await quizModel.insertAttempt({
    quizId: opts.quizId,
    userId: opts.userId,
    answers: opts.answers,
    score,
    timeTakenSeconds: timeTaken,
  });

  broadcastLeaderboardUpdate(opts.io, { quizId: opts.quizId, userId: opts.userId, score });

  return { ...attempt, totalQuestions };
}

export async function getLeaderboard(quizId: string) {
  const rows = await quizModel.getLeaderboardRows(quizId);
  return rows.map((r: any) => ({
    attemptId: r.id,
    userId: r.user_id,
    score: r.score,
    timeTaken: r.time_taken_seconds,
    displayName: r.display_name || r.email || "Ẩn danh",
    createdAt: r.created_at,
  }));
}

export async function getHistory(quizId: string, userId: string) {
  return quizModel.getHistoryRows(quizId, userId);
}
