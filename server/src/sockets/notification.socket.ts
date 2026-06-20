import type { Server } from "socket.io";

/** Emit-only half of notification delivery — real-time push over `notify:<userId>`. */
export function emitNotification(
  io: Server | undefined,
  userId: string,
  payload: { type: string; title: string; refId: string },
) {
  if (io) io.emit(`notify:${userId}`, payload);
}
