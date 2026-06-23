import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import type { RedisClientType } from "redis";
import { loadEnv } from "../config/env";

export function initializeSockets(
  httpServer: HttpServer,
  pubClient: RedisClientType,
  subClient: RedisClientType,
): Server {
  const env = loadEnv();

  const io = new Server(httpServer, {
    cors: {
      origin: env.API_CORS_ORIGIN,
      credentials: true,
    },
  });

  // Redis adapter đồng bộ trạng thái Socket.IO giữa nhiều instance API.
  // Khi một instance emit event, Redis pub/sub broadcast tới tất cả instance còn lại
  // để forward tới đúng client đang kết nối — cần thiết khi scale api > 1.
  io.adapter(createAdapter(pubClient, subClient));

  io.on("connection", (socket) => {
    socket.on("join", (room: string) => socket.join(room));
  });

  return io;
}
