import * as statsModel from "../models/stats.model";

export async function getPublicStats() {
  const [documents, quizzes, quizAttempts, users] = await Promise.all([
    statsModel.countDocuments(),
    statsModel.countQuizzes(),
    statsModel.countQuizAttempts(),
    statsModel.countUsers(),
  ]);
  return { documents, quizzes, quizAttempts, users };
}
