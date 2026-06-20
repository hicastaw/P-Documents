import type { Server } from "socket.io";

/** SocketController responsibility — thin fan-out invoked by QuizController. */
export function broadcastLeaderboardUpdate(
  io: Server | undefined,
  payload: { quizId: string; userId: string; score: number },
) {
  if (io) io.emit("leaderboard:update", payload);
}
