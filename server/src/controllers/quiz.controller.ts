/**
 * controller.ts — HTTP layer for the quiz module.
 * Maps to the thesis QuizController control class (Chuong3_ok.md 3.1.3,
 * module d "Thi trắc nghiệm"). broadcastLeaderboardUpdate (SocketController)
 * lives in sockets/quiz.socket.ts, invoked from quiz.service.ts.
 */
import type { Request, Response } from "express";
import { z } from "zod";
import * as service from "../services/quiz.service";

const CreateQuizBodySchema = z.object({
  title: z.string().min(1),
  subject: z.string().optional(),
  questions: z.any(),
});

export async function createQuiz(req: Request, res: Response) {
  const body = CreateQuizBodySchema.parse(req.body);
  const quiz = await service.createQuiz({
    title: body.title,
    subject: body.subject,
    questions: body.questions,
    createdBy: req.auth!.userId,
  });
  return res.status(201).json({ quiz });
}

export async function listQuizzes(req: Request, res: Response) {
  const quizzes = await service.listQuizzes();
  return res.json({ quizzes });
}

export async function seedQuizzes(req: Request, res: Response) {
  const result = await service.seedDemoQuizzes(req.auth!.userId);
  if (result.alreadySeeded) {
    return res.json({ message: "already_seeded", count: result.count });
  }
  return res.status(201).json({ created: result.created });
}

export async function getQuiz(req: Request, res: Response) {
  const quizId = z.string().uuid().parse(req.params.id);
  const quiz = await service.getQuizForPlayer(quizId);
  if (!quiz) return res.status(404).json({ error: "not_found" });
  return res.json({ quiz });
}

const SubmitQuizBodySchema = z.object({
  answers: z.any(),
  timeTakenSeconds: z.number().int().min(0).max(9999).optional(),
});

export async function submitQuiz(req: Request, res: Response) {
  const quizId = z.string().uuid().parse(req.params.id);
  const body = SubmitQuizBodySchema.parse(req.body);
  const attempt = await service.submitQuiz({
    quizId,
    userId: req.auth!.userId,
    answers: body.answers,
    timeTakenSeconds: body.timeTakenSeconds,
    io: req.app.get("io"),
  });
  if (!attempt) return res.status(404).json({ error: "not_found" });
  return res.json({ attempt });
}

export async function getLeaderboard(req: Request, res: Response) {
  const quizId = z.string().uuid().parse(req.params.id);
  const leaderboard = await service.getLeaderboard(quizId);
  return res.json({ leaderboard });
}

export async function getHistory(req: Request, res: Response) {
  const quizId = z.string().uuid().parse(req.params.id);
  const attempts = await service.getHistory(quizId, req.auth!.userId);
  return res.json({ attempts });
}
