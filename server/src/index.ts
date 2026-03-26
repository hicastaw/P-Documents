import "dotenv/config";
import http from "http";
import { Server } from "socket.io";
import { createApp } from "./app";
import { loadEnv } from "./config/env";
import { redis } from "./redis/client";

async function main() {
  const env = loadEnv();
  const app = createApp();
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: {
      origin: env.API_CORS_ORIGIN,
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    socket.on("join", (room: string) => socket.join(room));
  });

  app.set("io", io);

  await redis.connect();

  server.listen(env.API_PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on :${env.API_PORT}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

