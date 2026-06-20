import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { loadEnv } from "../config/env";

export function initializeSockets(httpServer: HttpServer): Server {
  const env = loadEnv();

  const io = new Server(httpServer, {
    cors: {
      origin: env.API_CORS_ORIGIN,
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    socket.on("join", (room: string) => socket.join(room));
  });

  return io;
}
