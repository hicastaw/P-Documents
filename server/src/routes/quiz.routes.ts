import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import * as controller from "../controllers/quiz.controller";

export const quizRouter = Router();

quizRouter.post("/", requireAuth, controller.createQuiz);
quizRouter.get("/", requireAuth, controller.listQuizzes);
quizRouter.post("/seed", requireAuth, controller.seedQuizzes);
quizRouter.get("/:id", requireAuth, controller.getQuiz);
quizRouter.post("/:id/submit", requireAuth, controller.submitQuiz);
quizRouter.get("/:id/leaderboard", requireAuth, controller.getLeaderboard);
quizRouter.get("/:id/history", requireAuth, controller.getHistory);
